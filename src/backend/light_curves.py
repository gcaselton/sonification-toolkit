from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR
from context import session_id_var
import logging, requests, os, base64, hashlib, json, gc, threading, time

import lightkurve as lk
from lightkurve import LightCurve
import numpy as np
import asyncio
import matplotlib
matplotlib.use("Agg") 
from matplotlib.figure import Figure
import pandas as pd
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from astroquery.simbad import Simbad
from astroquery.mast import Observations
from scipy.ndimage import gaussian_filter1d
from request_models import StarQuery, DataRequest, DownloadRequest, PlotRequest, RefineRequest
from utils import resolve_file, is_number


router = APIRouter(prefix='/light-curves')

executor = ThreadPoolExecutor(max_workers=4)

SONI_TYPE = 'light_curves'

STYLES_DIR = STYLE_FILES_DIR / SONI_TYPE
STARS_DIR = SUGGESTED_DATA_DIR / SONI_TYPE

# Rankings to sort light curve search results
MISSION_RANK = {
    "Kepler": 0,
    "TESS": 1,
    "K2": 2,
}

TESS_PIPELINE_RANK = {
    "SPOC": 0,
    "TESS-SPOC": 1,
}

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)


def run_lightkurve_search(idents, authors, cancel_event: threading.Event):
    
    # Set a timeout on MAST requests
    Observations.TIMEOUT = 30 

    results_metadata = []

    for ident in idents:

        # Check for user cancelling search
        if cancel_event.is_set():
            LOG.warning('Search cancelled inside thread')
            return None

        id_type = ident.split(" ")[0]

        # Search lightkurve using all idents
        try:
            search_result = lk.search_lightcurve(
            ident,
            author=authors[id_type],
            # limit=20    # Max number of results to return (per ident)
            )
        except Exception as e:
            LOG.warning(f"Search failed for {ident}: {e}")
            continue

        if cancel_event.is_set():
            LOG.warning(f'Search cancelled after {idents.index(ident)+1} lightkurve query')
            return None

        for row in search_result.table:
            results_metadata.append({
                "mission": str(row.get("project")),
                "exposure": int(row.get("exptime")),
                "pipeline": str(row.get("author")),
                "year": int(row.get("year")),
                "period": str(row.get("mission")),
                "dataURI": str(row.get("dataURI")),
            })
    
    # Finally, sort the search results using our custom criteria
    results_metadata.sort(key=sort_key)

    return results_metadata

def sort_key(row):
    """Generate a sortable ranking tuple for a light curve search result.

    Results are sorted primarily by mission priority (Kepler, TESS, K2).
    Additional mission-specific criteria are then applied:

    - Kepler/K2: newest observations first, then longest exposures first.
    - TESS: preferred pipelines first (SPOC, then TESS-SPOC), then
      newest observations first.

    Args:
        row (dict): Metadata for a single light curve result.

    Returns:
        tuple: A tuple of ranking values used by ``list.sort()`` to order
            search results according to the desired mission, pipeline,
            year, and exposure priorities.
    """ 
    mission = row["mission"]

    if mission == "Kepler":
        return (
            MISSION_RANK[mission],
            -row["year"],
            -row["exposure"],
        )

    elif mission == "TESS":
        return (
            MISSION_RANK[mission],
            TESS_PIPELINE_RANK.get(row["pipeline"], 99),
            -row["year"],
        )

    elif mission == "K2":
        return (
            MISSION_RANK[mission],
            -row["year"],
            -row["exposure"],
        )

    return (99,)


@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery, request: Request):
    """
    Search lightcurves in the lightkurve package, given the name of a star.

    - **query**: The query, containing the star name as a string
    - Returns: JSON object containing a list of results
    """
    
    idents, ra, dec = get_identifiers(query)

    mission_filters = query.filters['mission']
    missions = [k for k in mission_filters.keys() if mission_filters[k] == True]

    # Get the correct string formatting for the error message
    match len(missions):
        case 1:
            formatted = missions[0]
        case 2:
            formatted = f'{missions[0]} or {missions[1]}'
        case 3:
            formatted = f'{missions[0]}, {missions[1]}, or {missions[2]}'

    # Return error message if no results (for those filters)
    if len(idents) == 0:
        raise HTTPException(status_code=400, detail=f'No {formatted} light curves found for {query.star_name}.')
    
    results_metadata = []

    authors = {
            'TIC': ('SPOC', 'TESS-SPOC', 'QLP'),
            'KIC': 'Kepler',
            'EPIC': 'K2SFF'
        }
    
    LOG.info(f"Search started for {query.star_name}")

    cancel_event = threading.Event()
    loop = asyncio.get_running_loop()

    task = loop.run_in_executor(
        executor,
        run_lightkurve_search,
        idents,
        authors,
        cancel_event
    )

    try:
        results_metadata = await asyncio.wait_for(task, timeout=30)

        if results_metadata is None:
            raise HTTPException(status_code=499, detail='Search cancelled')
        if len(results_metadata) == 0:
            raise HTTPException(status_code=400, detail=f'No {formatted} light curves found for {query.star_name}.')
        
        return {"results": results_metadata, "ra": ra, "dec": dec}

    except asyncio.TimeoutError:
        cancel_event.set()
        raise HTTPException(status_code=408, detail=f"Search for {query.star_name} timed out")



def get_identifiers(query: StarQuery):
    """
    Query SIMBAD for identifiers that are usable in Lightkurve:
    KIC (Kepler), EPIC (K2), TIC (TESS). 
    Filter this according to user-provided filters.
    """
    try:
        # Get RA/Dec in case we need it later to position the object on Dome
        result = Simbad.query_object(query.star_name)
        if result is None:
            return [], None, None
        
        ra = float(result['ra'][0])
        dec = float(result['dec'][0])
        
        # Get identifiers for lightkurve search
        ids_table = Simbad.query_objectids(query.star_name)
        if ids_table is None:
            return []

        # Convert to a list of plain strings
        all_ids = ids_table["id"].tolist()

        prefixes = {
            "TESS": "TIC",
            "Kepler": "KIC",
            "K2": "EPIC"
        }

        missions = query.filters['mission']

        # Filter for relevant idents
        filtered = [prefixes[m] for m in missions if missions[m] == True]
        result = [i for i in all_ids if any(i.startswith(p) for p in filtered)]

        return result, ra, dec
    
    except Exception as e:
        print("SIMBAD query failed:", e)
        return [], None, None

def download_lightcurve(data_uri):
    """
    This is a shared function used by both /select-lightcurve/ and /plot-lightcurve/.
    It will give the lightcurve a unique ID, check if it has already been downloaded, and download it as CSV if not.
    The purpose of this function is to avoid duplicate downloads (for instance, if a user previews the plot and then selects it for download).

    - **data_uri**: The URI of the target lightcurve
    - Returns: The CSV filepath of the downloaded lightcurve.
    """

    # Create a unique (but reproducible) hash of the URI
    uri_hash = hashlib.md5(data_uri.encode()).hexdigest()
    file_name = f'{uri_hash}.csv'
    session_id = session_id_var.get()
    filepath = TMP_DIR / session_id / file_name

    if not filepath.exists():
        
        url = f'https://mast.stsci.edu/api/v0.1/Download/file?uri={data_uri}'
        lc = lk.read(url)
        
        time = lc.time.value
        flux = lc.flux.value
        
        df = pd.DataFrame({
            "time": np.asarray(time, dtype=np.float64),
            "flux": np.asarray(flux, dtype=np.float64)
        })
        
        first_valid = df["flux"].first_valid_index()
        last_valid = df["flux"].last_valid_index()

        if first_valid is not None and last_valid is not None:
            # Chop the start and end off if they are NaN
            df = df.loc[first_valid:last_valid]
        
        df.to_csv(filepath, index=False)

    return filepath

@router.post('/plot/')
def plot_lightcurve(request: DataRequest):
    """
    Download the target light curve (if not already downloaded) and convert it to a png image.
    This function saves the plot to the memory buffer, to increase speed and avoid saving multiple images to disk.

    - **request**: The URI (or file ref) of the light curve.
    - Returns: The image as a base64 string.
    """

    # Check if the requested light curve is from a search (with data URI) or a local file.
    if (request.file_ref.startswith('mast:')):

        filepath = download_lightcurve(request.file_ref)
    else:
        filepath = resolve_file(request.file_ref)

    img_base64 = plot_and_format_lc(str(filepath))

    return {'image': img_base64}




def plot_and_format_lc(path_or_df: str | pd.DataFrame):
    
    df = pd.read_csv(path_or_df) if isinstance(path_or_df, str) else path_or_df

    time = df['time'].values
    flux = df['flux'].values  

    # Plot and format
    fig = Figure(figsize=(6, 4))
    ax = fig.add_subplot(111)

    ax.plot(
        time,
        flux,
        color="#008080",
        linewidth=1.2,
        alpha=0.9
    )
    
    ax.set_xlabel('Time (days)')
    ax.set_ylabel('Brightness (Flux - electrons per second)')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # send bytes to buffer
    buf = BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # Clean up memory
    buf.close()
    gc.collect()

    return img_base64

@router.post('/select-lightcurve/')
def select_lightcurve(request: DownloadRequest):
    """
    Download a chosen light curve to the tmp directory, if it hasn't already been.
    This can then be used later to sonify the light curve.

    - **request**: The URI of the chosen light curve
    - Returns: The filename of the downloaded light curve
    """
    filepath = Path(download_lightcurve(request.data_uri))
    file_ref = f'session:{filepath.name}'
    
    return {'file_ref': file_ref}


@router.post('/get-range-and-nans/')
def get_range(request: DataRequest):

    filepath = str(resolve_file(request.file_ref))

    df = pd.read_csv(filepath)
    x = df['time'].values
    value_range = [float(min(x)), float(max(x))]
    
    has_nans = bool(df['flux'].isna().any())

    return{'range': value_range, 'has_nans': has_nans}


def refine_light_curve(request: RefineRequest):
    
    fill_methods = {
        "min": lambda x: x.min(),
        "max": lambda x: x.max(),
        "mean": lambda x: x.mean(),
        "median": lambda x: x.median(),
        "mode": lambda x: x.mode().iloc[0], # Mode returns a Series
    }
    
    filepath = str(resolve_file(request.file_ref))
    
    df = pd.read_csv(filepath)
    
    # Truncate to new range
    new_start, new_end = request.new_range
    df = df[(df['time'] >= new_start) & (df['time'] <= new_end)].copy()
    
    nans_after_trim = False
    
    # Apply selected NaN strategy
    if df.isna().any().any():
        nans_after_trim = True
        
        if request.nan_strategy == "fill":
            fill_value = fill_methods[request.fill_with](df["flux"])
            df["flux"] = df["flux"].fillna(fill_value)

        elif request.nan_strategy == "interpolate":
            df['flux'] = df['flux'].interpolate()

        elif request.nan_strategy == "silence":
            pass # Allow STRAUSS to mask NaNs with silence 
    
    if request.sigma > 0:
        # Smooth data
        y_values = df['flux'].values
        smoothed_flux = gaussian_filter1d(y_values, request.sigma)

        df['flux'] = smoothed_flux
    
    return df, nans_after_trim


@router.post('/preview-refined/')
def preview_refined(request: RefineRequest):

    refined, nans_after_trim = refine_light_curve(request)
       
    # Plot, format, and convert image to Base64
    img_base64 = plot_and_format_lc(refined)

    return{'image': img_base64, 'nans_after_trim': nans_after_trim}


@router.post('/save-refined/')
def save_refined(request: RefineRequest):
    
    df, _ = refine_light_curve(request)
 
    session_id = session_id_var.get()
    filename = request.data_name + '_refined.csv'
    refined_filepath = TMP_DIR / session_id / filename
    
    df.to_csv(refined_filepath, index=False)
    
    refined_ref = f'session:{filename}'

    return {'file_ref': refined_ref}



    
    


from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR
from context import session_id_var
import logging, requests, os, base64, hashlib, json, gc, threading

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

CATEGORY = 'light_curves'

STYLES_DIR = STYLE_FILES_DIR / CATEGORY
STARS_DIR = SUGGESTED_DATA_DIR / CATEGORY

logging.basicConfig(level=logging.DEBUG)
LOG = logging.getLogger(__name__)


def run_lightkurve_search(idents, authors, cancel_event: threading.Event):
    
    # Set a timeout on MAST requests
    Observations.TIMEOUT = 10 

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
            limit=20    # Max number of results to return (per ident)
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

    return results_metadata



@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery, request: Request):
    """
    Search lightcurves in the lightkurve package, given the name of a star.

    - **query**: The query, containing the star name as a string
    - Returns: JSON object containing a list of results
    """
    
    idents, ra, dec = get_identifiers(query)
    
    print('ra: ' + str(ra))
    print('dec: ' + str(dec))

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
            'TIC': ('SPOC', 'QLP', 'TESS-SPOC'),
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
        results_metadata = await asyncio.wait_for(task, timeout=20)

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
    It will give the lightcurve a unique ID, check if it has already been downloaded, and download it if not.
    The purpose of this function is to avoid duplicate downloads (for instance, if a user previews the plot and then selects it for download).

    - **data_uri**: The URI of the target lightcurve
    - Returns: The filepath of the downloaded lightcurve.
    """

    # Create a unique (but reproducible) hash of the URI
    hash = hashlib.md5(data_uri.encode()).hexdigest()
    ext = os.path.splitext(data_uri)[-1]

    filename = f'{hash}{ext}'
    session_id = session_id_var.get()
    filepath = TMP_DIR / session_id / filename

    if not os.path.exists(filepath):

        # Convert URI to downloadable URL
        download_url = f'https://mast.stsci.edu/api/v0.1/Download/file?uri={data_uri}'

        # Download and check OK  
        response = requests.get(download_url)
        response.raise_for_status()

        # Write to file 
        with open(filepath, 'wb') as f:
            f.write(response.content)

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




def plot_and_format_lc(filepath: str):

    # Check file extension
    if filepath.endswith('.csv'):
     
        df = pd.read_csv(filepath)
        
        # Get column names for labels
        columns = df.columns.tolist()
        x_label = columns[0] if not is_number(columns[0]) else 'Column 1'
        y_label = columns[1] if not is_number(columns[1]) else 'Column 2'
        
        time = df[columns[0]].values
        flux = df[columns[1]].values
        
    elif filepath.endswith('.fits'):

        # It's a FITS file
        lc = lk.read(filepath)
        time = lc.time.value
        flux = lc.flux.value
        
        x_label = 'Time (days)'
        y_label = 'Flux (electrons per second)'

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
    
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)

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


@router.post('/get-range/')
def get_range(request: DataRequest):

    filepath = str(resolve_file(request.file_ref))

    if filepath.endswith('.fits'):
        lc = lk.read(filepath)
        x = lc.time.value
        value_range = [float(min(x)), float(max(x))]

    elif filepath.endswith('.csv'):
        df = pd.read_csv(filepath)

        time_col = df.columns[0]

        x = df[time_col].values
        value_range = [float(min(x)), float(max(x))]
    else:
        raise HTTPException(status_code=400, detail='File extension not supported: ' + request.file_ref.split(':')[-1])

    return{'range': value_range}


@router.post('/preview-refined/')
def preview_refined(request: RefineRequest):

    refined = save_refined(request)

    filepath = str(resolve_file(refined['file_ref']))
       
    # Plot, format, and convert image to Base64
    img_base64 = plot_and_format_lc(filepath)

    return{'image': img_base64}


@router.post('/save-refined/')
def save_refined(request: RefineRequest):
    
    # Truncate x-axis to new range
    new_start, new_end = request.new_range

    original_filepath = str(resolve_file(request.file_ref))
    
    ext = original_filepath.split('.')[-1]
    session_id = session_id_var.get()
    filename = request.data_name + '_refined.' + ext
    
    refined_filepath = TMP_DIR / session_id / filename
    refined_ref = f'session:{filename}'
    
    if ext == 'fits':
        lc = lk.read(original_filepath)
        lc = lc.truncate(new_start, new_end)
        
        if request.sigma > 0:
            # Smooth y axis with Gaussian filter if sigma > 0
            flux_unit = lc.flux.unit
            smoothed_flux = gaussian_filter1d(lc.flux.value, request.sigma)
            lc = lc.copy()
            lc.flux = smoothed_flux * flux_unit
            
        # This is to prevent crashing from missing lightkurve metadata
        if not hasattr(lc, "centroid_col"):
            lc.centroid_col = None
        if not hasattr(lc, "centroid_row"):
            lc.centroid_row = None
        
        lc.to_fits(refined_filepath, overwrite=True)
            
    elif ext == 'csv':
        df = pd.read_csv(original_filepath)
        
        time_col = df.columns[0]
        df_truncated = df[(df[time_col] >= new_start) & (df[time_col] <= new_end)].copy()
        
        if request.sigma > 0:
            
            y_values = df_truncated.iloc[:, 1].values
            smoothed_flux = gaussian_filter1d(y_values, request.sigma)

            df_truncated.iloc[:, 1] = smoothed_flux
            
        df_truncated.to_csv(refined_filepath, index=False)
        
    else:
        raise HTTPException(status_code=400, detail='Unsupported file type')

    return {'file_ref': refined_ref}



    
    


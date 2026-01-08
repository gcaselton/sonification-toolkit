from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR
from context import session_id_var
import logging, requests, os, base64, hashlib, json, gc

import lightkurve as lk
from lightkurve import LightCurve
import numpy as np
import matplotlib
matplotlib.use("Agg") 
import matplotlib.pyplot as plt
import pandas as pd
from io import BytesIO
from astroquery.simbad import Simbad
from scipy.ndimage import gaussian_filter1d
from core import SonificationRequest, DataRequest
from utils import resolve_file


router = APIRouter(prefix='/light-curves')

CATEGORY = 'light_curves'

STYLES_DIR = STYLE_FILES_DIR / CATEGORY
STARS_DIR = SUGGESTED_DATA_DIR / CATEGORY

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)

# Define BaseModels for expected request types
class StarQuery(BaseModel):
    star_name: str
    filters: dict

class DownloadRequest(BaseModel):
    data_uri: str

class PlotRequest(BaseModel):
    file_ref: str
    new_range: list[int]

class RefineRequest(BaseModel):
    data_name: str
    file_ref: str
    new_range: list[int]
    sigma: int


@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery):
    """
    Search lightcurves in the lightkurve package, given the name of a star.

    - **query**: The query, containing the star name as a string
    - Returns: JSON object containing a list of results
    """

    idents = get_identifiers(query)

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

    # Return 404 and error message if no results (for those filters)
    if len(idents) == 0:
        raise HTTPException(status_code=400, detail=f'No {formatted} light curves found for {query.star_name}.')
    
    results_metadata = []

    authors = {
            'TIC': ('SPOC', 'QLP', 'TESS-SPOC'),
            'KIC': 'Kepler',
            'EPIC': 'K2SFF'
        }

    for ident in idents:
        
        id_type = ident.split(' ')[0]

        # Search lightkurve using all idents
        search_result = lk.search_lightcurve(ident, author=authors[id_type], limit=15)

        # Append selected metadata to a list of dictionaries
        for row in search_result.table:
            results_metadata.append({
                "mission": str(row.get("project")),
                "exposure": int(row.get("exptime")),
                "pipeline": str(row.get("author")),
                "year": int(row.get("year")),
                "period": str(row.get("mission")),
                "dataURI": str(row.get("dataURI"))
            })

    return {'results': results_metadata}


def get_identifiers(query: StarQuery):
    """
    Query SIMBAD for identifiers that are usable in Lightkurve:
    KIC (Kepler), EPIC (K2), TIC (TESS). 
    Filter this according to user-provided filters.
    """
    try:
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

        return result
    
    except Exception as e:
        print("SIMBAD query failed:", e)
        return []


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

@router.post('/plot-lightcurve')
async def plot_lightcurve(request: DownloadRequest):
    """
    Download the target light curve (if not already downloaded) and convert it to a png image.
    This function saves the plot to the memory buffer, to increase speed and avoid saving multiple images to disk.

    - **request**: The URI (or local filepath) of the light curve.
    - Returns: The image as a base64 string.
    """

    # Check if the requested light curve is from a search (with data URI) or a suggested (local) file.
    if (request.data_uri.startswith('mast:')):
        filepath = download_lightcurve(request.data_uri)
    else:
        filepath = request.data_uri

    img_base64 = plot_and_format_lc(filepath)

    return {'image': img_base64}


def plot_and_format_lc(filepath: str):

    # Check file extension
    if filepath.endswith('.csv'):
     
        df = pd.read_csv(filepath)
        
        # Get column names for labels
        columns = df.columns.tolist()
        time = df[columns[0]].values
        flux = df[columns[1]].values
        
    elif filepath.endswith('.fits'):

        # It's a FITS file
        lc = lk.read(filepath)
        time = lc.time.value
        flux = lc.flux.value

    # Plot and format
    fig, ax = plt.subplots()
    ax.plot(time, flux, color="#008080", linewidth=1.2, alpha=0.9)
    
    ax.set_xlabel('Time (days)')
    ax.set_ylabel('Flux (electrons per second)')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # send bytes to buffer
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # Clean up memory
    buf.close()
    del fig, ax, time, flux
    gc.collect()

    return img_base64

@router.post('/select-lightcurve/')
async def select_lightcurve(request: DownloadRequest):
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
async def get_range(request: DataRequest):

    filepath = str(resolve_file(request.file_ref))

    if filepath.endswith('.fits'):
        lc = lk.read(filepath)
        x = lc.time.value
        range = [int(min(x)), int(max(x))]

    elif filepath.endswith('.csv'):
        df = pd.read_csv(filepath)

        time_col = next((col for col in df.columns if 'time' in col.lower()), df.columns[0])

        x = df[time_col].values
        range = [int(min(x)), int(max(x))]
    else:
        raise HTTPException(status_code=400, detail='File extension not supported: ' + request.file_ref.split(':')[-1])

    return{'range': range}


@router.post('/preview-refined/')
async def preview_refined(request: RefineRequest):

    lc_csv = await save_refined(request)

    filepath = resolve_file(lc_csv['file_ref'])
       
    # Plot, format, and convert image to Base64
    img_base64 = plot_and_format_lc(filepath)

    return{'image': img_base64}

def refine_lightcurve(request: RefineRequest):

    # Truncate x-axis to new range
    new_start, new_end = request.new_range

    filepath = resolve_file(request.file_ref)
    lc = lk.read(filepath)
    lc = lc.truncate(new_start, new_end)

    if request.sigma > 0:

        # Smooth with Gaussian filter if sigma > 0
        flux_unit = lc.flux.unit
        smoothed_flux = gaussian_filter1d(lc.flux.value, request.sigma)
        lc = lc.copy()
        lc.flux = smoothed_flux * flux_unit

    return lc

@router.post('/save-refined/')
async def save_refined(request: RefineRequest):

    lc = refine_lightcurve(request)

    filename = f'{request.data_name}.csv'
    session_id = session_id_var.get()
    filepath = TMP_DIR / session_id / filename

    df = pd.DataFrame({
            'time': lc.time.value,
            'flux': lc.flux.value
        })
    
    # Save to CSV
    df.to_csv(filepath, index=False)

    file_ref = f'session:{filename}'

    return {'file_ref': file_ref}



    
    


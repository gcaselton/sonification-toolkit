from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR, SETTINGS_FILE
from strauss.sources import param_lim_dict
from sounds import all_sounds, online_sounds, local_sounds, asset_cache, format_name
from config import GITHUB_USER, GITHUB_REPO
import logging, httpx, yaml, requests, os, base64, hashlib, uuid, aiofiles, zipfile, json, gc

import lightkurve as lk
import numpy as np
import matplotlib
matplotlib.use("Agg") 
import matplotlib.pyplot as plt
from io import BytesIO
from astroquery.simbad import Simbad
from scipy.ndimage import gaussian_filter1d


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

class RangeRequest(BaseModel):
    data_filepath: str


class SonificationRequest(BaseModel):
    data_filepath: str
    style_filepath: str
    duration: int
    system: str

class PlotRequest(BaseModel):
    data_filepath: str
    new_range: list[int]

class RefinePreviewRequest(BaseModel):
    data_filepath: str
    new_range: list[int]
    window_length: int




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
        raise HTTPException(status_code=404, detail=f'No {formatted} light curves found for {query.star_name}.')
    
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
    filepath = os.path.join(TMP_DIR, filename)

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

    # NOTE To do - Fix this so it plots CSV files as well.

    # Check if the requested light curve is from a search (with data URI) or a suggested (local) file.
    if (request.data_uri.startswith('mast:')):
        filepath = download_lightcurve(request.data_uri)
    else:
        filepath = request.data_uri

    lc = lk.read(filepath)

    img_base64 = plot_and_format_lc(lc)

    return {'image': img_base64}


def plot_and_format_lc(lc: lk.LightCurve):

    # Plot and format
    fig, ax = plt.subplots()
    lc.plot(ax=ax, color="#008080", linewidth=1.2, alpha=0.9)

    legend = ax.get_legend()
    if legend:
        legend.remove()

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
    lc = None
    del fig, ax
    gc.collect()

    return img_base64

@router.post('/select-lightcurve/')
async def select_lightcurve(request: DownloadRequest):
    """
    Download a chosen light curve to the tmp directory, if it hasn't already been.
    This can then be used later to sonify the light curve.

    - **request**: The URI of the chosen light curve
    - Returns: The unique ID of the downloaded light curve.
    """
    filepath = download_lightcurve(request.data_uri)
    
    return {'filepath': filepath}

@router.get('/suggested-stars/')
async def get_stars():
    print('Stars dir: ' + str(STARS_DIR))
    if not STARS_DIR.exists():
        raise HTTPException(status_code=404, detail='Suggested stars directory not found')
    
    stars = []

    for file in STARS_DIR.glob('*.yml'):
        try:
            with open(file, 'r') as f:
                data = yaml.safe_load(f)
            star_name = data.get('name', str(file.stem))  # fallback to filename if 'name' missing
            star_desc = data.get('description')
        except Exception as e:
            print(f'Failed to read or parse {file}: {e}')
            continue

        star = {'name': star_name,
                'description': star_desc,
                'filepath': os.path.join(str(STARS_DIR), str(file.stem) + '.fits')}

        stars.append(star)
        
    return stars


@router.post('/sonify-lightcurve/')
async def sonify_lightcurve(request: SonificationRequest):

    data = Path(request.data_filepath)
    style = Path(request.style_filepath)
    length = request.duration
    system = request.system

    try:
        soni = sonify(data, style, CATEGORY, length, system)

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'{CATEGORY}_{id}{ext}'
        filepath = os.path.join(TMP_DIR, filename)
        soni.save(filepath)

        return {'filename': filename}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post('/get-range-data/')
async def get_range(request: RangeRequest):

    lc = lk.read(request.data_filepath)
    x = lc.time.value
    range = [int(min(x)),int(max(x))]

    return{'range': range,
           'max_window': len(x)}


async def plot_trimmed(request: PlotRequest):

    new_start, new_end = request.new_range
    lc = lk.read(request.data_filepath)
    lc = lc.truncate(new_start, new_end)

    img_base64 = plot_and_format_lc(lc)

    return{'image': img_base64}

@router.post('/preview-refined/')
async def preview_refined(request: RefinePreviewRequest):

    # Truncate x-axis to new range
    new_start, new_end = request.new_range
    lc = lk.read(request.data_filepath)
    lc = lc.truncate(new_start, new_end)

    # Smooth with Savitsky-Golay filter
    w_length = request.window_length
    # NOTE To do: w_length needs to be odd
    lc = lc.flatten(window_length=request.window_length)

    # Plot, format, and convert image to Base64
    img_base64 = plot_and_format_lc(lc)

    return{'image': img_base64}


    
    


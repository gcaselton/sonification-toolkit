from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path

import lightkurve as lk
import matplotlib.pyplot as plt
import yaml
import requests
import os
import base64
from io import BytesIO
import hashlib
import uuid

router = APIRouter()

# Create temp directory for storing light curves
STORAGE_DIR = 'tmp'
os.makedirs(STORAGE_DIR, exist_ok=True)

# Define BaseModels for expected request types
class StarQuery(BaseModel):
    star_name: str

class DownloadRequest(BaseModel):
    data_uri: str

class SonificationRequest(BaseModel):
    data_filepath: str
    style_file_str: str
    duration: int
    system: str


@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery):
    """
    Search lightcurves in the lightkurve package, given the name of a star.

    - **query**: The query, containing the star name as a string
    - Returns: JSON object containing a list of results
    """

    # Search name in lightkurve
    search_result = lk.search_lightcurve(query.star_name)

    # Return 404 if no results
    if len(search_result) == 0:
        raise HTTPException(status_code=404, detail=f'No light curves found for {query.star_name}.')
        
    results_metadata = []

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
    filepath = os.path.join(STORAGE_DIR, filename)

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

    - **request**: The URI of the light curve.
    - Returns: The image as a base64 string.
    """

    # Download the lightcurve to the tmp directory, and load it as a LightCurve object
    filepath = download_lightcurve(request.data_uri)
    lc = lk.read(filepath)

    # Plot and send bytes to buffer
    fig, ax = plt.subplots()
    lc.plot(ax=ax)
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")

    return {'image': img_base64}


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

@router.post('/sonify-lightcurve/')
async def sonify_lightcurve(request: SonificationRequest):

    data = Path(request.data_filepath)
    style_string = request.style_file_str
    length = request.duration
    system = request.system

    try:
        style = yaml.safe_load(style_string)
        soni = sonify(data, 'light_curve', style, length, system)
        soni.hear()
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    


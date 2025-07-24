from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR
from main import LOG

import lightkurve as lk
import matplotlib.pyplot as plt
import yaml
import requests
import os
import base64
from io import BytesIO
import hashlib
import uuid
import json

router = APIRouter()

# Define BaseModels for expected request types
class StarQuery(BaseModel):
    star_name: str

class DownloadRequest(BaseModel):
    data_uri: str

class SonificationRequest(BaseModel):
    data_filepath: str
    style_filepath: str
    duration: int
    system: str

class SoundSettings(BaseModel):
    sound: str
    filterCutOff: bool
    pitch: bool
    volume: bool
    leftRightPan: bool
    chordMode: bool
    rootNote: str
    scale: str
    quality: str

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
    style = Path(request.style_filepath)
    length = request.duration
    system = request.system

    LOG.info('4')

    try:
        soni = sonify(data, style,'light_curve', length, system)

        LOG.info('5')

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'light_curve_{id}{ext}'
        filepath = os.path.join(TMP_DIR, filename)
        soni.save(filepath)

        return FileResponse(
                path=filepath,
                media_type='audio/wav',
                filename=filename
            )
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    
@router.post('/save-sound-settings/')
async def save_sound_settings(settings: SoundSettings):
    """
    Save sound settings for the sonification.

    - **settings**: The sound settings to be saved.
    - Returns: A filename of the saved settings.
    """
    # Save settings to a yaml file and return the filename
    style = format_settings(settings)

    LOG.info('3')

    yaml_text = yaml.dump(style, default_flow_style=False)
    filename = f'style_{uuid.uuid4()}.yaml'
    filepath = os.path.join(TMP_DIR, filename)
    f = open(filepath, "x")
    f.write(yaml_text)
    f.close()
    # Return the filename for reference
    return {'filepath': filepath}

def format_settings(settings: SoundSettings):

    parameters = {
        "filterCutOff": [0, 1] if settings.filterCutOff else None,
        "pitch": [0, 1] if settings.pitch else None,
        "volume": [0, 1] if settings.volume else None,
        "leftRightPan": [0, 1] if settings.leftRightPan else None
    }
    LOG.info('1')
    # Remove any None entries in parameters
    parameters = {k: v for k, v in parameters.items() if v is not None}
    LOG.info('2')


    music = (
        f"{settings.rootNote}{settings.quality}" 
        if settings.chordMode 
        else f"{settings.rootNote} {settings.scale}"
        )

    style = {
        "sound": settings.sound,
        "parameters": parameters if parameters else None,
        "chord_mode": "on" if settings.chordMode else "off",
        "chord": f"{settings.rootNote}{settings.quality}" if settings.chordMode else None,
        "scale": None if settings.chordMode else f"{settings.rootNote} {settings.scale}"
    }
    
    return style
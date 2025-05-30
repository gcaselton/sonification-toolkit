from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import lightkurve as lk
import requests
import os
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
    config_filepath: str
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
            #"obs_id": row.get("obs_id"),
            "exposure": int(row.get("exptime")),
            "pipeline": str(row.get("author")),
            "year": int(row.get("year")),
            "period": str(row.get("mission")),
            # "productFilename": row.get("productFilename"),
            # "observation_id": row.get("observation_id"),
            "dataURI": str(row.get("dataURI"))
        })

    return {'results': results_metadata}


@router.post('/download-lightcurve/')
async def download_lightcurve(request: DownloadRequest):
    """
    Download a chosen light curve (.fits) to the tmp directory, giving it a unique ID.
    This can then be used later to sonify the light curve.

    - **request**: The URI of the chosen light curve
    - Returns: The unique ID of the downloaded light curve.
    """

    uri = request.data_uri

    # Convert URI to downloadable URL
    download_url = f'https://mast.stsci.edu/api/v0.1/Download/file?uri={uri}'

    # Download and check OK  
    response = requests.get(download_url)
    response.raise_for_status()

    # Assign a unique ID to use as the filename
    file_id = f'{uuid.uuid4()}.fits'
    filepath = os.path.join(STORAGE_DIR, file_id)

    # Write to file 
    with open(filepath, 'wb') as f:
        f.write(response.content)
    
    return {'file_id': file_id}


def extract_time_flux(lc_filepath):
    """
    Use the lightkurve package to extract the time and flux values from a light curve.

    - **lc_filepath**: the filepath to the lightcurve .fits file.
    - Returns: 2 arrays containing time and flux values.
    """

    lc = lk.read(lc_filepath)
    time = lc.time.value
    flux = lc.flux.value

    return time, flux

@router.post('/sonify-lightcurve/')
async def sonify_lightcurve(request: SonificationRequest):

    time, flux = extract_time_flux(request.data_filepath)


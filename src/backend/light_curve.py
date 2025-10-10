from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR, SETTINGS_FILE
from strauss.sources import param_lim_dict
from sounds import all_sounds, online_sounds, local_sounds, asset_cache, format_name
from config import GITHUB_USER, GITHUB_REPO
import logging, httpx, yaml, requests, os, base64, hashlib, uuid, aiofiles, zipfile, json

import lightkurve as lk
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO
from astroquery.simbad import Simbad


router = APIRouter()

CATEGORY = 'light_curve'

STYLES_DIR = STYLE_FILES_DIR / CATEGORY
STARS_DIR = SUGGESTED_DATA_DIR / CATEGORY

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)

# Define BaseModels for expected request types
class StarQuery(BaseModel):
    star_name: str

class DownloadRequest(BaseModel):
    data_uri: str

    
class SoundRequest(BaseModel):
    sound_name: str


class SonificationRequest(BaseModel):
    data_filepath: str
    style_filepath: str
    duration: int
    system: str

class StylePreviewRequest(BaseModel):
    style_filepath: str

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

class UserSettings(BaseModel):
    data_resolution: int

@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery):
    """
    Search lightcurves in the lightkurve package, given the name of a star.

    - **query**: The query, containing the star name as a string
    - Returns: JSON object containing a list of results
    """

    idents = get_identifiers(query.star_name)
    print(idents)

    # Return 404 if no results
    if len(idents) == 0:
        raise HTTPException(status_code=404, detail=f'No light curves found for {query.star_name}.')
    
    results_metadata = []

    for ident in idents:
        print(ident)

        # Search lightkurve using all idents
        search_result = lk.search_lightcurve(ident, limit=10)
        print(search_result)

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


def get_identifiers(name):
    """
    Query SIMBAD for identifiers that are usable in Lightkurve:
    KIC (Kepler), EPIC (K2), TIC (TESS).
    """
    try:
        ids_table = Simbad.query_objectids(name)
        print(ids_table)
        if ids_table is None:
            return []

        # Convert to a list of plain strings
        all_ids = ids_table["id"].tolist()

        # Filter for relevant idents
        prefixes = ["KIC", "TIC", "EPIC"]
        result = [i for i in all_ids if any(i.startswith(p) for p in prefixes)]

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

    # Check if the requested light curve is from a search (with data URI) or a suggested (local) file.
    if (request.data_uri.startswith('mast:')):
        filepath = download_lightcurve(request.data_uri)
    else:
        filepath = request.data_uri

    lc = lk.read(filepath)

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

@router.get('/styles/')
async def get_styles():
    if not STYLES_DIR.exists():
        raise HTTPException(status_code=404, detail="Style directory not found")
    
    styles = []

    for file in STYLES_DIR.glob("*.yml"):
        try:
            with open(file, "r") as f:
                data = yaml.safe_load(f)
            style_name = data.get("name", file.stem)  # fallback to filename if 'name' missing
        except Exception as e:
            print(f"Failed to read or parse {file}: {e}")
            continue

        style = {'name': style_name, 'filepath': str(file)}

        styles.append(style)

    return styles

@router.get('/sound_info/')
async def get_sound_info():
    return all_sounds()

@router.post('/preview-style-settings/')
async def preview_style_settings(request: StylePreviewRequest):
    style = Path(request.style_filepath)

    # Generate simple ramp to sonify
    x = np.arange(0, 100)
    y = x.copy()

    data = (x, y)

    try:
        soni = sonify(data, style, CATEGORY, length=5,  system='mono')

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'{CATEGORY}_{id}{ext}'
        filepath = os.path.join(TMP_DIR, filename)
        soni.save(filepath)

        return {'filename': filename}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


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

@router.get('/audio/{filename}')
async def get_audio(filename: str):
    filepath = TMP_DIR / filename
    return FileResponse(filepath, media_type="audio/wav")

async def download_online_asset(target_name: str):

    print(target_name)

    target_asset = None

    for asset in asset_cache:
        asset_name = asset.get('name', '')
        asset_name = format_name(asset_name)

        if asset_name.lower() == target_name.lower():
            target_asset = asset
            break

    if not target_asset:
        return {"status": "error", "message": "Asset not found in online cache."}
    
    
    file_name = target_asset['name']
    local_path = Path(SAMPLES_DIR) / target_name

    # Skip download if file exists
    if local_path.exists():
        return {"status": "skipped", "message": "File already exists locally."}
    
    # Define local path
    write_path = Path(TMP_DIR) / file_name

    print(write_path)
    
    # Download the file
    async with httpx.AsyncClient() as client:
        resp = await client.get(target_asset["url"], follow_redirects=True)
        resp.raise_for_status()
        async with aiofiles.open(write_path, "wb") as f:
            await f.write(resp.content)
    
    if file_name.endswith('.zip'):
        with zipfile.ZipFile(write_path, 'r') as zip_ref:
            zip_ref.extractall(SAMPLES_DIR)

    # Delete the zip file after extraction
    write_path.unlink(missing_ok=True)

    return {"status": "success", "message": f"Downloaded and extracted {file_name}"}


@router.post('/ensure-sound-available/')
async def ensure_sound_available(request: SoundRequest):

    if request.sound_name not in [s.name for s in local_sounds()]:
        await download_online_asset(request.sound_name)
    else: print('Sound already exists in local dir')


@router.post('/save-sound-settings/')
async def save_sound_settings(settings: SoundSettings):
    """
    Save sound settings for the sonification.

    - **settings**: The sound settings to be saved.
    - Returns: A filename of the saved settings.
    """
    # Save settings to a yaml file and return the filename
    style = format_settings(settings)

    yaml_text = yaml.dump(style, default_flow_style=False)
    filename = f'style_{uuid.uuid4()}.yaml'
    filepath = os.path.join(TMP_DIR, filename)
    f = open(filepath, "x")
    f.write(yaml_text)
    f.close()

    # Return the filename for reference
    return {'filepath': filepath}

default_lims = {
    'cutoff': [0.1, 0.9],
    'pitch': [0, 1],
    'pitch_shift': [0, 24],
    'volume': [0, 1],
    'azimuth': [0, 1]
}

def format_settings(settings: SoundSettings):

    parameters = {
        "cutoff": default_lims['cutoff'] if settings.filterCutOff else None,
        "volume": default_lims['volume'] if settings.volume else None,
        "azimuth": default_lims['azimuth'] if settings.leftRightPan else None
    }

    # Check which type of pitch lims are needed
    if settings.pitch:
        if settings.scale == 'None':
            parameters['pitch'] = default_lims['pitch_shift']
        else:
            parameters['pitch'] = default_lims['pitch']
    else:
        parameters['pitch'] = None
        

    # Remove any None entries in parameters
    parameters = {k: v for k, v in parameters.items() if v is not None}

    if settings.chordMode:
        music = 'chord'
        value = f"{settings.rootNote}{settings.quality}"
    else:
        music = 'scale'
        value = f"{settings.rootNote} {settings.scale}" if settings.scale != 'None' else None

    style = {
        "sound": settings.sound,
        "parameters": parameters if parameters else None,
        "chord_mode": "on" if settings.chordMode else "off",
        "chord": f"{settings.rootNote}{settings.quality}" if settings.chordMode else None,
        music: value
    }
    
    return style

@router.post("/upload-yaml/")
async def upload_yaml(file: UploadFile = File(...)):
    if not file.filename.endswith(('.yaml', '.yml')):
        return {"error": "Only YAML files are allowed"}
    
    contents = await file.read()
    try:
        parsed_yaml = yaml.safe_load(contents)
        # Save the file to a temporary location
        tmp_file_path = TMP_DIR / file.filename
        with open(tmp_file_path, 'wb') as f:
            f.write(contents)
    except yaml.YAMLError as e:
        return {"error": "Invalid YAML", "details": str(e)}

    return {"filepath": tmp_file_path, "parsed": parsed_yaml}

def load_settings_from_file():
    """Load settings from YAML file"""
    if not SETTINGS_FILE.exists():
        # Create default settings if file doesn't exist
        default_settings = {"data_resolution": 10}
        save_settings_to_file(default_settings)
        return default_settings
    
    try:
        with open(SETTINGS_FILE, 'r') as file:
            settings = yaml.safe_load(file) or {}
            return settings
    except Exception as e:
        print(f"Error loading settings: {e}")
        return {"data_resolution": 10}

def save_settings_to_file(settings: dict):
    """Save settings to YAML file"""
    try:
        with open(SETTINGS_FILE, 'w') as file:
            yaml.dump(settings, file, default_flow_style=False)
    except Exception as e:
        print(f"Error saving settings: {e}")
        raise

@router.get("/load-settings")
async def load_settings():
    """Endpoint to load current settings"""
    try:
        settings = load_settings_from_file()
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")

@router.post("/save-settings")
async def save_settings(settings: UserSettings):
    """Endpoint to save settings"""
    try:
        # Load existing settings
        current_settings = load_settings_from_file()
        
        # Update with new values
        current_settings.update(settings.model_dump())
        
        # Save back to file
        save_settings_to_file(current_settings)
        
        return {"message": "Settings saved successfully", "settings": current_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

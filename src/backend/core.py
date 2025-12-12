from fastapi import APIRouter, HTTPException, UploadFile, File, Cookie, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR, HYG_DATA
from strauss.sources import param_lim_dict
from sounds import all_sounds, online_sounds, local_sounds, asset_cache, format_name
from config import GITHUB_USER, GITHUB_REPO
from context import session_id_var
import logging, httpx, yaml, requests, os, base64, hashlib, uuid, aiofiles, zipfile, json, gc

import lightkurve as lk
import numpy as np
import matplotlib
matplotlib.use("Agg") 
import matplotlib.pyplot as plt
from io import BytesIO
from astroquery.simbad import Simbad


router = APIRouter(prefix='/core')

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)

class DataRequest(BaseModel):
    data_filepath: str

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

class SoundRequest(BaseModel):
    sound_name: str



class SonificationRequest(BaseModel):
    category: str
    data_filepath: str
    style_filepath: str
    duration: int
    system: str


@router.get('/session/')
async def get_or_create_session(
    response: Response,
    session_id: str | None = Cookie(None)
):
    if not session_id:
        session_id = str(uuid.uuid4())
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            # max_age=24*60*60,  # could use this to make sessions persist across days?
            samesite="none",
            secure=True,
            path='/'
        )

    user_dir = TMP_DIR / session_id
    user_dir.mkdir(exist_ok=True)

    return {'session_id': session_id}


@router.post('/generate-sonification/')
async def generate_sonification(request: SonificationRequest):

    session_id = session_id_var.get()

    if not session_id:
        raise HTTPException(status_code=400, detail="No session cookie found")

    category = request.category
    data = Path(request.data_filepath)
    style = Path(request.style_filepath)
    length = request.duration
    system = request.system

    if int(length) > 300:
        raise HTTPException(status_code=500, detail="Sonification too long, maximum length = 5 minutes.")

    try:
        soni = sonify(data, style, category, length, system)

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'{category}_{id}{ext}'
        filepath = os.path.join(TMP_DIR, session_id, filename)
        soni.save(filepath)

        return {'filename': filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get('/audio/{filename}')
async def get_audio(filename: str):

    session_id = session_id_var.get()
    filepath = TMP_DIR / session_id / filename
    ext = filepath.suffix.split('.')[1]

    return FileResponse(filepath, media_type=f"audio/{ext}")


@router.post('/upload-data/')
async def uploadData(file: UploadFile):
    """
    Function for the user to upload their own data to the system, which is then written
    to the tmp directory.

    - **file**: The user-uploaded data file.
    - Returns: The filepath of the saved data file.
    """
    
    ext = os.path.splitext(file.filename)[-1]
    filename = f'{uuid.uuid4()}{ext}'

    session_id = session_id_var.get()
    filepath = os.path.join(TMP_DIR, session_id, filename)

    contents = await file.read()

    with open(filepath, 'wb') as f:
        f.write(contents)

    return {'filepath': filepath}

@router.get('/suggested-data/{category}/')
async def get_suggested(category: str):

    data_dir = SUGGESTED_DATA_DIR / category
    
    if not data_dir.exists():
        raise HTTPException(status_code=404, detail=f'Suggested data directory for {category} not found')
    
    data_list = []

    for file in data_dir.glob('*.yml'):
        try:
            with open(file, 'r') as f:
                data = yaml.safe_load(f)
            name = data.get('name', str(file.stem))  # fallback to filename if 'name' missing
            desc = data.get('description')
        except Exception as e:
            print(f'Failed to read or parse {file}: {e}')
            continue

        filepaths = {
            'light_curves': os.path.join(str(data_dir), str(file.stem) + '.fits'),
            'constellations': HYG_DATA 
        }

        data = {'name': name,
                'description': desc,
                'filepath': filepaths[category]}

        data_list.append(data)
        
    return data_list

@router.get('/styles/{category}')
async def get_styles(category: str):

    styles_dir = STYLE_FILES_DIR / category
    if not styles_dir.exists():
        raise HTTPException(status_code=404, detail="Style directory not found")
    
    styles = []

    for file in styles_dir.glob("*.yml"):
        try:
            with open(file, "r") as f:
                data = yaml.safe_load(f)
            style_name = data.get("name", file.stem)  # fallback to filename if 'name' missing
            style_description = data.get("description", "")
        except Exception as e:
            print(f"Failed to read or parse {file}: {e}")
            continue

        style = {'name': style_name, 'description': style_description, 'filepath': str(file)}

        styles.append(style)

    return styles

@router.get('/sound_info/')
async def get_sound_info():
    return all_sounds()

@router.post('/preview-style-settings/{category}')
async def preview_style_settings(request: StylePreviewRequest, category: str):

    style = Path(request.style_filepath)

    # Generate simple ramp to sonify
    x = np.arange(0, 100) 
    y = x.copy()

    data = (x, y)

    print('hello')

    try:
        soni = sonify(data, style, category, length=5,  system='mono')

        print('soni generated')

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'{category}_{id}{ext}'
        session_id = session_id_var.get()
        filepath = os.path.join(TMP_DIR, session_id, filename)
        soni.save(filepath)

        return {'filename': filename}
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

    yaml_text = yaml.dump(style, default_flow_style=False)
    filename = f'style_{uuid.uuid4()}.yaml'
    session_id = session_id_var.get()
    filepath = os.path.join(TMP_DIR, session_id, filename)
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

    param_choices = {
        'cutoff': settings.filterCutOff,
        'pitch': settings.pitch,
        'volume': settings.volume,
        'azimuth': settings.leftRightPan
    }

    # Populate the list of parameters based on user selections
    parameters = [{'input': 'flux', 'output': k} for k, v in param_choices.items() if v]

    style = {
        "sound": settings.sound,
        "parameters": parameters
    }

    if settings.chordMode:
        style['harmony'] = f"{settings.rootNote}{settings.quality}"
    else:
        if settings.scale != 'None':
            style['harmony'] = f"{settings.rootNote} {settings.scale}"

    
    
    return style



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
    session_id = session_id_var.get()
    write_path = TMP_DIR / session_id / file_name

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


@router.post("/upload-yaml/")
async def upload_yaml(file: UploadFile = File(...)):
    if not file.filename.endswith(('.yaml', '.yml')):
        return {"error": "Only YAML files are allowed"}
    
    contents = await file.read()
    try:
        parsed_yaml = yaml.safe_load(contents)
        # Save the file to a temporary location
        session_id = session_id_var.get()
        tmp_file_path = TMP_DIR / session_id / file.filename
        with open(tmp_file_path, 'wb') as f:
            f.write(contents)
    except yaml.YAMLError as e:
        return {"error": "Invalid YAML", "details": str(e)}

    return {"filepath": tmp_file_path, "parsed": parsed_yaml}



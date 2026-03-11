from fastapi import APIRouter, HTTPException, UploadFile, File, Cookie, Response, Request
from fastapi.responses import FileResponse
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR, HYG_DATA
from strauss.sources import param_lim_dict
from sounds import all_sounds, online_sounds, local_sounds, asset_cache, format_name
from config import GITHUB_USER, GITHUB_REPO
from context import session_id_var
from utils import resolve_file
from request_models import DataRequest, SoundRequest, CustomStyleSettings, SonificationRequest
import logging, httpx, yaml, os, uuid, aiofiles, zipfile, traceback, filetype, pprint, numbers
import lightkurve as lk
from param_descriptions import INPUTS, OUTPUTS
from strauss.sources import param_lim_dict

import numpy as np
import pandas as pd
from io import BytesIO
from astropy.io import fits
from astropy.table import Table



router = APIRouter(prefix='/core')

logging.basicConfig(level=logging.DEBUG)
LOG = logging.getLogger(__name__)

# Useful constants for '/upload-data/' endpoint
ACCEPTED_UPLOAD_FORMATS = ['.csv', '.fits']
SESSION_QUOTA_MB = 50
SESSION_QUOTA_BYTES = SESSION_QUOTA_MB * 1024 * 1024

FORMATTED_FILENAMES = {
    'light_curves': 'Light Curve',
    'constellations': 'Constellation',
    'night_sky': 'Night Sky'
}


@router.get('/session/')
def get_or_create_session(
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

def get_session_size(session_dir: str) -> int:
    """Returns total size in bytes of all files in a session directory."""
    try:
        return sum(
            f.stat().st_size
            for f in Path(session_dir).rglob('*')
            if f.is_file()
        )
    except Exception as e:
        LOG.warning("Could not calculate session size: %s", e)
        return 0

@router.post('/generate-sonification/')
def generate_sonification(request: SonificationRequest):
        
    # Resolve data and style file names to actual paths in backend
    data_filepath = resolve_file(request.data_ref)
    style_filepath = resolve_file(request.style_ref)

    if int(request.duration) > 300:
        raise HTTPException(status_code=400, detail="Sonification too long, maximum length = 5 minutes.")

    try:
        
        soni = sonify(data_filepath, style_filepath, request.category, request.duration, request.system, request.observer)

        session_id = session_id_var.get()

        if not session_id:
            raise HTTPException(status_code=400, detail="No session cookie found")
        
        category = FORMATTED_FILENAMES[request.category]
        ext = '.wav'
        filename = f'{request.data_name} {category}{ext}'
        filepath = TMP_DIR / session_id / filename
        soni.save(filepath)

        file_ref = f'session:{filename}'

        return {'file_ref': file_ref}
    
    except HTTPException:
        raise
    except Exception as e:
        LOG.error("Error generating sonification:\n" + traceback.format_exc())
        raise
    

@router.get('/audio/{file_ref}')
def get_audio(file_ref: str):

    filepath = resolve_file(file_ref)
    file_name = file_ref.split(':')[-1]
    ext = filepath.suffix.lstrip('.')

    return FileResponse(path=filepath, 
                        filename=file_name,
                        media_type=f"audio/{ext}")


@router.get("/download")
def download_file(file_ref: str):

    file_path = str(resolve_file(file_ref))
    file_name = file_ref.split(':')[-1]
 
    response = FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/octet-stream",
    )

    response.headers["Cache-Control"] = "no-store, max-age=0"

    return response

def ensure_two_columns(ext: str, contents: bytes):
    
    if ext == ".csv":
        df = pd.read_csv(BytesIO(contents))

    elif ext == ".fits":
        with fits.open(BytesIO(contents)) as hdul:
            # find first table HDU
            table_hdu = next(
                (hdu for hdu in hdul if isinstance(hdu, (fits.BinTableHDU, fits.TableHDU))),
                None
            )

            if table_hdu is None:
                raise HTTPException(400, "FITS file contains no table")

            table = Table(table_hdu.data)
            df = table.to_pandas()

    else:
        raise HTTPException(415, "Unsupported file format")
    
    # Flag to send to the frontend to inform user that data was sliced
    reduced = False

    if df.shape[1] < 2:
        raise HTTPException(400, "Dataset must contain at least two columns")
    elif df.shape[1] > 2:
        # reduce to first two columns if needed
        df = df.iloc[:, :2]
        reduced = True
        
    # If there are no meaningful headers, assign default names
    if all(isinstance(col, numbers.Number) for col in df.columns):
        df.columns = ["Column 1", "Column 2"]

    return df, reduced


@router.post('/upload-data/')
async def uploadData(file: UploadFile, request: Request):
    """
    Function for the user to upload their own data to the system, which is then written
    to the tmp directory. The maximum file size is 10mb, as this is a limit set in nginx.

    - **file**: The user-uploaded data file.
    - Returns: The filepath of the saved data file.
    """

    # Client details for logging
    ip = request.client.host
    session_id = session_id_var.get()

    LOG.info(
        "Upload attempt | filename=%s | session=%s | ip=%s",
        file.filename,
        session_id,
        ip
    )

    suffixes = Path(file.filename).suffixes

    # Check for multiple extensions
    if len(suffixes) != 1:
        LOG.warning(
            "Upload rejected | filename=%s | reason=multiple_extensions | session=%s | ip=%s",
            file.filename,
            session_id,
            ip
        )
        raise HTTPException(400, "Files with multiple extensions are not allowed")

    ext = suffixes[0].lower()

    if ext not in ACCEPTED_UPLOAD_FORMATS:
        LOG.warning(
            "Upload rejected | ext=%s | reason=rejected_extension | session=%s | ip=%s",
            ext,
            session_id,
            ip
        )
        raise HTTPException(
            status_code=415,
            detail='Uploaded data must be in .csv or .fits format'
        )

    MAX_SIZE = 10 * 1024 * 1024

    contents = await file.read()
    await file.close()

    # Check for empty file
    if not contents:
        LOG.warning(
            "Upload rejected | reason=empty_file | session=%s | ip=%s",
            session_id,
            ip
        )
        raise HTTPException(400, "Uploaded file is empty")

    # Double check the file size isn't > 10mb
    if len(contents) > MAX_SIZE:
        LOG.warning(
            "Upload rejected | size=%d | reason=file_too_large | session=%s | ip=%s",
            len(contents),
            session_id,
            ip
        )
        raise HTTPException(400, "File too large")

    # Check CSV is actually text
    if ext == ".csv":
        try:
            contents.decode('utf-8')
        except UnicodeDecodeError:
            LOG.warning(
            "Upload rejected | reason=invalid_csv | session=%s | ip=%s",
            session_id,
            ip
        )
        raise HTTPException(415, "Invalid CSV file")
        
    # Check that magic bytes match expected type for FITS
    kind = filetype.guess(contents)
    mime = kind.mime if kind else None

    if ext == ".fits" and mime not in ["application/fits", "image/fits", "application/octet-stream"]:
        LOG.warning(
            "Upload rejected | mime=%s | reason=invalid_fits_mime | session=%s | ip=%s",
            mime,
            session_id,
            ip
        )
        raise HTTPException(415, "Invalid FITS file")

    # Check that the uploaded data is only two columns (x,y) and reduce if necessary
    df, reduced = ensure_two_columns(ext, contents)

    # Create random ID to store file under
    new_name = f"{uuid.uuid4()}.csv"

    # Ensure session directory exists
    session_dir = os.path.join(TMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Check session quota
    current_usage = get_session_size(session_dir)
    if current_usage + len(contents) > SESSION_QUOTA_BYTES:
        LOG.warning(
            "Upload rejected | reason=quota_exceeded | usage=%d | file_size=%d | session=%s | ip=%s",
            current_usage,
            len(contents),
            session_id,
            ip
        )
        raise HTTPException(429, f"Session storage quota of {SESSION_QUOTA_MB}MB exceeded")

    filepath = os.path.join(session_dir, new_name)

    # Write to new csv file
    df.to_csv(filepath, index=False)

    LOG.info(
        "Upload success | original=%s | stored=%s | size=%d | session=%s | ip=%s",
        file.filename,
        new_name,
        len(contents),
        session_id,
        ip
    )

    file_ref = f"session:{new_name}"

    return {"file_ref": file_ref, "reduced": reduced}


def round_range(range: list, dp: int = 2) -> list:
    return [round(float(v), dp) for v in range]


@router.get('/get-inputs/')
def get_inputs(file_ref: str):
    
    filepath = str(resolve_file(file_ref))
    
    if filepath.endswith('.csv'):
        df = pd.read_csv(filepath)
        
        # If all column names are numeric, the data likely has no headers
        if all(str(col).replace('.', '').replace('-', '').isnumeric() for col in df.columns):
            df = pd.read_csv(filepath, header=None)
            df.columns = [f"Column {i + 1}" for i in range(len(df.columns))]
            
        inputs = [
            {
                'name': col, 
                'desc': INPUTS.get(col.lower(), '')
            }
            for col in df.columns
        ]
        
    elif filepath.endswith('.fits'):
        
        lc = lk.read(filepath)
        time = lc.time.value
        flux = lc.flux.value
        # Mask NaN values in flux
        flux = flux[~np.isnan(flux)]
 
        inputs = [
            {
                'name': 'Time', 
                'desc': ''
            },
            {
                'name': 'Flux',
                'desc': INPUTS['flux']
            }
        ]
    
    else:
        raise HTTPException(415, "Unsupported file format")

    return inputs

@router.get('/get-outputs/')
def get_outputs():
    # Return names and descriptions of output parameters
    return [{'name': k.capitalize(), 'desc': v} for k, v in OUTPUTS.items()]
        
    

@router.get('/suggested-data/{category}/')
def get_suggested(category: str):

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
            ra = data.get('ra', None)
            dec = data.get('dec', None)
        except Exception as e:
            print(f'Failed to read or parse {file}: {e}')
            continue

        filenames = {
            'light_curves': str(file.stem) + '.fits',
            'constellations': 'hyg.csv'
        }

        file_ref = f'suggested_data:{category}:{filenames[category]}'

        data = {'name': name,
                'description': desc,
                'file_ref': file_ref}
        
        if ra is not None and dec is not None:
            data['ra'] = ra
            data['dec'] = dec

        data_list.append(data)
        
    return data_list

@router.get('/styles/{category}')
def get_styles(category: str):

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

        file_ref = f'style_files:{category}:{file.name}'

        style = {'name': style_name, 'description': style_description, 'file_ref': file_ref}

        styles.append(style)

    return styles

@router.get('/sound_info/')
def get_sound_info():
    return all_sounds()

@router.post('/preview-style-settings/{category}')
def preview_style_settings(request: DataRequest, category: str):

    style = resolve_file(request.file_ref)

    # Generate simple ramp to sonify
    x = np.arange(0, 100) 
    y = x.copy()

    data = (x, y)

    try:
        soni = sonify(data, style, category, length=5,  system='mono')


        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'{category}_{id}{ext}'
        session_id = session_id_var.get()
        filepath = os.path.join(TMP_DIR, session_id, filename)
        soni.save(filepath)

        file_ref = f'session:{filename}'

        return {'file_ref': file_ref}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    
@router.post('/save-sound-settings/')
def save_sound_settings(settings: CustomStyleSettings):
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

    file_ref = f'session:{filename}'

    # Return the file reference
    return {'file_ref': file_ref}

def format_settings(settings: CustomStyleSettings):
    
    # Remove null entries
    params = [{k: v for k, v in m.items() if v is not None} for m in settings.map]
        
    style = {
        "sound": settings.sound,
        "parameters": params
    }

    if settings.chordMode:
        style['harmony'] = f"{settings.rootNote}{settings.quality}"
    else:
        if settings.scale != 'None':
            style['harmony'] = f"{settings.rootNote} {settings.scale}"
            
    print(style)
    
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
    
    file_ref = f'session:{file.filename}'

    return {"file_ref": file_ref, "parsed": parsed_yaml}



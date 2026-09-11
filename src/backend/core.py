from fastapi import APIRouter, HTTPException, UploadFile, File, Cookie, Response, Request, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SYNTHS_DIR, SAMPLES_DIR
from context import session_id_var
from utils import resolve_file, read_YAML_file, write_YAML_file, is_synth, write_sound_to_style, is_time_series, cleanup_old_layers
from generator_mods import GENERATOR_MODS
from request_models import DataRequest, CustomStyleSettings, LayerRequest, SonificationRequest, SoundInfo, VolumeRequest
import logging, yaml, os, uuid, traceback, base64, gc, re, csv, shutil, math, tempfile, pickle
from param_descriptions import INPUTS, OUTPUTS
from night_sky import handle_observer
from analytics import log_event
from strauss import AudioFigure

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg") 
from matplotlib.figure import Figure
from scipy.io import wavfile
from scipy.signal import spectrogram, resample_poly
from io import BytesIO
from pydub import AudioSegment


router = APIRouter(prefix='/core')

logging.basicConfig(level=logging.DEBUG)
LOG = logging.getLogger(__name__)

# Maximum upload quota per session
UPLOAD_QUOTA_MB = 50
UPLOAD_QUOTA_BYTES = UPLOAD_QUOTA_MB * 1024 * 1024

FORMATTED_FILENAMES = {
    'light_curves': 'Light Curve',
    'constellations': 'Constellation',
    'night_sky': 'Night Sky',
    'data_composer': 'Data Composer'
}

MASTER_VOL = 0.5


@router.get('/session/')
def get_or_create_session(
    connection: Request,
    response: Response,
    session_id: str | None = Cookie(None),
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
        log_event(session_id=session_id, ip=connection.client.host, event='session_start')
        

    user_dir = TMP_DIR / session_id
    user_dir.mkdir(exist_ok=True)

    return {'session_id': session_id}

def get_uploads_dir_size(uploads_dir: str) -> int:
    """Returns total size in bytes of all files in a session's uploads directory."""
    try:
        return sum(
            f.stat().st_size
            for f in Path(uploads_dir).rglob('*')
            if f.is_file()
        )
    except Exception as e:
        LOG.warning("Could not calculate session size: %s", e)
        return 0


@router.post('/generate-sonification/')
def generate_sonification(request: SonificationRequest, connection: Request):
    
    session_id = session_id_var.get()
    
    if not session_id:
        raise HTTPException(status_code=400, detail="No session cookie found")
    
    session_dir = TMP_DIR / session_id
    
    if request.duration > 60:
        raise HTTPException(status_code=400, detail="Sonification too long, maximum length is 1 minute.")
    
    # Check if we are sonifying star data (we use this to label the mapping table)
    is_stars = request.soni_type in ['constellations', 'night_sky']
    
    # Initialise AudioFigure
    fig = AudioFigure(system=request.system)
    
    for i, layer in enumerate(request.layers, start=1):
        
        # Resolve data and style file names to actual paths in backend
        data_filepath = resolve_file(layer.data_ref)
        style_filepath = resolve_file(layer.style_ref)
        
        try:
            
            # First, replace base sound name with filepath to the sound
            style_dict = write_sound_to_style(style_filepath, write_to_yml=False)
            
            # Next, validate data format and convert to DataFrame
            data_type = data_filepath.suffix.lower()
                    
            if data_type == '.csv':
                    df = pd.read_csv(str(data_filepath), header=0)
            else:
                    raise ValueError(f'{data_type} file type not suitable for sonification, please use .csv.')
                
            # Determine whether it is safe to downsample the data
            if is_time_series(df, style_dict):
                 style_dict['max_notes_per_sec'] = style_dict.get('max_notes_per_sec') or 10
            
            # Overwrite any time mappings if using a custom star order for constellations
            if request.soni_type == 'constellations' and 'custom_order' in df.columns:
                for m in style_dict['map']:
                    if m['output'] == 'time':
                        m['input'] = 'custom_order'
                        m['function'] = None # Remove any previous invert functions
                        break
                        
            # Build dict with keyword arguments for sonification function
            kwargs = {
                'duration': request.duration,
                'angle_unit': 'degrees' # use degrees as standard for azimuth/polar
            }
            
            # Handle case that 'Place on Dome' feature is used
            if request.observer:
                position_info = handle_observer(request.observer)
                
                # Remove any existing spatial mappings
                style_dict['map'] = [mapping for mapping in style_dict['map'] 
                                        if mapping['output'] not in ['azimuth', 'polar', 'pan']]
                
                # Add fixed values to kwargs
                if request.system == 'stereo':
                    # Use pan
                    kwargs['fix_pan'] = position_info['STRAUSS_inputs']['pan']
                elif request.system in ['5.1', '7.1']:
                    # Use Azimuth and Polar
                    for param in ['azimuth', 'polar']:
                        kwargs[f'fix_{param}'] = position_info['STRAUSS_inputs'][param]
                else:
                    raise ValueError("Place on Dome feature not available for mono audio")
                
                # Get altitude and azimuth values in degrees to send to the frontend to display    
                alt_az = [position_info['display_values'][value] for value in ['altitude', 'azimuth']]
            else:
                alt_az = None

            # Add identifier column for mapping table if necessary
            if request.soni_type == 'data_composer' and layer.id_column:
                source_names = df[layer.id_column].to_list()
            elif is_stars:
                source_names = df['display_name'].to_list()
            else:
                source_names = None
                
            kwargs['source_names'] = source_names
                            
            # Add style to kwargs
            kwargs['style'] = str(write_YAML_file(style_dict))
            
            # Add layer to the AudioFigure and sonify
            soni = fig.sonify(df, **kwargs)
            
            if layer.volume != 1:
                # Set initial volume if not 1 (default)
                fig.set_level(name=f'sonification_{i}', level=layer.volume)
            
            # Get the mapping table(s)
            source_name = 'source_0' if style_dict['sources'].lower() == 'objects' else None
            table: pd.DataFrame = fig.get_table(name=f'sonification_{i}', source=source_name)
            
            if is_stars:
                table.rename(columns={'Source': 'Star Name'}, inplace=True)
                # Add Hipparcos IDs
                table['HIP'] = table['Star Name'].map(
                    df.set_index('display_name')['hip']
                )
                
                # Move the column next to display name
                cols = list(table.columns)
                cols.remove(('HIP', ''))
                cols.insert(cols.index(('Star Name', '')) + 1, ('HIP', ''))
                table = table[cols]
                
            if request.observer:
                fixed_table = fig.get_fixed_table(name=f'sonification_{i}', source=source_name)
                # Add each fixed parameter as a column in main mapping table
                for _, row in fixed_table.iterrows():
                    parameter = row['parameter']
                    value = row['value']
                    unit = row['unit']
                    unit_header = f'[{unit}]' if unit else ''
                    table[(parameter, unit_header)] = value
            
            # Save mapping table to CSV
            table_path = session_dir / f'mapping_table_{i}.csv'
            table.to_csv(table_path, index=False)
            
            n_layers = len(request.layers)
            
            if n_layers > 1:
                # Save individual layers so users can download them if desired
                soni.render(progress=False)
                layer_name = f'layer_{i}.wav'
                layer_path = session_dir / layer_name
                soni.save(layer_path)
            
        except HTTPException:
            raise
        
        except Exception as e:
            LOG.error("Error generating sonification:\n" + traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"{type(e).__name__}: {str(e)}"
            )
    
    filename = 'audio_figure.wav'
    filepath = session_dir / filename
    fig.save(filepath)
    
    log_event(session_id=session_id, ip=connection.client.host, event='sonification_generated', sonification_type=request.soni_type)
    cleanup_old_layers(session_id, n_layers)

    file_ref = f'session:{filename}'

    return {'file_ref': file_ref, 'alt_az': alt_az}
    
    
@router.post('/generate-spectrogram/')
def generate_spectrogram(request: DataRequest):

    filepath = resolve_file(request.file_ref)

    try:
  
        sr, data = wavfile.read(str(filepath))
        
        #Frequency parameters
        freq_min = 20
        freq_max = 22000

        # Convert to mono if stereo
        if data.ndim > 1:
            data = data.mean(axis=1)

        # Normalise to float
        data = data.astype(np.float32) / np.iinfo(np.int32).max
        
        target_sr = 22050

        # Downsample
        if sr != target_sr:
            
            gcd = np.gcd(sr, target_sr)
            up = target_sr // gcd
            down = sr // gcd

            data = resample_poly(data, up, down)
            sr = target_sr
            
        freq_max = sr // 2
        
        duration = len(data) / sr
        nperseg = 2048 if duration < 30 else 1024
        noverlap = nperseg // 2

        freqs, times, Sxx = spectrogram(
            data,
            fs=sr,
            window='hann',
            nperseg=nperseg,
            noverlap=noverlap,
            scaling='spectrum'
        )

        # Convert to dB
        Sxx_dB = 10 * np.log10(Sxx / np.max(Sxx) + 1e-12)

        fig = Figure(figsize=(6, 4))
        ax = fig.add_subplot(111)
        
        ax.pcolormesh(
            times,
            freqs,
            Sxx_dB,
            shading='gouraud',
            cmap='gnuplot2',
            vmin=None,
            vmax=None
        )

        ax.set_xlabel('Time (s)')
        ax.set_yscale('log')
        ax.set_ylim(freq_min, freq_max)
        ax.set_ylabel('Frequency (Hz)')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)

        buf = BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')

        buf.close()
        gc.collect()

    except Exception as e:
        LOG.error("Error generating spectrogram:\n" + traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")
    
    return {'image': img_base64}

@router.get('/audio/{file_ref}')
def get_audio(
    connection: Request, 
    background_tasks: BackgroundTasks, 
    file_ref: str, 
    name: str, 
    audio_format: str = 'wav', 
    volume: float = 1
    ):
    
    audio_format = audio_format.lower()
    
    if audio_format not in {"wav", "mp3"}:
        raise HTTPException(
            status_code=400,
            detail="Audio format must be 'wav' or 'mp3'"
        )
    
    if not 0 <= volume <= 1:
        raise HTTPException(status_code=400, detail="Volume must be between 0 and 1")

    wav_path = str(resolve_file(file_ref))

    # Original file can be returned directly when volume is unchanged
    if volume == 1:
        file_path = wav_path

    else:
        # Create temporary volume-adjusted WAV
        temp_file = tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False,
        )
        temp_file.close()

        volume_path = temp_file.name
        apply_volume(wav_path, volume, volume_path)
        
        # Delete temporary audio file once it's served
        background_tasks.add_task(Path(volume_path).unlink, missing_ok=True)
        file_path = volume_path
    
    # Convert to MP3 if requested        
    if audio_format == "mp3":
        mp3_path = convert_to_mp3(file_path)
        background_tasks.add_task(Path(mp3_path).unlink, missing_ok=True) # Delete temp mp3 after serving
        file_path = mp3_path
    
    # Log download event in analytics
    log_event(session_id=session_id_var.get(), ip=connection.client.host, event='audio_download')

    return FileResponse(path=file_path, 
                        filename=f'{name}.{audio_format}',
                        media_type="audio/mpeg" if audio_format == "mp3" else "audio/wav")
    
@router.post('/mix-layer-volumes/')
def mix_layer_volumes(request: VolumeRequest):
    
    if all(vol == 1 for vol in request.volumes):
        # return original master if volumes all reset to 1
        return {'file_ref': 'session:audio_figure.wav'}
    
    session_id = session_id_var.get()
    session_dir = TMP_DIR / session_id
    audio_figure_path = session_dir / 'audio_figure.wav'
    
    audio_figure = AudioSegment.from_wav(audio_figure_path)
    
    # Create blank audio segment with same attributes as audio figure
    master = AudioSegment.silent(duration=len(audio_figure), frame_rate=audio_figure.frame_rate)
    
    for i, vol in enumerate(request.volumes, start=1):
        
        if vol == 0:
            # Don't add silent layers
            continue
        
        layer_path = session_dir / f"layer_{i}.wav"
        layer_audio = AudioSegment.from_wav(layer_path)
        
        gain_db = 20 * math.log10(vol)
        adjusted = layer_audio + gain_db -5.0 # Add 5db headroom to avoid clipping
        
        master = master.overlay(adjusted)

    master_path = session_dir / "audio_figure_mixed.wav"
    master.export(master_path, format='wav')
    
    return {'file_ref': 'session:audio_figure_mixed.wav'}
    
def apply_volume(wav_path: str, volume: float, output_path: str) -> None:
    if not 0 <= volume <= 1:
        raise ValueError("Volume must be between 0 and 1")

    audio = AudioSegment.from_wav(wav_path)

    if volume == 0:
        audio = AudioSegment.silent(duration=len(audio), frame_rate=audio.frame_rate)
    else:
        gain_db = 20 * math.log10(volume)
        audio = audio + gain_db

    audio.export(output_path, format="wav")

def convert_to_mp3(wav_file: str) -> str:
    """
    Convert a WAV file to an MP3.

    Args:
        wav_file: Path to the WAV file.

    Returns:
        Path to the temporary MP3 file.

    Raises:
        FileNotFoundError: If the WAV file does not exist.
        ValueError: If the input file is not a WAV.
        RuntimeError: If FFmpeg cannot be found.
    """
    wav_path = Path(wav_file)

    if not wav_path.exists():
        raise FileNotFoundError(f"WAV file not found: {wav_path}")

    if wav_path.suffix.lower() != ".wav":
        raise ValueError(f"Expected a .wav file, got {wav_path.suffix}")

    # Find FFmpeg
    system_ffmpeg = shutil.which("ffmpeg")

    if system_ffmpeg:
        # Production/Linux server
        AudioSegment.converter = system_ffmpeg
    else:
        # Development/Windows
        local_ffmpeg = r"C:\Users\ngc133\ffmpeg\bin\ffmpeg.exe"

        if not Path(local_ffmpeg).exists():
            raise RuntimeError(
                "FFmpeg is not installed or could not be found in this environment."
            )

        AudioSegment.converter = local_ffmpeg

    temp_file = tempfile.NamedTemporaryFile(
                suffix=".mp3",
                delete=False,
            )
    temp_file.close()

    mp3_path = temp_file.name
    
    audio = AudioSegment.from_wav(wav_path)

    try:
        audio.export(
            mp3_path,
            format="mp3",
            bitrate="320k"
        )
    except Exception:
        # Remove any partially-created/corrupt MP3
        if mp3_path.exists():
            mp3_path.unlink()
        raise

    return str(mp3_path)
    

@router.get("/download/{file_ref}")
def download_file(file_ref: str, name: str | None = None):

    file_path = str(resolve_file(file_ref))
    file_name = name or file_ref.split(':')[-1]
 
    response = FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/octet-stream",
    )

    response.headers["Cache-Control"] = "no-store, max-age=0"

    return response


@router.post('/upload-data/')
async def upload_data(file: UploadFile, request: Request):
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

    if ext != '.csv':
        LOG.warning(
            "Upload rejected | ext=%s | reason=rejected_extension | session=%s | ip=%s",
            ext,
            session_id,
            ip
        )
        raise HTTPException(
            status_code=415,
            detail='Uploaded data must be in .csv format'
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

    # Ensure session directory exists
    session_dir = os.path.join(TMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Ensure uploads directory exists
    uploads_dir = os.path.join(session_dir, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Check session's upload quota
    current_usage = get_uploads_dir_size(uploads_dir)
    if current_usage + len(contents) > UPLOAD_QUOTA_BYTES:
        LOG.warning(
            "Upload rejected | reason=quota_exceeded | usage=%d | file_size=%d | session=%s | ip=%s",
            current_usage,
            len(contents),
            session_id,
            ip
        )
        raise HTTPException(429, f"Session upload quota of {UPLOAD_QUOTA_MB}MB exceeded")

    # Create random ID to store file under
    new_name = f"{uuid.uuid4()}.csv"
    filepath = os.path.join(uploads_dir, new_name)
    
    # Write to new csv file
    with open(filepath, "wb") as f:
        f.write(contents)

    LOG.info(
        "Upload success | original=%s | stored=%s | size=%d | session=%s | ip=%s",
        file.filename,
        new_name,
        len(contents),
        session_id,
        ip
    )

    file_ref = f"session:uploads:{new_name}"

    return {"file_ref": file_ref}


def round_range(range: list, dp: int = 2) -> list:
    return [round(float(v), dp) for v in range]


@router.get('/get-inputs/')
def get_inputs(file_ref: str, soni_type: str, user_upload: bool = False ):
    
    filepath = str(resolve_file(file_ref))
    
    if filepath.endswith('.csv') and user_upload:
        df = pd.read_csv(filepath, header=0)
        
        # Find which columns contain numeric data
        numeric_cols = df.select_dtypes(include="number").columns
            
        inputs = [
            {
                'name': col, 
                'desc': '',
                'key': col,
                'numeric': col in numeric_cols
            }
            for col in df.columns
        ]

    else:   
        inputs = [
            {
                'name': INPUTS[soni_type][col]['name'], 
                'desc': INPUTS[soni_type][col]['desc'],
                'key': col,
                'numeric': True
            }
            for col in INPUTS[soni_type]
        ]
        
        # Add custom order column if user has chosen a custom constellation order
        if soni_type == 'constellations' and 'custom_order' in pd.read_csv(filepath).columns:
            inputs.append(
                    {
                    'name': 'Custom Order',
                    'desc': 'Your chosen star order - map this to Time',
                    'key': 'custom_order',
                    'numeric': True
                    }
            )

    return inputs

@router.get('/get-outputs/')
def get_outputs():
    return [
        {'name': v['name'], 'desc': v['desc'], 'key': k}
        for k, v in OUTPUTS.items()
    ]
        

@router.get('/suggested-data/{soni_type}/')
def get_suggested(soni_type: str):

    data_dir = SUGGESTED_DATA_DIR / soni_type
    
    if not data_dir.exists():
        raise HTTPException(status_code=404, detail=f'Suggested data directory for {soni_type} not found')
    
    data_list = []

    for file in data_dir.glob('*.yml'):
        try:
            with open(file, 'r') as f:
                data = yaml.safe_load(f)
            name = data.get('name', str(file.stem))  # fallback to filename if 'name' missing
            desc = data.get('description')
            ra = data.get('ra', None)
            dec = data.get('dec', None)
            category = data.get('category', None)
        except Exception as e:
            print(f'Failed to read or parse {file}: {e}')
            continue

        filenames = {
            'light_curves': str(file.stem) + '.csv',
            'constellations': 'hyg.csv'
        }

        file_ref = f'suggested_data:{soni_type}:{filenames[soni_type]}'

        data = {'name': name,
                'description': desc,
                'ra': ra,
                'dec': dec,
                'file_ref': file_ref,
                'category': category
                }

        data_list.append(data)
        
    return data_list

@router.get('/styles/{soni_type}')
def get_styles(soni_type: str):

    styles_dir = STYLE_FILES_DIR / soni_type
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

        file_ref = f'style_files:{soni_type}:{file.name}'

        style = {'name': style_name, 'description': style_description, 'file_ref': file_ref}

        styles.append(style)

    return styles

def get_sounds():
      
    local_sounds = []
    
    for f in SYNTHS_DIR.iterdir():
        if f.is_file():
            composable = f.stem != 'White Noise'
            data_modes = ['continuous', 'discrete']
            sound = SoundInfo(name=f.stem, composable=composable, data_modes=data_modes)
            local_sounds.append(sound)
            
    # List of sound names that are only suitable for Events (discrete) sonifications
    SHORT_SAMPLES = ['Glockenspiel', 'Mallets', 'Harp']

    for f in SAMPLES_DIR.iterdir():
        if f.is_dir():
            name = f.stem
    
            files = [file for file in f.iterdir() if file.is_file()]

            # Composable if:
            # 1) The directory contains a .sf2 file
            # 2) OR the directory contains multiple files
            composable = (
                any(file.suffix == ".sf2" for file in files)
                or len(files) > 1
            )

            # We are essentially hardcoding which sounds are suitable for Events vs Objects,
            # so if more sounds are added in the future, this categorisation may need to change.
            data_modes = ['discrete'] if name in SHORT_SAMPLES else ['continuous']
          
            sound = SoundInfo(name=name, composable=composable, data_modes=data_modes)
            local_sounds.append(sound)
      
    return local_sounds

@router.get('/sound_info/')
def get_sound_info():
    return get_sounds()

@router.post('/preview-style-settings/')
def preview_style_settings(request: DataRequest):

    # Resolve style ref to path and swap sound name for full filepath
    style = resolve_file(request.file_ref)
    style_dict = write_sound_to_style(style, write_to_yml=False)
    
    # Generate synthetic data for previews
    N = 100 if style_dict["sources"] == "objects" else 50
    
    args = []
    
    for mapping in style_dict["map"]:
        output = mapping["output"]

        if output in ["time", "time_evo"]:
            # Use linear function for time
            args.append(np.linspace(0, 1, N))
        else:
            # Sine wave for all other parameters 
            x = np.linspace(0, np.pi, N) 
            args.append(np.sin(x))
    
    style_file = str(write_YAML_file(style_dict))

    try:
        fig = AudioFigure()
        fig.sonify(*args, style=style_file, duration=5)

        id = str(uuid.uuid4().hex)
        ext = '.wav'
        filename = f'preview_{id}{ext}'
        session_id = session_id_var.get()
        filepath = os.path.join(TMP_DIR, session_id, filename)
        fig.save(filepath)

        file_ref = f'session:{filename}'

        return {'file_ref': file_ref}
    except Exception:
        traceback.print_exc()
        raise
    
@router.post('/save-style-settings/')
def save_style_settings(settings: CustomStyleSettings):
    """
    Save sound settings for the sonification.

    - **settings**: The sound settings to be saved.
    - Returns: A filename of the saved settings.
    """
    # Save settings to a yaml file and return the filename
    style = format_style(settings)
    filepath = write_YAML_file(style)

    file_ref = f'session:{filepath.name}'

    # Return the file reference
    return {'file_ref': file_ref}

def format_style(settings: CustomStyleSettings):

    sources = 'objects' if settings.dataMode == 'continuous' else 'events'
    
    for m in settings.map:
        
        # If using custom data, swap 'column 1' etc for 0-indexed column index (e.g. 'column 1' -> 0)
        if re.fullmatch(r"column \d+", m["input"]):
            m["input"] = int(m["input"].split()[-1]) - 1
            
        if m['output'] == 'time':
            if sources == 'objects':
                # Swap time for time_evo if using Objects
                m['output'] = 'time_evo'
            else:
                # Add extra time for Events to play out
                m['input_range'] = ['0%', '110%']
                
        elif m['output'] == 'pitch':
            # Swap pitch for pitch_shift if Objects, or Events with no notes given
            if sources == 'objects' or not settings.notes:
                m['output'] = 'pitch_shift'
                lims = m['output_range'] or [0, 1]
                m['output_range'] = [x*24 for x in lims] # Rescale 0-1 to 0-24 semitones (STRAUSS range for pitch_shift)        
        
    # Set up Generator dictionary
    gen_type, sound_key = (
        ("synthesizer", "preset")
        if is_synth(settings.sound)
        else ("sampler", "sample")
    )
        
    generator = {
        'type': gen_type,
        sound_key: settings.sound
    }

    mods = GENERATOR_MODS.get(settings.sound)
    if mods:
        generator["mods"] = mods
    
    
    # Build final style dict
    style = {
        "name": "Custom",
        "sources": sources,
        "generator": generator,
        "map": settings.map,
        "notes": settings.notes,
        "metadata": settings.metadata.model_dump()
    }
    
    # Add additional fields for Events
    if sources == 'events':
        style['pitch_binning'] = 'uniform'
    
    return style

@router.post("/convert-style-to-settings/")
def convert_style_to_settings(request: DataRequest):
    
    style_path = str(resolve_file(request.file_ref))
    style: dict = read_YAML_file(style_path)
    
    settings = {
        'data_mode': 'continuous' if style['sources'] == 'objects' else 'discrete',
        'sound_name': style['generator'].get('preset') or style['generator'].get('sample'),
    }
    
    for k in ['map', 'notes', 'metadata']:
        settings[k] = style[k]
        
    return settings

@router.post("/upload-style/")
async def upload_style(file: UploadFile = File(...), request: Request = None):

    ip = request.client.host
    session_id = session_id_var.get()

    LOG.info(
        "Style upload attempt | filename=%s | session=%s | ip=%s",
        file.filename,
        session_id,
        ip
    )

    # Check for multiple extensions
    suffixes = Path(file.filename).suffixes
    if len(suffixes) != 1:
        LOG.warning(
            "Style upload rejected | filename=%s | reason=multiple_extensions | session=%s | ip=%s",
            file.filename, session_id, ip
        )
        raise HTTPException(400, "Files with multiple extensions are not allowed")

    ext = suffixes[0].lower()
    if ext not in {'.yaml', '.yml'}:
        LOG.warning(
            "Style upload rejected | ext=%s | reason=rejected_extension | session=%s | ip=%s",
            ext, session_id, ip
        )
        raise HTTPException(415, "Uploaded style must be in .yaml or .yml format")

    MAX_SIZE = 1 * 1024 * 1024  # 1MB limit as style files should be very small

    contents = await file.read()
    await file.close()

    if not contents:
        LOG.warning(
            "Style upload rejected | reason=empty_file | session=%s | ip=%s",
            session_id, ip
        )
        raise HTTPException(400, "Uploaded file is empty")

    if len(contents) > MAX_SIZE:
        LOG.warning(
            "Style upload rejected | size=%d | reason=file_too_large | session=%s | ip=%s",
            len(contents), session_id, ip
        )
        raise HTTPException(400, "File too large")

    # Validate YAML
    try:
        contents.decode('utf-8')
    except UnicodeDecodeError:
        LOG.warning(
            "Style upload rejected | reason=invalid_utf8 | session=%s | ip=%s",
            session_id, ip
        )
        raise HTTPException(415, "File does not appear to be a valid YAML file")

    try:
        parsed_yaml = yaml.safe_load(contents)
        style_name = parsed_yaml.get('name', 'Custom')
        style_description = parsed_yaml.get('description', "")
    except yaml.YAMLError as e:
        LOG.warning(
            "Style upload rejected | reason=invalid_yaml | session=%s | ip=%s",
            session_id, ip
        )
        raise HTTPException(415, f"Invalid YAML: {str(e)}")

    # Ensure session directory exists
    session_dir = os.path.join(TMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Ensure uploads directory exists
    uploads_dir = os.path.join(session_dir, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)

    # Check session quota
    current_usage = get_uploads_dir_size(uploads_dir)
    if current_usage + len(contents) > UPLOAD_QUOTA_BYTES:
        LOG.warning(
            "Style upload rejected | reason=quota_exceeded | usage=%d | file_size=%d | session=%s | ip=%s",
            current_usage, len(contents), session_id, ip
        )
        raise HTTPException(429, f"Session upload quota of {UPLOAD_QUOTA_MB}MB exceeded")

    new_name = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(uploads_dir, new_name)

    with open(filepath, 'wb') as f:
        f.write(contents)

    LOG.info(
        "Style upload success | original=%s | stored=%s | size=%d | session=%s | ip=%s",
        file.filename,
        new_name,
        len(contents),
        session_id,
        ip
    )

    file_ref = f"session:uploads:{new_name}"
    
    return {"file_ref": file_ref, "style_name": style_name, "style_description": style_description}
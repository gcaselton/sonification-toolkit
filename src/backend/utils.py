from pathlib import Path
from context import session_id_var
from paths import TMP_DIR, BACKEND_DIR, SYNTHS_DIR, SAMPLES_DIR
from fastapi import HTTPException
from pychord import Chord
from pychord.utils import transpose_note
from strauss.notes import notesharps
import os, yaml, uuid, random, re
import pandas as pd
import numpy as np

def resolve_file(file_ref: str) -> Path:
    """
    Helper function to resolve a file reference to it's full filepath in the backend.

    :param file_ref: The reference of the requested file e.g. 'suggested_data:light_curves:Sci-Fi.yml'
    :type file_ref: str
  
    :return: The full filepath of the requested file
    :rtype: Path
    """
    
    ref_parts = file_ref.split(':')

    if ref_parts[0] == 'session':

        session_id = session_id_var.get()
        
        if not session_id:
            raise HTTPException(status_code=400, detail="No session cookie found")
        
        if ref_parts[1] == 'uploads':
            path = TMP_DIR / session_id / 'uploads' / ref_parts[-1]
        else:
            path = TMP_DIR / session_id / ref_parts[-1]
    
    else:
        path = BACKEND_DIR / ref_parts[0] / ref_parts[1] / ref_parts[-1]

    if not path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"File ref not found: {file_ref}"
        )
    
    
    return path


def is_synth(sound_name):

    # Search for any file starting with 'sound_name'
    synth_matches = list(SYNTHS_DIR.glob(f"{sound_name}.*"))
    samples_matches = list(SAMPLES_DIR.glob(f"{sound_name}*"))

    if synth_matches and samples_matches:
          raise ValueError(f'The name "{sound_name}" is present in both /synths and /samples directories.')
    elif synth_matches:
        return True
    elif samples_matches:
        return False
    else:
        raise ValueError(f'"{sound_name}" not found in the sound_assets directory.')


def write_YAML_file(yaml_dict: dict):
    
    filename = f'style_{uuid.uuid4()}.yaml'
    session_id = session_id_var.get()
    filepath = Path(TMP_DIR, session_id, filename)

    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    filepath.write_text(
        yaml.dump(yaml_dict, default_flow_style=False),
        encoding="utf-8"
    )
        
    return filepath


def read_YAML_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            YAML_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return YAML_dict

def write_sound_to_style(style_filepath: Path | str, write_to_yml=True):
    
    style_dict = read_YAML_file(style_filepath)
        
    sound_key, ext, dir = (
        ('sample', '', 'samples') 
        if style_dict['generator']['type'] == 'sampler' 
        else ('preset', '.yml', 'synths')
        )
    
    sound_name = style_dict['generator'][sound_key]
    sound_path = resolve_file(f'sound_assets:{dir}:{sound_name}{ext}')
    
    style_dict['generator'][sound_key] = str(sound_path)
    
    return write_YAML_file(style_dict) if write_to_yml else style_dict

def is_time_series(df: pd.DataFrame, style: dict):
    
    if len(df) < 2:
        # Need more than 1 value to compare against
        return False 
    
    # Find time axis in the style
    time_axis = get_time_axis(style)
        
    time_column = df.iloc[:, time_axis] if isinstance(time_axis, int) else df[time_axis]

    # Check spacing between first 10 rows
    diffs = time_column.head(10).diff().dropna()

    evenly_spaced = np.allclose(
        diffs,
        diffs.iloc[0],
        rtol=1e-3,
        atol=1e-8,
    )
    
    return evenly_spaced

def get_time_axis(style):
    for i, mapping in enumerate(style['map']):
            if mapping['output'] in ['time', 'time_evo']:
                # Time axis is either specified with a column name or index in the 'input' field,
                # Or if no input is specified, use the order of the mappings
                return mapping.get('input', i)


def update_style(style_filepath: Path | str, observer: dict | None = None):
    """ This loads the style file into a dictionary, and checks if anything needs re-writing into the format that
            STRAUSS expects. These criteria are as follows:
            1. Swap sample file reference to the sample's filepath, if using
            2. Swap 'time' for 'time_evo' if using Objects
            3. Swap 'pitch' for 'pitch_shift' if using Objects, or if Events with no musical notes given.

    Args:
        style_filepath (Path | str): The path to the Style file
        observer (dict | None, optional): The dictionary of parameters if 'Place on Dome' feature is being used. Defaults to None.

    Returns:
        _type_: _description_
    """      
    
    # Track whether we need to re-write the style file or not
    updated = False
    
    # Load user style
    style_dict = read_YAML_file(style_filepath)
    
    # 1. Swap sound asset ref for full filepath if necessary
    generator_style = style_dict.get('generator', {})
    sample_name = generator_style.get('sample')
    
    if isinstance(sample_name, str) and sample_name.startswith('sound_assets:'):
            sample_path = resolve_file(sample_name)
            generator_style['sample'] = sample_path
            updated = True
            
    # 2. Swap out 'time' for 'time_evo' if using Objects
    # 3. Swap out 'pitch' for 'pitch_shift' if necessary
    sources = style_dict.get('sources')
    
    if sources == 'objects':
            
            param_swaps = {
                'time': 'time_evo',
                'pitch': 'pitch_shift'
            }
            
            for m in style_dict.get('map', {}):
                if m.get('output') in param_swaps:
                        m['output'] = param_swaps[m['output']]
                        updated = True
                
    elif sources == 'events' and style_dict.get('notes') is None:
            for m in style_dict.get('map', {}):
                if m.get('output') == 'pitch':
                        m['output'] = 'pitch_shift'
                        updated = True
            
    # Write updated style to new YAML file if necessary
    updated_style = write_YAML_file(style_dict) if updated else Path(style_filepath)
    
    return updated_style


def is_number(x):
    try:
        float(x)
        return True
    except ValueError:
        return False
    
def voice_chord(chord_name: str):

      # This will raise a ValueError if chord_name is invalid.
      chord = Chord(chord_name)
      notes = chord.components()
      root = chord.root
      fifth = transpose_note(root, 7, root)
    

      # Chord needs a fifth to be voiced pleasantly
      if not fifth in notes:
            raise ValueError('Chord must have a perfect fifth')
      else:
            remaining_notes = [note for note in notes if note not in [root, fifth]]
      
      # Voice the chord depending on which notes it has
      if len(remaining_notes) == 1:
            # Likely a major or minor triad
            third_note = remaining_notes[0]
            fourth_note = root
      elif len(remaining_notes) == 2:
            third_note = remaining_notes[0]
            fourth_note = remaining_notes[1]
      elif len(remaining_notes) == 3:
            # NOTE - Need to allow for 5+ notes in a chord e.g. Cmaj9
            fifth = remaining_notes[0]
            third_note = remaining_notes[1]
            fourth_note = remaining_notes[2]
      elif len(remaining_notes) == 0:
            third_note = root
            fourth_note = fifth
      else:
            raise ValueError(f'{chord_name} is too complex, maximum of 5 notes allowed.')
      
      notes = [root + '2', fifth + '3', third_note + '4', fourth_note + '5']

      return notes


def random_chord():
      
      root_note = random.choice(notesharps)
      fifth = transpose_note(root_note, 7)
      
      interval_pairs = [[11,2],[4,2],[4,11],[10,5]]
      
      chosen_pair = random.choice(interval_pairs)
      random.shuffle(chosen_pair)
      
      third_note = transpose_note(root_note, chosen_pair[0])
      fourth_note = transpose_note(root_note, chosen_pair[1])

      return [[root_note + '2', fifth + '3', third_note + '4', fourth_note + '5']]
  
def cleanup_old_layers(session_id: str, n_layers: int):
    """
    Delete old audio files and mapping table CSVs from the user's session
    directory where the layer number is greater than the number of layers.

    Audio files are named e.g. ``layer_1.wav`` and ``layer_2.mp3``.
    Mapping tables are named e.g. ``mapping_table_1.csv``.

    Args:
        session_id (str): The user's session ID
        n_layers (int): The number of layers in the most recently generated
            sonification.
    """

    session_dir = TMP_DIR / session_id
    if not session_dir.exists():
        return

    for file in session_dir.iterdir():
        if not file.is_file():
            continue

        suffix = file.suffix.lower()

        # Audio files: layer_1.wav / layer_1.mp3
        # Mapping tables: mapping_table_layer_1.csv
        if suffix in {".wav", ".mp3"}:
            match = re.search(r"^layer_(\d+)$", file.stem)
        elif suffix == ".csv":
            match = re.search(r"^mapping_table_(\d+)$", file.stem)
        else:
            continue

        if not match:
            continue

        layer_number = int(match.group(1))

        if layer_number > n_layers or suffix == ".mp3":
            file.unlink()
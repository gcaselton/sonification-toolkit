from strauss.sonification import Sonification
from strauss.sources import Objects, Events, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps
from musical_scales import scale as parse_scale
from style_schemas import BaseStyle, ParameterMapping

from pychord import Chord
from pychord.utils import transpose_note
from paths import *
from pydantic import ValidationError

import lightkurve as lk
import numpy as np
import pandas as pd
import random, os, yaml
import matplotlib.pyplot as plt
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def read_YAML_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            YAML_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return YAML_dict

def sonify(data: Path | str | tuple, style_file: Path | str | dict, sonify_type: str, length=15, system='mono'):

      # Load and validate user style
      style_dict = read_YAML_file(style_file) if isinstance(style_file, (Path, str)) else style_file

      # validate input parameters against data headers
      validate_input_params(style_dict, data)

      # Validate entire style file
      validated_style = BaseStyle.model_validate(style_dict)
        
      # Set up Sonification elements
      score, sources, generator = setup_strauss(data, validated_style, sonify_type, length)

      # Render sonification
      sonification = Sonification(score, sources, generator, system)

      sonification.render()

      return sonification

def validate_input_params(style: dict, data: Path | str | tuple):

      if isinstance(data, tuple):
            pass
      else:
            data_filepath = str(data)

            if data_filepath.endswith('.csv'):

                  df = pd.read_csv(data_filepath)
                  
            elif data_filepath.endswith('.fits'):

                  lc = lk.read(data_filepath)
                  df = lc.to_pandas()
            else:
                  raise ValueError('Data file must be a .csv or .fits file.')
            
            col_headers = df.columns.tolist()
            col_headers_lower = [col.lower() for col in col_headers]

            mappings = style['parameters']

            for mapping in mappings:
                
                  input_param = mapping['input'].lower()
                  in_min, in_max = mapping.get('input_range', ('0%','100%'))

                  if input_param not in col_headers_lower:
                        raise ValidationError(f'Input parameter "{input_param}" not found in data columns: {col_headers}')
                  
                  if isinstance(in_min, str) and in_min.endswith('%'):
                        # might need to catch if one is % and the other isn't
                        continue
                  
                  col_index = col_headers_lower.index(input_param)
                  col_data = df.iloc[:, col_index]

                  mapping['input'] = col_headers[col_index]  # Update style with original case-sensitive name from data

                  # How do we check range for absolute values? I.E 20 to 5000 instead of 0 to 1

                  # if col_data.min() < in_min or col_data.max() > in_max:
                  #       raise ValidationError(f'Input parameter "{input_param}" has data outside specified input_range [{in_min}, {in_max}]. Actual data range: [{col_data.min()}, {col_data.max()}]')
            
      

def quick_sonify(x_data, y_data, sound='default', y_params=['cutoff'], chordal=True, length=15, system='mono'):

      # NOTE - re-structure this function to use the new sonify function

        # Covert data to numpy array
        x_data = ensure_array(x_data)
        y_data = ensure_array(y_data)

        # Set up Sonification elements
        generator = setup_generator(sound)
        score =  setup_score(chordal, length)
        sources = setup_sources(x_data, y_data, y_params)
        
        # Render and play sonification
        soni = Sonification(score, sources, generator, system)
        soni.render()
        soni.hear()

def ensure_array(data):
      return data if isinstance(data, np.ndarray) else np.array(data)


def find_sound(sound_name):

    # Search for any file starting with 'sound_name'
    synth_matches = list(SYNTHS_DIR.glob(f"{sound_name}.*"))
    samples_matches = list(SAMPLES_DIR.glob(f"{sound_name}*"))

    if synth_matches and samples_matches:
          raise ValueError(f'The name "{sound_name}" is present in both /synths and /samples directories.')
    elif synth_matches:
        return "synths", synth_matches[0]
    elif samples_matches:
        return "samples", samples_matches[0]
    else:
        raise ValueError(f'"{sound_name}" not found in the sound_assets directory.')


def get_filepath(directory):
      name = os.listdir(directory)[0]
      return os.path.join(directory, name)


def setup_strauss(data: Path | str | tuple, style: BaseStyle, sonify_type, length):

      # Read and find sound to create Generator
      folder, path = find_sound(style.sound)

      if folder == 'synths':
            generator = Synthesizer()
            path_stem = str(path.with_suffix(""))
            generator.load_preset(path_stem)

            # NOTE To do: Modify preset for ADSR if using scale
      else:
            path = str(path)
            inner_file = get_filepath(path)
            generator = Sampler(inner_file, sf_preset=1) if inner_file.endswith('.sf2') else Sampler(path)
            
            if style.harmony and ' ' in style.harmony:
                  generator.load_preset('staccato')
                  generator.modify_preset({'volume_envelope': {'use':'on', 'R':0.2}})
            else:
                  generator.load_preset('sustain')
                  generator.modify_preset({'looping': 'forwardback', 'loop_start': 0.2, 'loop_end': 5.})
            
      
      # generator = Synthesizer() if folder == 'synths' else Sampler()
      # path_stem = str(path.with_suffix(""))
      # generator.load_preset(path_stem)

      mappings = style.parameters

      outputs = [mapping.output for mapping in mappings]

      # Check if filter needs switching on
      if 'cutoff' in outputs:
            generator.modify_preset({'filter': 'on'})

      

      # Set up the data and Sources
      if sonify_type == 'light_curves':
            sources = light_curve_sources(data, style, length)
      elif sonify_type == 'constellations':
            sources = constellation_sources(data, style, length)
      else:
            raise ValueError(f'Sonification type "{sonify_type}" not recognised.')
      
      # Handle chord or scale
      if style.harmony:
            notes = parse_harmony(style.harmony, folder, path)
      else:
            notes = [['A3']] # Change this?
      
      score = Score(notes,length)

      return score, sources, generator

def parse_harmony(harmony: str, sound_folder, sound_path):

      if ' ' in harmony: 
            
            # Likely a scale e.g 'C major'
            root, quality = harmony.split(' ', 1)
            notes = parse_scale(starting_note=root, mode=quality, octaves=2) # 3 octave range as default, could give users the option?
            notes = [[str(note - 12) for note in notes]] # -12 so it starts on 2nd octave
      else:
            # Likely a chord e.g. 'Cmaj7'
            notes = voice_chord(harmony, sound_folder, sound_path)

      return notes

def univariate_sources(xy_data: tuple, params, chord_mode):
      # NOTE to do: make this into a more generic function for univariate data?
      pass

def constellation_sources(data: Path | str , style: BaseStyle, length):

      data_filepath = str(data)

      if data_filepath.endswith('.csv'):

            df = pd.read_csv(data_filepath)
      else:
            raise ValueError('Data file must be a .csv file.')
      
      # Remove rows with NaN values in any of the columns used
      input_params = [mapping.input for mapping in style.parameters]
      df = df.dropna(subset=input_params)

      data_dict = {}
      m_lims = {}
      p_lims = {}
      my_funcs = {}

      special_funcs = {
      'pitch':  lambda x: -x,
      'volume': lambda x: (1 + np.argsort(x).astype(float))**-0.2}
      
      for mapping in style.parameters:

            input = mapping.input
            output = mapping.output

            if output == 'azimuth':
                  # Rescale input values if using azimuth to restrict to the frontal stereo field
                  df[input] = rescale_col(df, input, (0.25, 0.75))

                  # Add constant polar of 0.5
                  data_dict['polar'] = np.full(len(df), 0.5)

            # Apply special mapping functions, default to ndarray conversion
            my_funcs[output] = special_funcs.get(
            output,
            lambda x : x
            )

            # Map data
            data_dict[output] = df[input].to_numpy(dtype=float)

            # Set mapping and parameter limits
            m_lims[output] = mapping.input_range

            if mapping.output_range:
                  p_lims[output] = mapping.output_range

      sources = Events(data_dict.keys())
      sources.fromdict(data_dict)
      sources.apply_mapping_functions(map_funcs=my_funcs, map_lims=m_lims, param_lims=p_lims)

      return sources


def rescale_col(df, col, target_range=(0.0, 1.0)):
    t_min, t_max = target_range

    # If the column has one unique value, fallback to center of the target range
    if df[col].nunique() == 1:
        center = (t_min + t_max) / 2
        return pd.Series(center, index=df.index)

    min_val = df[col].min()
    max_val = df[col].max()

    # Normalize to 0–1, then stretch to target range
    normalized = (df[col] - min_val) / (max_val - min_val)

    return t_min + normalized * (t_max - t_min)

def convert_percent_to_values(param_lims: tuple):
    """
    Convert mapping limits to fractions for STRAUSS.
    Supports:
        - strings like '0%', '104%'
        - numeric values (0, 104)
    Returns:
        tuple of floats (low, high)
    """
    low, high = param_lims

    if isinstance(low, str) and low.endswith('%'):
        low_val = float(low.rstrip('%')) / 100.0
        high_val = float(high.rstrip('%')) / 100.0
    else:
        low_val = float(low)
        high_val = float(high)

    return (low_val, high_val)


def scale_events(x, y, params: list[ParameterMapping], length):

      user_settings = read_YAML_file(SETTINGS_FILE)
      resolution = user_settings['data_resolution']

      new_x, new_y = downsample_data(x, y, length, resolution)

      data = {'pitch': new_y,
              'time': new_x}

      m_lims = {'time': ('0%','101%'),
              'pitch': ('0%','100%')}
      
      p_lims = {}

      for mapping in params:
            if mapping.output not in data.keys():
                  data[mapping.output] = new_y
                  m_lims[mapping.output] = mapping.input_range

                  if mapping.output_range:
                        p_lims[mapping.output] = mapping.output_range
      
      sources = Events(data.keys())
      sources.fromdict(data)
      sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims) # Problem here: 'pitch cannot be evolved'
      

      return sources

def light_curve_sources(data, style: BaseStyle, length):

      if isinstance(data, tuple):

            x = data[0]
            y = data[1]
            
      elif isinstance(data, Path):
            if data.suffix == '.fits':

                  lc = lk.read(data)
                  lc = lc.remove_nans()
                  x = lc.time.value
                  y = lc.flux.value

            elif data.suffix == '.csv':

                  df = pd.read_csv(data)

                  # Remove rows with NaN values in either column
                  df = df.dropna()

                  x = df.iloc[:, 0].to_list()  # first column
                  y = df.iloc[:, 1].to_list()  # second column


      x = ensure_array(x)
      y = ensure_array(y)

      is_scale = style.harmony and ' ' in style.harmony

      pitches = [0] if is_scale else [0,1,2,3]

      for mapping in style.parameters:
            if mapping.output == 'pitch':
                  if is_scale:
                        # Return Events type for scale mapping
                        return scale_events(x, y, style.parameters, length)
                  else:
                        # Change pitch for pitch_shift if we want Objects type
                        mapping.output = 'pitch_shift'
                        
      data_dict = {'pitch': pitches, 
              'time_evo': [x]*len(pitches)}
      m_lims = {'time_evo': ('0%', '100%')}
      p_lims = {}

      for mapping in style.parameters:
            data_dict[mapping.output] = [y]*len(pitches)
            m_lims[mapping.output] = mapping.input_range
            if mapping.output_range:
                  p_lims[mapping.output] = mapping.output_range

      sources = Objects(data_dict.keys())
      sources.fromdict(data_dict)
      sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

      return sources

def downsample_data(x, y, length_in_sec, resolution):
    
    old_n = len(x)
    new_n = int(resolution * length_in_sec)

    if old_n <= new_n:
        return x, y

    bins = np.array_split(y, new_n)
    downsampled_y = [np.mean(b) for b in bins]
    downsampled_x = np.linspace(x[0], x[-1], len(downsampled_y))

    return downsampled_x, downsampled_y


def normalise(array):
      return (array - array.min()) / (array.max() - array.min())
            

def voice_chord(chord_name: str, sound_folder: str, sound_path: str):

      # This will raise a ValueError if chord_name is invalid.
      chord = Chord(chord_name)
      notes = chord.components()
      root = chord.root
      print(notes)
      
      fifth = transpose_note(root, 7)
      print(fifth)

      # Chord needs a fifth to be voiced pleasantly
      if not fifth in notes:
            raise ValueError('Chord must have a perfect fifth')
      else:
            root_and_fifth = [root, fifth]
            remaining_notes = [note for note in notes if note not in root_and_fifth]
      
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

      # Check that the desired octaves are present in the desired sound samples
      if sound_folder == 'samples':
            sample_folder = Path(sound_path)
            available_notes = [p.name for p in sample_folder.iterdir() if p.is_file()]

            # Move lowest note up an octave and highest note down if not available in the sound folder
            notes[0] = f'{root}3' if f'{root}2' not in available_notes else f'{root}2'
            notes[3] = f'{fourth_note}4' if f'{fourth_note}5' not in available_notes else f'{fourth_note}5'

      return [notes]

      

def random_chord():
      
      root_note = random.choice(notesharps)
      fifth = transpose_note(root_note, 7)
      
      interval_pairs = [[11,2],[4,2],[4,11],[10,5]]
      
      chosen_pair = random.choice(interval_pairs)
      random.shuffle(chosen_pair)
      
      third_note = transpose_note(root_note, chosen_pair[0])
      fourth_note = transpose_note(root_note, chosen_pair[1])

      return [[root_note + '2', fifth + '3', third_note + '4', fourth_note + '5']]


        

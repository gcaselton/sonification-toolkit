from strauss.sonification import Sonification
from strauss.sources import Objects, Events, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps
from musical_scales import scale as parse_scale
from style_schemas import BaseStyle, ParameterMapping
from settings import load_settings_from_file
from pychord import Chord
from pychord.utils import transpose_note
from paths import *
from pydantic import ValidationError
from night_sky import handle_observer
from copy import deepcopy

import lightkurve as lk
import numpy as np
import pandas as pd
import random, os, yaml
import matplotlib.pyplot as plt
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

BASIC_LOOP = {
      'looping': 'forwardback',
      'loop_start': 0,
      'loop_end': 5.
}

LOOPING_MODS = {
      'Space Strings': BASIC_LOOP,
      'Deep Crackle': BASIC_LOOP,
      'Dark Drone': BASIC_LOOP,
      'Bright Mallets': {
            'looping': 'forward',
            'loop_start': 0.3,
            'loop_end': 5
      }
}

def read_YAML_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            YAML_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return YAML_dict

def sonify(data: Path | str | tuple, style_file: Path | str | dict, sonify_type: str, length=15, system='mono', observer=None):

      # Load and validate user style
      style_dict = read_YAML_file(style_file) if isinstance(style_file, (Path, str)) else style_file

      # validate input parameters against data headers
      validate_input_params(style_dict, data)
      
      if observer:
            handle_observer(observer, style_dict)
            
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
                  df['time'] = None
            else:
                  raise ValueError('Data file must be a .csv or .fits file.')
            
            col_headers = df.columns.tolist()
            print(col_headers)
            col_headers_lower = [col.lower() for col in col_headers]

            mappings = style['parameters']

            for mapping in mappings:
                  
                  if isinstance(mapping['input'], float):
                        continue
                
                  input_param = mapping['input'].lower()
                  in_min, in_max = mapping.get('input_range', ('0%','100%'))

                  if input_param not in col_headers_lower:
                        raise ValueError(f'Input parameter "{input_param}" not found in data columns: {col_headers}')
                  
                  if isinstance(in_min, str) and in_min.endswith('%'):
                        # might need to catch if one is % and the other isn't
                        continue
                  
                  col_index = col_headers_lower.index(input_param)
                  col_data = df.iloc[:, col_index]

                  mapping['input'] = col_headers[col_index]  # Update style with original case-sensitive name from data

                  # How do we check range for absolute values? I.E 20 to 5000 instead of 0 to 1

                  # if col_data.min() < in_min or col_data.max() > in_max:
                  #       raise ValidationError(f'Input parameter "{input_param}" has data outside specified input_range [{in_min}, {in_max}]. Actual data range: [{col_data.min()}, {col_data.max()}]')
            

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

            if style.preset:
                  generator.load_preset(style.preset)

            if style.mods:
                  generator.modify_preset(style.mods)
            elif style.sound in LOOPING_MODS:
                  generator.modify_preset(LOOPING_MODS[style.sound])

      mappings = style.parameters

      outputs = [mapping.output for mapping in mappings]

      # Check if filter needs switching on
      if 'cutoff' in outputs:
            generator.modify_preset({'filter': 'on'})
      
      # Set up the data and Sources
      if sonify_type == 'light_curves':
            sources = light_curve_sources(data, style, length)
      elif sonify_type == 'constellations' or sonify_type == 'night_sky':
            sources = constellation_sources(data, style, length)
      else:
            raise ValueError(f'Sonification type "{sonify_type}" not recognised.')
      
      # Handle chord or scale
      if style.harmony:

            if isinstance(style.harmony, str):
                  notes = parse_harmony(style.harmony, folder, path)
            else:
                  notes = [style.harmony]
            
            if 'pitch' not in outputs:
                  # Use the first note in the harmony
                  notes = [[notes[0][0]]]
      else:
            notes = [['A3']] # Change this?
      
      score = Score(notes,length)

      return score, sources, generator

def parse_harmony(harmony: str, sound_folder, sound_path):

      if ' ' in harmony: 
            
            # Likely a scale e.g 'C major'
            root, quality = harmony.split(' ', 1)
            print(quality)
            quality = 'hijaroshi' if quality == 'hirajoshi' else quality
            notes = parse_scale(starting_note=root, mode=quality, octaves=2) # 3 octave range as default, could give users the option?
            notes = [str(note) for note in notes]
            if sound_folder == 'samples':
                  notes = constrain_notes(notes, sound_path)
            notes = [notes]
            
            print(notes)
      else:
            # Likely a chord e.g. 'Cmaj7'
            notes = voice_chord(harmony, sound_folder, sound_path)

      return notes

def constrain_notes(desired_notes, sound_path):
    
    sample_folder = Path(sound_path)
    available_notes = [p.stem for p in sample_folder.iterdir() if p.is_file()]
    
    def extract_note(stem):
        return stem.split('_')[-1]
    
    available_note_set = {extract_note(stem) for stem in available_notes}
    
    constrained = []
    
    for note in desired_notes:
        if note in available_note_set:
            constrained.append(note)
        else:
            pitch_class = ''.join(c for c in note if not c.isdigit())
            octave = int(''.join(c for c in note if c.isdigit() or c == '-'))
            
            matched = None
            max_range = 10
            for delta in range(0, max_range):
                for direction in ([0] if delta == 0 else [delta, -delta]):
                    candidate = f"{pitch_class}{octave + direction}"
                    if candidate in available_note_set:
                        matched = candidate
                        break
                if matched:
                    break
            
            if matched:
                constrained.append(matched)
    
    return constrained
                  

def univariate_sources(xy_data: tuple, params, chord_mode):
      # NOTE to do: make this into a more generic function for univariate data?
      pass

def parse_percentile(val):
    """Extract numeric value from a percentile string like '110%', or return the float directly."""
    if isinstance(val, str):
        return float(val.strip('%'))
    return float(val)

def constellation_sources(data: Path | str , style: BaseStyle, length):

      data_filepath = str(data)

      if data_filepath.endswith('.csv'):

            df = pd.read_csv(data_filepath)
      else:
            raise ValueError('Data file must be a .csv file.')
      
      # Remove rows with NaN values in any of the columns used
      input_params = [mapping.input for mapping in style.parameters if isinstance(mapping.input, str)]
      df = df.dropna(subset=input_params)

      data_dict = {
            'pitch': [0]*len(df)
      }
      m_lims = {}
      p_lims = {}
      my_funcs = {}
      
      for mapping in style.parameters:

            input = mapping.input
            output = mapping.output

            if output == 'azimuth' and isinstance(input, str):
                  # Rescale input values if using azimuth to restrict to the frontal stereo field
                  df[input] = rescale_col(df, input, (0.25, 0.75))

                  # Add constant polar of 0.5
                  data_dict['polar'] = np.full(len(df), 0.5)

            # Invert data for e.g. magnitude (smaller magnitude is brighter)
            if mapping.function == 'invert':
                  my_funcs[output] = lambda x: np.negative(x)

            # Map data
            if isinstance(input, float):
                  # Is a constant spatial param, e.g. azimuth or polar
                  data_dict[output] = np.full(len(df), input)
            else:
                  # Every other type of param
                  data_dict[output] = df[input].to_numpy(dtype=float)
                  m_lims[output] = mapping.input_range

            if mapping.output_range:
                  p_lims[output] = mapping.output_range
                  
                  
      # Ensure time upper limit is at least 110% to allow some time at the end
      if 'time' in m_lims and m_lims['time'] is not None:
            lower, upper = m_lims['time']
            if parse_percentile(upper) <= 100:
                  m_lims['time'] = (lower, '110%')
      else:
            m_lims['time'] = ('0%', '110%')
                  

      sources = Events(data_dict.keys())
      
      print(data_dict)
      print("m_lims:", m_lims)
      print("p_lims:", p_lims)
     
      sources.fromdict(data_dict)
      sources.apply_mapping_functions(map_funcs=my_funcs, map_lims=m_lims, param_lims=p_lims)
      print("mapped time:", sources.mapping['time'])


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


def scale_events(labelled_data: dict, params: list[ParameterMapping], length):
      
      user_settings = load_settings_from_file()
      resolution = user_settings['data_resolution']
      
      time_input = next((p.input for p in params if p.output == 'time'), None)

      if time_input is None:
            raise ValueError('There must be one parameter mapped to time.')
      
      x = labelled_data[time_input]
      y = next(v for k, v in labelled_data.items() if k != time_input)

      new_x, new_y = downsample_data(x, y, length, resolution)

      data = {'pitch': new_y,
              'time': new_x}

      m_lims = {'time': ('0%','110%'),
                'pitch': ('0%', '100%')
                }
      
      p_lims = {}
      funcs = {}

      for mapping in params:
            
            if mapping.function == 'invert':
                  funcs[mapping.output] = lambda x: np.negative(x)
                  
            if mapping.output not in data.keys():
                  
                  if isinstance(mapping.input, float):
                        # Is a fixed spatial param e.g. azimuth
                        data[mapping.output] = [mapping.input]
                  else:
                        # all other mappings 
                        data[mapping.output] = new_y
                        m_lims[mapping.output] = mapping.input_range if mapping.input_range else ('0%', '100%')
                        
                        if mapping.output == 'azimuth':
                              data['polar'] = [0.5]*len(new_x)
                  
                  if mapping.output_range:
                        p_lims[mapping.output] = mapping.output_range
      
      sources = Events(data.keys())
      sources.fromdict(data)
      sources.apply_mapping_functions(map_funcs=funcs, map_lims=m_lims, param_lims=p_lims) # Problem here: 'pitch cannot be evolved'
      

      return sources

def light_curve_sources(data, style: BaseStyle, length):
      
      labelled_data = {}

      if isinstance(data, tuple):
            
            labelled_data['time'] = data[0]
            labelled_data['flux'] = data[1]
            
      elif isinstance(data, Path):
            
            
            if data.suffix == '.fits':

                  lc = lk.read(data)
                  lc = lc.remove_nans()
                  
                  time = ensure_array(lc.time.value)
                  flux = ensure_array(lc.flux.value)
                  
                  labelled_data['time'] = time
                  labelled_data['flux'] = flux

            elif data.suffix == '.csv':

                  df = pd.read_csv(data)

                  # Remove rows with NaN values in either column
                  df = df.dropna()

                  col1, col2 = df.columns[:2]
                  
                  col1 = col1.lower()
                  col2 = col2.lower()

                  labelled_data[col1] = df.iloc[:, 0].to_numpy()
                  labelled_data[col2] = df.iloc[:, 1].to_numpy()

      is_scale = ((style.harmony and ' ' in style.harmony) or (style.preset == 'staccato'))

      pitches = [0] if is_scale else [0,1,2,3]
      
      data_dict = {'pitch': pitches}
      funcs = {}
      m_lims = {}
      p_lims = {}
      
      # Make a copy of params before mutating 'time' to 'time_evo' later
      params_copy = deepcopy(style.parameters)

      for mapping in style.parameters:
            
            if mapping.output == 'pitch':
                  if is_scale:
                        # Return Events type for scale mapping
                        return scale_events(labelled_data, params_copy, length)
                  else:
                        # Change pitch for pitch_shift if we want Objects type
                        mapping.output = 'pitch_shift'
            
            if mapping.function == 'invert':
                  funcs[mapping.output] = lambda x: np.negative(x)
                        
            mapping.output = 'time_evo' if mapping.output == 'time' else mapping.output
                        
            if isinstance(mapping.input, float):
                  # Is a constant spatial param, e.g. azimuth or polar
                  data_dict[mapping.output] = [mapping.input]
            else:
                  # Every other type of param
                  data_dict[mapping.output] = [labelled_data[mapping.input]]*len(pitches)
                  m_lims[mapping.output] = mapping.input_range if mapping.input_range else ('0%', '100%')
                  
                  if mapping.output == 'azimuth':
                        data_dict['polar'] = [0.5]*len(pitches)
                  
            if mapping.output_range:
                  p_lims[mapping.output] = mapping.output_range
      

      sources = Objects(data_dict.keys())
      sources.fromdict(data_dict)
      sources.apply_mapping_functions(map_funcs=funcs, map_lims=m_lims, param_lims=p_lims)

      return sources

def downsample_data(x, y, length_in_sec, resolution):
    
    old_n = len(x)
    new_n = int(resolution * length_in_sec)

    if old_n <= new_n:
        return x, y

    bins = np.array_split(y, new_n)
    downsampled_y = np.array([float(np.mean(b)) for b in bins])
    downsampled_x = np.linspace(x[0], x[-1], len(downsampled_y))

    return downsampled_x, downsampled_y


def normalise(array):
      return (array - array.min()) / (array.max() - array.min())
            

def voice_chord(chord_name: str, sound_folder: str, sound_path: str):

      # This will raise a ValueError if chord_name is invalid.
      chord = Chord(chord_name)
      notes = chord.components()
      root = chord.root
      fifth = transpose_note(root, 7)
    

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
            available_notes = [p.stem for p in sample_folder.iterdir() if p.is_file()]

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


        

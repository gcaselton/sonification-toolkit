from strauss.sonification import Sonification
from strauss.sources import Objects, Events, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps
from musical_scales import scale as scales

from pychord import Chord
from pychord.utils import transpose_note
from paths import *

import lightkurve as lk
import numpy as np
import random
import matplotlib.pyplot as plt
import sounddevice as sd
from pathlib import Path
import os
import yaml


      

TYPES_SCHEMA = {
      'name': '',
      'description': '',
      'sound': '',
      'parameters': {},
      'chord_mode': '',
      'chord': '',
      'scale': ''
}

def populate_schema():
      TYPES_SCHEMA['parameters'].update({param: [] for param in param_lim_dict})

def read_style_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            style_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return style_dict

def sonify(data_filepath, style_filepath, sonify_type, length=15, system='stereo'):
        
        style_dict = read_style_file(style_filepath)
        
        # Set up Sonification elements
        score, sources, generator = setup_sonification(data_filepath, sonify_type, style_dict, length)

        # Render sonification
        sonification = Sonification(score, sources, generator, system)
        sonification.render()

        return sonification



def quick_sonify(x_data, y_data, sound='default', y_params=['cutoff'], chordal=True, length=15, system='stereo'):

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
    samples_matches = list(SAMPLES_DIR.glob(f"{sound_name}.*"))

    if synth_matches and samples_matches:
          raise ValueError(f'The name "{sound_name}" is present in both /synths and /samples directories.')
    elif synth_matches:
        return "synths", synth_matches[0]
    elif samples_matches:
        return "samples", samples_matches[0]
    else:
        raise ValueError(f'"{sound_name}" not found in the sound_assets directory.')
                  

def validate_type(value, valid_types):
      
      if not isinstance(value, valid_types):
            raise TypeError(f'{value} should be of type {valid_types}, but instead is {type(value)}.')
      else:
            return value

def validate_value(key, value, valid_values):
      
      if value not in valid_values:
            raise ValueError(f'{value} is not a valid value for {key}.')
      else:
            return value
      
def convert_to_float(string):
      
      # NOTE - make this work

      if string.endswith('%'):
            string = string[:-1]
      elif string.contains('.'):
            try:
                  value = float(string)
            except ValueError:
                  raise ValueError('Limit must be a number')
            if 0 <= value <= 1:
                  return value
            else:
                  raise ValueError('Limit should be between 0-1')

      try:
                value = int(string)
      except ValueError:
                raise ValueError('Limit must be a number')
      if 0 <= value <= 100:
                  return value
      else:
                  raise ValueError('Limit should be between 0-100%')

      
def validate_param_lims(param, lims, valid_lims):
      
      if len(lims) != 2:
            raise ValueError(f'Expected 2 limits (lower and upper) for {param}, but got {len(lims)}.')

      valid_types = (int, float)
      
      lower = validate_type(lims[0], valid_types)
      upper = validate_type(lims[1], valid_types)

      if lower > upper:
             raise ValueError(f'The lower limit should be below the upper limit for {param}.')
      
      if lower < valid_lims[0] or upper > valid_lims[1]:
             raise ValueError(f'The limits for {param} must be between the limits stated in the schema.')
      
      return (lower, upper)

def validate_style(style, default_style):

      validated_style = {}

      # This will check that the user-provided style is a valid type, and revert to default values if elements are missing
      for key in TYPES_SCHEMA:
            value = style.get(key) or default_style.get(key)
            if value:
                  value = validate_type(value, type(TYPES_SCHEMA[key]))
            
            validated_style[key] = value

      return validated_style


def setup_sonification(data_filepath, sonify_type, style, length):

      populate_schema()
      
      default_style_path = Path(STYLE_FILES_DIR, sonify_type, 'default.yml')
      default_style = read_style_file(default_style_path)

      # Read and validate style
      style = validate_style(style, default_style)

      # Read and find sound to create Generator
      folder, path = find_sound(style['sound'].lower())
      generator = Synthesizer() if folder == 'synths' else Sampler()
      path_stem = str(path.with_suffix(""))
      generator.load_preset(path_stem)

      scale = style['scale']

      # Read and validate parameters
      params = style['parameters']

      # New dictionary to store validated params as the keys and a tuple containing limits as the values
      params_lims = {}

      # For each parameter, validate the param and limits provided 
      for param in params:

            if param == 'cutoff':
                  generator.modify_preset({'filter': 'on'})
            
            if param == 'pitch' and not scale:
                  param = 'pitch_shift'

            param = validate_value('parameters', param, param_lim_dict.keys())
            default_lims = default_style['parameters'][param] if param in default_style['parameters'] else list(param_lim_dict[param])

            lims = params.get(param) or default_lims
            lims = validate_type(lims, list)
            lims = validate_param_lims(param, lims, param_lim_dict[param])

            params_lims[param] = lims

      # NOTE - TO do - finish this and test it

      chord_mode = style['chord_mode'].lower()
      chord_mode = validate_value('chord_mode', chord_mode, ['on', 'off'])

      chord = style['chord']

      # Set up the data
      sources = setup_data(data_filepath, sonify_type, params_lims, chord_mode, scale)

      # Handle chord or scale
      if chord_mode == 'on':

            if chord.lower() == 'random' or not chord:
                  notes = random_chord()
            else:
                  notes = voice_chord(chord)

      elif chord_mode == 'off' and scale:

            # root, quality = scale.split(' ', 1)
            # notes = [scales(root, quality, 3)]
            notes = [['A3', 'B3', 'C#3', 'D3', 'E3', 'F#3']]

      else:
            notes = [['C3']]
      
      score = Score(notes,length)

      return score, sources, generator

def normalise(array):
      return (array - array.min()) / (array.max() - array.min())
            

def setup_data(data_filepath, sonify_type, params, chord_mode, scale):

      if sonify_type == 'light_curve':
              
            lc = lk.read(data_filepath)
            lc = lc.remove_nans()

            x = np.asarray(lc.time.value)
            y = np.asarray(lc.flux)

            y = normalise(y)

            if chord_mode == 'on':
                  pitches = [0,1,2,3]
                  factor = 4
                  time_param = 'time_evo'
                  upper_lim = '100%'
            elif scale:
                  pitches = y
                  factor = 1
                  time_param = 'time'
                  upper_lim = '101%'
            else:
                  pitches = [0]
                  factor = 1
                  time_param = 'time_evo'
                  upper_lim = '100%'

            data = {
                  'pitch': pitches,
                  time_param: [x]*factor,
            }

            # Set up map limits and parameter limits

            # Setting lim to 101% allows the final note to play out if a scale has been specified
            m_lims = {time_param: ('0%', upper_lim)} 
            p_lims = {}
              
            for param in params:
                  data[param] = [y]*factor
                  p_lims[param] = params[param]

            # Set up sources
            #NOTE to fix - 'Pitch' not an evolvable parameter

            # We want discrete notes (Events) if a scale has been specified
            sources = Events(data.keys()) if scale else Objects(data.keys())
            sources.fromdict(data)
            sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)
          
      return sources

def voice_chord(chord_name):

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
      
      return[[root + '2', fifth + '3', third_note + '4', fourth_note + '5']]

def random_chord():
      
      root_note = random.choice(notesharps)
      fifth = transpose_note(root_note, 7)
      
      interval_pairs = [[11,2],[4,2],[4,11],[10,5]]
      
      chosen_pair = random.choice(interval_pairs)
      random.shuffle(chosen_pair)
      
      third_note = transpose_note(root_note, chosen_pair[0])
      fourth_note = transpose_note(root_note, chosen_pair[1])

      return [[root_note + '2', fifth + '3', third_note + '4', fourth_note + '5']]


        
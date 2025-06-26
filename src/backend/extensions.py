from strauss.sonification import Sonification
from strauss.sources import Objects, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps

from constants import *
from pychord import Chord
from pychord.utils import transpose_note

import lightkurve as lk
import numpy as np
import random
import matplotlib.pyplot as plt
import sounddevice as sd
from pathlib import Path
import os
import yaml

DEFAULT_TYPE = 'light_curves'
DEFAULT_STYLE_FILE = os.path.join("src","style_files",DEFAULT_TYPE,"default.yml")


def sound_names():

      synths = [f.stem for f in SYNTHS_DIR.iterdir() if f.is_file()]
      samples = [f.stem for f in SAMPLES_DIR.iterdir() if f.is_file()]

      all_sounds = synths + samples
      
      return all_sounds
      

VALID_STYLE = {
      'name': '*',
      'description': '*',
      'sound': sound_names(),
      'parameters': param_lim_dict,
      'chord_mode': ['on', 'off']
}

def read_style_file(filepath):

    with open(filepath, mode='r') as fdata:
        try:
            style_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise err('Error reading YAML file, please check the filepath and ensure correct YAML syntax.')
    
    return style_dict

default_style_dict = read_style_file(DEFAULT_STYLE_FILE)

print(read_style_file(DEFAULT_STYLE_FILE))

def sonify(data_filepath, sonify_type, style_filepath, length=15, system='stereo'):

        # Read YAML file
        style = read_style_file(style_filepath)
        
        # Set up Sonification elements
        score, sources, generator = setup_sonification(data_filepath, sonify_type, style, length)

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
    synth_path = Path("src","sound_assets","synths")
    samples_path = Path("src","sound_assets","samples")

    # Search for any file starting with 'sound_name'
    synth_matches = list(synth_path.glob(f"{sound_name}.*"))
    samples_matches = list(samples_path.glob(f"{sound_name}.*"))

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
            raise TypeError(f'"{value}" should be of type {valid_types}, but instead is {type(value)}.')
      else:
            return value

def validate_value(key, value, valid_values):
      
      if value not in valid_values:
            raise ValueError(f'"{value}" is not a valid value for {key}.')
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
      
#       for lim in lims:
#         #     if isinstance(lim, str):
#         #           convert_to_float(lim)

      valid_types = [int, float]
      
      lower = validate_type(lims[0], valid_types)
      upper = validate_type(lims[1], valid_types)

      if lower > upper:
             raise ValueError(f'The lower limit should be below the upper limit for {param}.')
      
      if lower < valid_lims[0] or upper > valid_lims[1]:
             raise ValueError(f'The limits for {param} must be between the limits stated in the schema.')
      
      return tuple(lower, upper)

def setup_sonification(data_filepath, sonify_type, style, length):
        
        default_path = Path('src', 'style_files', sonify_type, 'default.yml')
        default_style = read_style_file(default_path)

        # Read and validate sound to set up STRAUSS Generator 

        # Load default sound if not specified by user
        sound = style.get('sound') or default_style['sound']
        sound = validate_type(sound, str)

        folder, path = find_sound(sound)
        
        generator = Synthesizer() if folder == 'synths' else Sampler()
        generator.load_preset(path)

        # Read and validate parameters

        # Again use default if none specified
        params = style.get('parameters') or default_style['parameters']
        params = validate_type(params, dict)

        if 'cutoff' in params:
                generator.modify_preset({'filter':'on'})

        # New dictionary to store validated params as the keys and a tuple containing limits as the values
        params_lims = {}

        # For each parameter, validate the param and limits provided 
        for param in params:
              
              param = validate_value('parameters', param, param_lim_dict.keys())

              lims = params.get(param) or default_style['parameters'][param]
              lims = validate_type(lims, list)
              lims = validate_param_lims(param, lims, param_lim_dict[param])

              params_lims[param] = lims

        chord_mode = style.get('chord_mode') or default_style['chord_mode']
        chord_mode = validate_type(chord_mode, str)
        chord_mode = validate_value('chord_mode', chord_mode, VALID_STYLE['chord_mode'])

        # Set up the data
        sources = setup_data(data_filepath, sonify_type, params_lims, chord_mode)

        # Handle chord
        if chord_mode == 'on':
              
              chord = style.get('chord') or default_style['chord']
              chord = validate_type(chord, str)

              if chord.lower() == 'random':
                    notes = random_chord()
              else:
                    notes = voice_chord(chord)
        else:
              # NOTE To do - handle individual notes/scales
              pass
        
        score = Score(notes,length)

        return score, sources, generator

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
            


def setup_data(data_filepath, sonify_type, params, chord_mode):

        if sonify_type == 'light_curves':
              
              lc = lk.read(data_filepath)
              time = lc.time.values
              flux = lc.flux.values

              pitches = [0,1,2,3] if chord_mode == 'on' else [0]

              data = {
                     'pitch': pitches,
                     'time_evo': [time]*len(pitches)
              }

               # Set up map limits and parameter limits
              m_lims = {'time_evo': ('0%','100%')}
              p_lims = {}
              
              for param in params:
                data[param] = [flux]*len(pitches)
                m_lims[param] = ('0%','100%')
                p_lims[param] = params[param]

              # set up sources
              sources = Objects(data.keys())
              sources.fromdict(data)
              sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)
                
        return sources

def random_chord():

        root_note = random.choice(notesharps)
        fifth = transpose_note(root_note, 7)

        interval_pairs = [[11,2],[4,2],[4,11],[10,5]]
        chosen_pair = random.choice(interval_pairs)
        random.shuffle(chosen_pair)

        third_note = transpose_note(root_note, chosen_pair[0])
        fourth_note = transpose_note(root_note, chosen_pair[1])

        return [[root_note + '2', fifth + '3', third_note + '4', fourth_note + '5']]


        
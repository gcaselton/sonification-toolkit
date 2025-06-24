from strauss.sonification import Sonification
from strauss.sources import Objects, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps

from backend.constants import *

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
            print(err)
    
    return style_dict

default_style_dict = read_style_file(DEFAULT_STYLE_FILE)

print(read_style_file(DEFAULT_STYLE_FILE))

def sonify(data_filepath, sonify_type, style_filepath, length=15, system='stereo'):

        # Read YAML file
        style = read_style_file(style_filepath)
        
        # Set up Sonification elements
        score, generator = setup_style(sonify_type, style, length)
        sources = setup_data(data_filepath, sonify_type, style)

        # Render sonification
        sonification = Sonification(score, sources, generator, system)
        sonification.render()

        return sonification



def quick_sonify(x_data, y_data, sound='default', y_params=['cutoff'], chordal=True, length=15, system='stereo'):

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
      
def validate_params(params):
      
        if isinstance(params, str):
              if ',' in params:
                    params = params.split(',')
        
        if isinstance(params, ):
              pass


def setup_style(sonify_type, style, length):
        
        default_path = Path('src', 'style_files', sonify_type, 'default.yml')
        default_style = read_style_file(default_path)

        # Read and validate sound to set up STRAUSS Generator 

        # Load default sound if not specified by user
        sound = style.get('sound', default_style['sound'])
        sound = validate_type(sound, str)

        folder, path = find_sound(sound)
        
        generator = Synthesizer() if folder == 'synths' else Sampler()
        generator.load_preset(path)

        # Read and validate parameters

        # Again use default if none specified
        params = style.get('parameters', default_style['parameters'])

        # TO DO - move the parameter validation into the 'setup_data' func
        if 'cutoff' in params:
                generator.modify_preset({'filter':'on'})

        chord_mode = style.get('chord_mode', default_style['chord_mode'])

        notes = [[]]

        if chord_mode.lower() == 'on':
              chord = style.get('chord', default_style['chord'])

              if chord.lower() == 'random':
                    notes = random_chord()
              else:
                    # To do - parse chord and voice it
                    pass
        else:
              # To do - handle notes/scales
              pass
        
        score = Score(notes,length)

        return score, generator

def setup_score(chordal, length):

        notes = random_chord() if chordal else [[random.choice(notesharps) + '3']]
        
        return Score(notes, length)

def setup_data(x_data, y_data, y_params):
        
        data = {'pitch': [0,1,2,3],
                'time_evo': [x_data]*4}
        
        # Set up map limits and parameter limits
        m_lims = {'time_evo': ('0%','100%')}
        p_lims = {}
        
        for param in y_params:
                data[param] = [y_data]*4
                m_lims[param] = ('0%','100%')
                p_lims[param] = param_lim_dict[param]

        # set up source
        sources = Objects(data.keys())
        sources.fromdict(data)
        sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

        return sources

nice_limits = {
        'cutoff': (0.1,0.9),
        'pitch_shift': (0,24),
        'volume': (0,1)
}

def random_chord():

        root_note = random.choice(notesharps)
        fifth = add_interval(root_note, 7)

        interval_pairs = [[11,2],[4,2],[4,11],[10,5]]
        chosen_pair = random.choice(interval_pairs)
        random.shuffle(chosen_pair)

        third_note = add_interval(root_note, chosen_pair[0])
        fourth_note = add_interval(root_note, chosen_pair[1])

        return [[root_note + '2', fifth + '3', third_note + '4', fourth_note + '5']]

def add_interval(root, interval):
        return notesharps[(notesharps.index(root) + interval) % len(notesharps)]
        
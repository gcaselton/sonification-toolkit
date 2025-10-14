from strauss.sonification import Sonification
from strauss.sources import Objects, Events, param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer, Sampler
from strauss.notes import notesharps
from musical_scales import scale as parse_scale
from style_schemas import BaseStyle, defaults

from pychord import Chord
from pychord.utils import transpose_note
from paths import *

import lightkurve as lk
import numpy as np
import pandas as pd
import random, os, yaml
import matplotlib.pyplot as plt
from pathlib import Path

def read_YAML_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            YAML_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return YAML_dict

def sonify(data, style_filepath, sonify_type, length=15, system='mono'):

      # Load user and default styles
      user_style = read_YAML_file(style_filepath)
      default_style = defaults[sonify_type]

      # Merge the user and default styles, overwriting defaults with user's where present
      merged = {**default_style, **{k: v for k, v in user_style.items() if v is not None}}

      # Validate the merged result NOTE problem is here
      validated_style = BaseStyle.model_validate(merged)
        
      # Set up Sonification elements
      score, sources, generator = setup_strauss(data, validated_style, sonify_type, length)

      # Render sonification
      sonification = Sonification(score, sources, generator, system)

      sonification.render()

      return sonification



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


def setup_strauss(data, style: BaseStyle, sonify_type, length):

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
            
            if style.scale:
                  generator.load_preset('staccato')
                  generator.modify_preset({'volume_envelope': {'use':'on', 'R':0.2}})
            else:
                  generator.load_preset('sustain')
                  generator.modify_preset({'looping': 'forwardback', 'loop_start': 0.2, 'loop_end': 5.})
            
      
      # generator = Synthesizer() if folder == 'synths' else Sampler()
      # path_stem = str(path.with_suffix(""))
      # generator.load_preset(path_stem)

      # Check if filter needs switching on
      if 'cutoff' in style.parameters:
            generator.modify_preset({'filter': 'on'})

      # Set up the data and Sources
      if sonify_type == 'light_curve':
            sources = light_curve_sources(data, style, length)

      # Handle chord or scale
      if style.chord_mode == 'on':

            if style.chord.lower() == 'random' or not style.chord:
                  notes = random_chord()
            else:
                  notes = voice_chord(style.chord)
      elif style.chord_mode == 'off' and style.scale:

            root, quality = style.scale.split(' ', 1)
            notes = parse_scale(root, quality, 3) # 3 octave range as default, could give users the option?
            notes = [[str(note - 12) for note in notes]] # -12 so it starts on 2nd octave
            print(notes)
      else:
            notes = [['A3']]
      
      score = Score(notes,length)

      return score, sources, generator

def univariate_sources(xy_data: tuple, params, chord_mode, data_mode):
      pass

def scale_events(x, y, params, length):

      user_settings = read_YAML_file(SETTINGS_FILE)
      resolution = user_settings['data_resolution']

      new_x, new_y = downsample_data(x, y, length, resolution)

      data = {'pitch': new_y,
              'time': new_x}

      m_lims = {'time': ('0%','101%'),
              'pitch': ('0%','100%')}
      
      p_lims = {}

      for p in params:
            if p not in data:
                  data[p] = new_y
                  m_lims[p] = ('0%', '100%')
                  p_lims[p] = tuple(params[p])
      
      sources = Events(data.keys())
      sources.fromdict(data)
      sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

      return sources

def light_curve_sources(data, style, length):

      if isinstance(data, tuple):

            x = data[0]
            y = data[1]
      elif isinstance(data, Path) and data.suffix == '.fits':

            lc = lk.read(data)
            lc = lc.remove_nans()
            x = lc.time.value
            y = lc.flux.value
      elif isinstance(data, Path) and data.suffix == '.csv':
            df = pd.read_csv("data.csv")

            x = df.iloc[:, 0].to_list()  # first column
            y = df.iloc[:, 1].to_list()  # second column


      x = ensure_array(x)
      y = ensure_array(y)

      pitches = [0,1,2,3] if style.chord_mode == 'on' else [0]

      if 'pitch' in style.parameters:

            if style.scale:
                  return scale_events(x, y, style.parameters, length)
            else:
                  # Change pitch for pitch_shift if we want Objects type
                  lims = style.parameters.pop('pitch')
                  style.parameters['pitch_shift'] = lims
     
      data_dict = {'pitch': pitches, 
              'time_evo': [x]*len(pitches)}
      m_lims = {'time_evo': ('0%', '100%')}
      p_lims = {}

      for p in style.parameters:
            data_dict[p] = [y]*len(pitches)
            m_lims[p] = ('0%', '100%')
            p_lims[p] = tuple(style.parameters[p])

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


        
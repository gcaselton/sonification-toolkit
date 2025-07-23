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
import random
import matplotlib.pyplot as plt
import sounddevice as sd
from pathlib import Path
import os
import yaml

def read_style_file(filepath):
    
    filepath = Path(filepath)
    with filepath.open(mode='r') as fdata:
        try:
            style_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
              raise ValueError("Error reading YAML file, please check the filepath and ensure correct YAML syntax.") from err
    
    return style_dict

def sonify(data_filepath, style_filepath, sonify_type, length=15, system='stereo'):

      # Load user and default styles
      user_style = read_style_file(style_filepath)
      default_style = defaults[sonify_type]

      # Merge the user and default styles, overwriting defaults with user's where present
      merged = {**default_style, **user_style}

      # Validate the merged result
      validated_style = BaseStyle.model_validate(merged)
        
      # Set up Sonification elements
      score, sources, generator = setup_strauss(data_filepath, validated_style, sonify_type, length)

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


def setup_strauss(data_filepath, style: BaseStyle, sonify_type, length):

      # Read and find sound to create Generator
      folder, path = find_sound(style.sound)
      generator = Synthesizer() if folder == 'synths' else Sampler()
      path_stem = str(path.with_suffix(""))
      generator.load_preset(path_stem)

      # Check if filter needs switching on
      if 'cutoff' in style.parameters:
            generator.modify_preset({'filter': 'on'})

      # Set up the data and Sources
      args = data_filepath, style.parameters, style.chord_mode, style.data_mode, style.scale

      if sonify_type == 'light_curve':
            sources = light_curve_sources(*args)

      # Handle chord or scale
      if style.chord_mode == 'on':

            if style.chord.lower() == 'random' or not style.chord:
                  notes = random_chord()
            else:
                  notes = voice_chord(style.chord)
      elif style.chord_mode == 'off' and style.scale:

            root, quality = style.scale.split(' ', 1)
            notes = parse_scale(root, quality, 3)
            notes = [[str(note) for note in notes]]
      else:
            notes = [['C3']]
      
      score = Score(notes,length)

      return score, sources, generator

def univariate_sources(xy_data: tuple, params, chord_mode, data_mode):
      pass

def scale_events(x, y, params):

      data = {'pitch': y,
              'time': x}

      m_lims = {'time': ('0%','101%'),
              'pitch': ('0%','100%')}
      
      p_lims = {}

      for p in params:
            if p not in data:
                  data[p] = y
                  m_lims[p] = ('0%', '100%')
                  p_lims[p] = tuple(params[p])
      
      sources = Events(data.keys())
      sources.fromdict(data)
      sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

      return sources

def light_curve_sources(data_filepath, params, chord_mode, data_mode, scale):

      lc = lk.read(data_filepath)
      lc = lc.remove_nans()

      x = np.asarray(lc.time.value)
      y = np.asarray(lc.flux)

      pitches = [0,1,2,3] if chord_mode == 'on' else [0]

      if 'pitch' in params:

            if scale:
                  return scale_events(x, y, params)
            else:
                  # Change pitch for pitch_shift if we want Objects type
                  lims = params.pop('pitch')
                  params['pitch_shift'] = lims

      if data_mode == 'discrete':
            time, upper_lim = 'time', '101%'
      else:
            time, upper_lim = 'time_evo', '100%'
     
     # Clean this up - time needs to be x for discrete pitches
      data = {'pitch': pitches, 
              time: [x]*len(pitches)}
      m_lims = {time: ('0%', upper_lim)}
      p_lims = {}

      for p in params:
            data[p] = [y]*len(pitches)
            m_lims[p] = ('0%', '100%')
            p_lims[p] = tuple(params[p])

      # We want discrete notes (Events) if data mode is discrete
      # sources = Events(data.keys()) if data_mode == 'discrete' else Objects(data.keys())
      sources = Objects(data.keys())
      sources.fromdict(data)
      sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

      return sources


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


        
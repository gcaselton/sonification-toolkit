from strauss.sonification import Sonification
from strauss.sources import Objects
from strauss.sources import param_lim_dict
from strauss.score import Score
from strauss.generator import Synthesizer
from strauss.notes import notesharps

import lightkurve as lk
import numpy as np
import random
import matplotlib.pyplot as plt
import sounddevice as sd

# sound_systems = {
#     1 : 'mono',
#     2 : 'stereo',
#     6 : '5.1',
#     8 : '7.1'
# }

# def get_sound_system():
#     device_info = sd.query_devices(sd.default.device['output'])
#     return sound_systems[device_info['max_output_channels']]


def sonify(x_data, y_data, sound='synth', y_params=['cutoff'], chordal=True, system='stereo', length=15):

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

def setup_generator(preset):

        generator = Synthesizer()
        generator.modify_preset({'filter':'on'})

        if preset != 'synth':
                generator.load_preset(preset)

        return generator

def setup_score(chordal, length):

        notes = random_chord() if chordal else [[random.choice(notesharps) + '3']]
        
        return Score(notes, length)

def setup_sources(x_data, y_data, y_params):
        
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
        
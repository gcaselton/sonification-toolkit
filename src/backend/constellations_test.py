from extensions import sonify
from paths import STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR

import matplotlib.pyplot as plt
import wavio as wav
from strauss.sonification import Sonification
from strauss.sources import Events
from strauss import channels
from strauss.score import Score
import numpy as np
from strauss.generator import Sampler
import IPython.display as ipd
import pathlib
import pandas as pd

style = STYLE_FILES_DIR / 'constellations' / 'stars_appearing.yml'
data = SUGGESTED_DATA_DIR / 'constellations' / 'cassiopeia_test.csv'

soni = sonify(data=data, style_file=style, sonify_type='constellations', length=10, system='stereo')
soni.hear()


#######################################################################################################

# chords = [['C#3','F#3', 'G#3', 'D#4','F4']]
# length = 20
# score =  Score(chords, length)

# data = SUGGESTED_DATA_DIR / 'constellations' / 'cassiopeia_test.csv'
# data_filepath = str(data)

# if data_filepath.endswith('.csv'):

#     df = pd.read_csv(data_filepath)
# else:
#     raise ValueError('Data file must be a .csv file.')

# x = [0,1,2,3,4]
# azi = np.linspace(0.25,0.75,5)
# y = [4,3,0,1,2]
# polar = [0.5,0.5,0.5,0.5,0.5]

# data = {
#     'time': x,
#     'azimuth': azi,
#     'pitch': y,
#     'polar': polar
# }

# m_lims = {
#     'time': ('0%', '104%'),
#     'azimuth': (0,1),
#     'polar': (0,1)
# }

# p_lims = {
#     'azimuth': (0.25, 0.75),
#     'polar': (0.5,0.5)
# }

# sources = Events(data.keys())
# sources.fromdict(data)
# sources.apply_mapping_functions(map_lims=m_lims, param_lims=p_lims)

# sampler = Sampler(SAMPLES_DIR / 'Mallets')
# sampler.preset_details("default")

# system = "stereo"

# soni = Sonification(score, sources, sampler, system)
# soni.render()
# soni.hear()

# data_dict = {
#     'time': df['magnitude'].to_numpy(dtype=float),
#     'volume': df['magnitude'].to_numpy(dtype=float),
#     'azimuth': df['ra'].to_numpy(dtype=float),
#     'polar': df['dec'].to_numpy(dtype=float),
#     'pitch': df['colour'].to_numpy(dtype=float)
# }

# maplims =  {'azimuth': (0, 360),
#             'polar': (0, 180), 
#             'time': ('0%', '104%'),
#             'pitch' : ('0%', '100%'),
#             'volume' : ('0%', '100%')}

# for key, value in data_dict.items():
#     print(f'length of {key}:  {len(value)}')
#     print(f'type of {key}: {type(value)}')

# sources = Events(data_dict.keys())
# sources.fromdict(data_dict)
# sources.apply_mapping_functions(map_lims=maplims)

# sampler = Sampler(SAMPLES_DIR / 'Mallets')
# sampler.preset_details("default")

# system = "stereo"

# soni = Sonification(score, sources, sampler, system)
# soni.render()
# soni.hear()


###########################################################################################################

# chords = [['C#3','F#3', 'G#3', 'D#4','F4']]
# length = "1m 30s"
# score =  Score(chords, 30)

# datafile = SUGGESTED_DATA_DIR / 'constellations' / 'stars_paranal.txt'
# mapcols =  {'azimuth':1, 'polar':0, 'volume':2, 'time':2, 'pitch':3}

# mapvals =  {'azimuth': lambda x : x,
#             'polar': lambda x : 90.-x,
#             'time': lambda x : x,
#             'pitch' : lambda x: -x,
#             'volume' : lambda x : (1+np.argsort(x).astype(float))**-0.2}

# maplims =  {'azimuth': (0, 360),
#             'polar': (0, 180), 
#             'time': ('0%', '104%'),
#             'pitch' : ('0%', '100%'),
#             'volume' : ('0%', '100%')}

# events = Events(mapcols.keys())
# events.fromfile(datafile, mapcols)
# events.apply_mapping_functions(map_funcs=mapvals, map_lims=maplims)

# sampler = Sampler(SAMPLES_DIR / 'Mallets')
# sampler.preset_details("default")

# system = "stereo"

# soni = Sonification(score, events, sampler, system)
# soni.render()
# soni.hear()
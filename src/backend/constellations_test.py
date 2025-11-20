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

# soni = sonify(data=data, style_file=style, sonify_type='constellations', length=20, system='stereo')
# soni.hear()


#######################################################################################################

datafile = SUGGESTED_DATA_DIR / 'constellations' / 'stars_paranal.txt'
mapcols =  {'azimuth':1, 'polar':0, 'volume':2, 'time':2, 'pitch':3}

chords = [['C#3','F#3', 'G#3', 'D#4','F4']]
length = "1m 30s"
score =  Score(chords, length)

data_filepath = str(data)

if data_filepath.endswith('.csv'):

    df = pd.read_csv(data_filepath)
else:
    raise ValueError('Data file must be a .csv file.')

# # Remove rows with NaN values in any of the columns used
# input_params = [mapping.input for mapping in style.parameters]
# df = df.dropna(subset=input_params)

data_dict = {
    'time': df['magnitude'].to_numpy(dtype=float),
    'volume': df['magnitude'].to_numpy(dtype=float),
    'azimuth': df['ra'].to_numpy(dtype=float),
    'polar': df['dec'].to_numpy(dtype=float),
    'pitch': df['colour'].to_numpy(dtype=float)
}

# sources = Events(data_dict.keys())
# sources.fromdict(data_dict)
# sources.apply_mapping_functions()


events = Events(mapcols.keys())
events.fromfile(datafile, mapcols)
events.apply_mapping_functions()

sampler = Sampler(SAMPLES_DIR / 'Mallets')
sampler.preset_details("default")

system = "stereo"

soni = Sonification(score, events, sampler, system)
soni.render()
soni.hear()


###########################################################################################################

# chords = [['C#3','F#3', 'G#3', 'D#4','F4']]
# length = "1m 30s"
# score =  Score(chords, length)

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
# events.apply_mapping_functions(mapvals, maplims)

# sampler = Sampler(SAMPLES_DIR / 'Mallets')
# sampler.preset_details("default")

# system = "stereo"

# soni = Sonification(score, events, sampler, system)
# soni.render()
# soni.hear()
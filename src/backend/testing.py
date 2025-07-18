from extensions import sonify, read_style_file
from paths import STYLE_FILES_DIR

from strauss.sonification import Sonification
from strauss.sources import Objects
from strauss import channels
from strauss.score import Score
from strauss.generator import Synthesizer

from scipy.interpolate import interp1d
import lightkurve as lk
from lightkurve import LightCurveFile
import numpy as np
import matplotlib.pyplot as plt
import os
from pathlib import Path

# x_axis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
# y_axis = [2, 4, 19, 1, 11, 21, 15, 4, 6, 22, 20, 18]

# my_x = np.asarray(x_axis)
# my_y = np.asarray(y_axis)

# my_x = np.linspace(0,1,100) # Normalising x between 0-1 means you don't have to apply mapping functions
# my_y = np.random.uniform(0, 1, 100)


# my_y = (my_y - my_y.min()) / (my_y.max() - my_y.min())

# # seed the randoms...
# np.random.seed(0)

# # construct arrays of size N for x and y...
# N = 300
# x = np.linspace(0,1,N)
# y = np.zeros(N)

# # define a Gaussian function...
# gauss = lambda x, m, s: np.exp(-(x-m)**2/s) 

# # place some randomised gaussians...
# for i in range(10):
#     a,b,c = np.random.random(3)
#     y += gauss(x, b, 1e-3*c) * a ** 3

# # now add some noise and normalise
# y += np.random.random(N) * y.mean()
# y /= y.max()*1.2
# y += 0.15

s_type = 'light_curve'

data_path = Path('src', 'backend', 'tmp', '2070bf69d1291ba08e67a3191f511107.fits')
style_path = Path('src', 'style_files', 'my_style.yml')

s = sonify(data_path, style_path, s_type)
s.hear()

# generator = Synthesizer()
# generator.modify_preset({'filter':'on'})

# length = 15
# notes = [["C2","G2","C3","G3"]]
# score =  Score(notes, length)

# data = {'pitch':[0,1,2,3],
#         'time_evo':[my_x]*4,
#         'cutoff':[my_y]*4}

# lims = {'time_evo': ('0%','100%'),
#         'cutoff': ('0%', '100%')} # This fixes it

# # set up source
# sources = Objects(data.keys())
# sources.fromdict(data)
# sources.apply_mapping_functions()

# soni = Sonification(score, sources, generator, 'stereo')
# soni.render()
# soni.hear()


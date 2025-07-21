from extensions import sonify, read_style_file
from paths import STYLE_FILES_DIR

from strauss.sonification import Sonification
from strauss.sources import Objects, Events
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

# x_axis = [0,1,2,3,4,5,6,7,8,9,10,11]
# y_axis = [2, 4, 19, 1, 11, 21, 15, 4, 6, 22, 20, 18]

x_axis = np.arange(100)
y_axis = np.random.uniform(0, 100, 100)

my_x = np.asarray(x_axis)
my_y = np.asarray(y_axis)

my_y = (my_y - my_y.min()) / (my_y.max() - my_y.min())


# seed the randoms...
np.random.seed(0)

# construct arrays of size N for x and y...
N = 100
x = np.linspace(0,1,N)
y = np.zeros(N)

# define a Gaussian function...
gauss = lambda x, m, s: np.exp(-(x-m)**2/s) 

# place some randomised gaussians...
for i in range(10):
    a,b,c = np.random.random(3)
    y += gauss(x, b, 1e-3*c) * a ** 3

# now add some noise and normalise
y += np.random.random(N) * y.mean()
y /= y.max()*1.2
y += 0.15

generator = Synthesizer()

length = 15
notes = [["C3","D3","E3","G3","B3","C4","D4","E4","G4","B4","C5","D5","E5","G5","B5"]]
score =  Score(notes, length)

data = {'pitch': y,
        'time': x}

lims = {'time': ('0%','101%'),
        'pitch': ('0%','100%')}

p_lims = {}

# set up source
sources = Events(data.keys())
sources.fromdict(data)

print(data)
print(lims)
print(p_lims)
sources.apply_mapping_functions(map_lims=lims, param_lims=p_lims)

soni = Sonification(score, sources, generator, 'stereo')
soni.render()
soni.hear()


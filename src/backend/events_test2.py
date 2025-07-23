
from strauss.sonification import Sonification
from strauss.sources import Objects, Events
from strauss import channels
from strauss.score import Score
from strauss.generator import Synthesizer

from scipy.interpolate import interp1d
import numpy as np
import matplotlib.pyplot as plt
import os
from pathlib import Path

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

generator.modify_preset({'filter': 'on'})

length = 15
chord = [['C3', 'G3', 'E4', 'B4']]
score =  Score(chord, length)

data = {'pitch': [0,1,2,3],
        # What would need to go here for time and cutoff?
        }

# set up source
sources = Events(data.keys())
sources.fromdict(data)
sources.apply_mapping_functions()

soni = Sonification(score, sources, generator, 'stereo')
soni.render()
soni.hear()


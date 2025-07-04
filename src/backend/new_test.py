import matplotlib.pyplot as plt
from strauss.sonification import Sonification
from strauss.sources import Objects, Events
from strauss import channels
from strauss.score import Score
from strauss.generator import Synthesizer
import IPython.display as ipd
import os
from scipy.interpolate import interp1d
import numpy as np
import lightkurve as lk

x_axis = [0,1,2,3,4,5,6,7,8,9,10,11]
y_axis = [2, 4, 19, 1, 11, 21, 15, 4, 6, 22, 20, 18]

my_x = np.asarray(x_axis)
my_y = np.asarray(y_axis)

my_y = (my_y - my_y.min()) / (my_y.max() - my_y.min())

generator = Synthesizer()

notes = [["C3","D3","E3","G3","B3","C4","D4","E4","G4","B4","C5","D5","E5","G5","B5"]]
score =  Score(notes, 15)
        
maps = {'pitch':my_y,
        'time': my_x}

system = "mono"

lims = {'time': ('0%','101%'),
        'pitch': ('0%','100%')}

# set up source
sources = Events(maps.keys())
sources.fromdict(maps)
sources.apply_mapping_functions(map_lims=lims)

soni = Sonification(score, sources, generator, system)
soni.render()
soni.hear()
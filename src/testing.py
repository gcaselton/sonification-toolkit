from backend.extensions import sonify, read_style_file

from strauss.sonification import Sonification
from strauss.sources import Objects
from strauss import channels
from strauss.score import Score
from strauss.generator import Synthesizer

from scipy.interpolate import interp1d
import lightkurve as lk
import numpy as np
import matplotlib.pyplot as plt
import os
from pathlib import Path

x = [0,1,2,3,4,5,6,7,8,9,10,11]
y = [2, 4, 19, 1, 11, 21, 15, 4, 6, 22, 20, 18]

# star_name = input('Enter name of star to sonify: ')

# star_name = 'v1129 cen'

# sonify_star(star_name)

# quick_sonify(x,y)

# path = os.path.join('src','backend', 'tmp', 'c11595af-3689-4831-93d5-b88875042548.fits')
    
# time, flux = extract_time_flux(path)

# print(time, flux)

s_type = 'light_curve'

data_path = Path('src', 'backend', 'tmp', 'c6ea8078764d2020917aaaa059ce7728.fits')
style_path = Path('src', 'style_files', s_type, 'default.yml')
style = read_style_file(style_path)

# s = sonify(data_path, s_type, style)
# s.hear()




# seed the randoms...
np.random.seed(0)

# construct arrays of size N for x and y...
N = 300
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
generator.modify_preset({'filter':'on'})

length = 15
notes = [["C2","G2","C3","G3"]]
score =  Score(notes, length)


lc = lk.read(data_path)
lc.plot()

# plt.show()

lc = lc.remove_nans()

# NOTE - this gets close to fixing the problem
time = np.asarray(lc.time.value)
flux = np.asarray(lc.flux.value)

data = {'pitch':[0,1,2,3],
        'time_evo':[time]*4,
        'cutoff':[flux]*4}

# set up source
sources = Objects(data.keys())
sources.fromdict(data)
sources.apply_mapping_functions()

soni = Sonification(score, sources, generator, 'stereo')
soni.render()
soni.hear()


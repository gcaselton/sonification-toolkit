from backend.extensions import sonify, read_style_file
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

data_path = Path('src', 'backend', 'tmp', 'c6ea8078764d2020917aaaa059ce7728.fits')
style_path = Path('src', 'style_files', 'light_curves', 'default.yml')
style = read_style_file(style_path)

s = sonify(data_path, 'light_curves', style, 15, 'stereo')
# NOTE to do - plays a silent sonification. Fix this
s.hear()


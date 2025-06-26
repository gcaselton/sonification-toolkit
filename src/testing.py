from star_query import sonify_star
from backend.extensions import quick_sonify
from backend.api.light_curve import extract_time_flux
import lightkurve as lk
import numpy as np
import matplotlib.pyplot as plt
import os


x = [0,1,2,3,4,5,6,7,8,9,10,11]
y = [2, 4, 19, 1, 11, 21, 15, 4, 6, 22, 20, 18]

# star_name = input('Enter name of star to sonify: ')

# star_name = 'v1129 cen'

# sonify_star(star_name)

quick_sonify(x,y)

# path = os.path.join('src','backend', 'tmp', 'c11595af-3689-4831-93d5-b88875042548.fits')
    
# time, flux = extract_time_flux(path)

# print(time, flux)

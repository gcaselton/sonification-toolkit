import pandas as pd
import numpy as np
from paths import SUGGESTED_DATA_DIR
from skyfield.data import stellarium
from skyfield.api import load


SUGGESTED_DIR = SUGGESTED_DATA_DIR / 'constellations'
HYG_DATA = SUGGESTED_DIR / 'hyg.csv'

# Parse constellation line data into a dictionary
line_data = SUGGESTED_DIR / 'constellationship.fab'
with load.open(str(line_data)) as f:
    CONST_SHAPES = dict(stellarium.parse_constellations(f))


df = pd.read_csv(HYG_DATA)

for const in CONST_SHAPES.keys():

    df['is_in_const'] = df['hip'].isin()


# lines = CONST_SHAPES[IAU_names[constellation_name]]
# star_ids = list(set([n for ns in lines for n in ns]))
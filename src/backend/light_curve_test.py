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

style = STYLE_FILES_DIR / 'light_curves' / 'nuclear.yml'
data = SUGGESTED_DATA_DIR / 'light_curves' / 'beta_persei.fits'

soni = sonify(data=data, style_file=style, sonify_type='light_curves', length=20, system='mono')
soni.hear()
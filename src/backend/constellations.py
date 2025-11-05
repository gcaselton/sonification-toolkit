from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from extensions import sonify
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR, SETTINGS_FILE
from strauss.sources import param_lim_dict
from sounds import all_sounds, online_sounds, local_sounds, asset_cache, format_name
from config import GITHUB_USER, GITHUB_REPO
import logging, httpx, yaml, requests, os, base64, hashlib, uuid, aiofiles, zipfile, json, gc

import lightkurve as lk
import numpy as np
import matplotlib
matplotlib.use("Agg") 
import matplotlib.pyplot as plt
from io import BytesIO
from astroquery.simbad import Simbad


router = APIRouter(prefix='/constellations')

CATEGORY = 'constellations'

STYLES_DIR = STYLE_FILES_DIR / CATEGORY
SUGGESTED_DIR = SUGGESTED_DATA_DIR / CATEGORY
HYG_DATA = SUGGESTED_DIR / 'hyg.csv'

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)



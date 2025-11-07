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
import pandas as pd
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

class ConstellationRequest(BaseModel):
    name: str
    n_stars: int

IAU_names = {
    "Pisces": "Psc",
    "Cetus": "Cet",
    "Andromeda": "And",
    "Phoenix": "Phe",
    "Pegasus": "Peg",
    "Sculptor": "Scl",
    "Cassiopeia": "Cas",
    "Octans": "Oct",
    "Cepheus": "Cep",
    "Tucana": "Tuc",
    "Hydrus": "Hyi",
    "Ursa Minor": "UMi",
    "Eridanus": "Eri",
    "Perseus": "Per",
    "Triangulum": "Tri",
    "Fornax": "For",
    "Aries": "Ari",
    "Horologium": "Hor",
    "Reticulum": "Ret",
    "Camelopardalis": "Cam",
    "Mensa": "Men",
    "Taurus": "Tau",
    "Dorado": "Dor",
    "Caelum": "Cae",
    "Pictor": "Pic",
    "Auriga": "Aur",
    "Orion": "Ori",
    "Lepus": "Lep",
    "Columba": "Col",
    "Monoceros": "Mon",
    "Gemini": "Gem",
    "Carina": "Car",
    "Puppis": "Pup",
    "Canis Major": "CMa",
    "Lynx": "Lyn",
    "Volans": "Vol",
    "Canis Minor": "CMi",
    "Chamaeleon": "Cha",
    "Cancer": "Cnc",
    "Vela": "Vel",
    "Ursa Major": "UMa",
    "Hydra": "Hya",
    "Pyxis": "Pyx",
    "Leo": "Leo",
    "Leo Minor": "LMi",
    "Draco": "Dra",
    "Antlia": "Ant",
    "Sextans": "Sex",
    "Crater": "Crt",
    "Centaurus": "Cen",
    "Musca": "Mus",
    "Virgo": "Vir",
    "Crux": "Cru",
    "Corvus": "Crv",
    "Coma Berenices": "Com",
    "Canes Venatici": "CVn",
    "Boötes": "Boo",
    "Circinus": "Cir",
    "Apus": "Aps",
    "Lupus": "Lup",
    "Libra": "Lib",
    "Triangulum Australe": "TrA",
    "Serpens": "Ser",
    "Norma": "Nor",
    "Corona Borealis": "CrB",
    "Scorpius": "Sco",
    "Hercules": "Her",
    "Ophiuchus": "Oph",
    "Ara": "Ara",
    "Pavo": "Pav",
    "Sagittarius": "Sgr",
    "Corona Australis": "CrA",
    "Telescopium": "Tel",
    "Lyra": "Lyr",
    "Scutum": "Sct",
    "Aquila": "Aql",
    "Sagitta": "Sge",
    "Vulpecula": "Vul",
    "Cygnus": "Cyg",
    "Capricornus": "Cap",
    "Delphinus": "Del",
    "Microscopium": "Mic",
    "Indus": "Ind",
    "Aquarius": "Aqr",
    "Equuleus": "Equ",
    "Piscis Austrinus": "PsA",
    "Grus": "Gru",
    "Lacerta": "Lac"
}


@router.post("/plot-constellation/")
async def plot_constellation(constellation: ConstellationRequest):

    # load CSV
    df = pd.read_csv(HYG_DATA)

    # select a constellation, e.g., Pegasus
    constellation_name = IAU_names[constellation.name]
    stars_in_constellation = df[df['con'] == constellation_name].copy()

    # sort by brightness (smaller magnitude = brighter)
    stars_sorted = stars_in_constellation.sort_values('mag')

    # choose top N stars
    N = constellation.n_stars
    top_stars = stars_sorted.head(N).copy()

    plt.figure(figsize=(6,6))

    ra = top_stars['ra'].copy()

    # Detect if the constellation crosses the 0h line (RA wraparound)
    if ra.max() - ra.min() > 12:  # difference > 12h → likely wraparound
        ra[ra < 12] += 24

    # RA/Dec as x/y
    x = ra
    y = top_stars['dec']

    # smaller marker size inversely proportional to magnitude
    sizes = np.sqrt(10 / top_stars['mag']) * 50

    plt.scatter(x, y, s=sizes, c='white', alpha=1.0)

    # add padding around stars
    padding_ra = (x.max() - x.min()) * 0.2
    padding_dec = (y.max() - y.min()) * 0.2
    plt.xlim(x.min() - padding_ra, x.max() + padding_ra)
    plt.ylim(y.min() - padding_dec, y.max() + padding_dec)

    # Label stars with proper names if available (using unwrapped RA)
    for i, row in top_stars.iterrows():
        this_ra = ra.loc[i]  # use the corrected RA value
        if pd.notna(row['proper']) and str(row['proper']).strip() != "":
            plt.text(
                this_ra + 0.2,   # small offset so names don't overlap dots
                row['dec'] + 0.2,
                row['proper'],
                color='white',
                fontsize=8,
                ha='left',
                va='bottom'
            )

    plt.gca().set_facecolor('black')
    # plt.title(f"{constellation.name} - Top {N} Brightest Stars")
    plt.xlabel("RA")
    plt.ylabel("Dec")
    plt.gca().invert_xaxis()
    plt.xticks([])
    plt.yticks([])

    # send bytes to buffer
    buf = BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close()
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # Clean up memory
    buf.close()
    gc.collect()

    return {'image': img_base64}

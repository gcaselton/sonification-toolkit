from fastapi import APIRouter, HTTPException

from pydantic import BaseModel
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR
from context import session_id_var
import logging, base64, uuid, gc

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg") 
import matplotlib.pyplot as plt
from io import BytesIO
from utils import resolve_file
from core import SonificationRequest, DataRequest
from skyfield.data import stellarium
from skyfield.api import load
router = APIRouter(prefix='/constellations')

CATEGORY = 'constellations'

STYLES_DIR = STYLE_FILES_DIR / CATEGORY
SUGGESTED_DIR = SUGGESTED_DATA_DIR / CATEGORY
HYG_DATA = SUGGESTED_DIR / 'hyg.csv'

# Parse constellation line data into a dictionary
line_data = SUGGESTED_DIR / 'constellationship.fab'
with load.open(str(line_data)) as f:
    CONST_SHAPES = dict(stellarium.parse_constellations(f))

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)

class ConstellationRequest(BaseModel):
    name: str
    n_stars: int

class NStarsRequest(BaseModel):
    name: str
    max_magnitude: float

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

def get_constellation(constellation_name: str) -> pd.DataFrame:

    # load CSV
    df = pd.read_csv(HYG_DATA)

    # lines = CONST_SHAPES[IAU_names[constellation_name]]
    # star_ids = list(set([n for ns in lines for n in ns]))

    # # select a constellation
    # stars_in_constellation = df[df['hip'].isin(star_ids)].copy()

    stars_in_constellation = df[df['con'] == IAU_names[constellation_name]].copy()

    # sort by brightness (smaller magnitude = brighter)
    stars_sorted = stars_in_constellation.sort_values('magnitude')

    # correct RA for wraparound if needed
    stars_sorted['ra'] = correct_ra(stars_sorted['ra'])

    return stars_sorted


@router.post("/plot-csv/")
async def plot_csv(data: DataRequest):

    data_filepath = str(resolve_file(data.file_ref))

    if not data_filepath.endswith('.csv'):
        raise HTTPException(status_code=400, detail=f'Data file type must be .csv')
    
    df = pd.read_csv(data_filepath)
    image = plot_and_format_constellation(df)

    return {'image': image}

def correct_ra(ra):

    # Detect if the constellation crosses the 0h line (RA wraparound)
    
    if ra.max() - ra.min() > 12:  # difference > 12h → likely wraparound
        ra[ra < 12] += 24 # add 24h to RA values < 12h to unwrap

    # Invert so RA increases left → right
    ra = -ra

    return ra


def plot_and_format_constellation(df):

    plt.figure(figsize=(6,6))

    # RA/Dec as x/y
    x = df['ra']
    y = df['dec']

    # Calculate ranges for proportional offsets
    ra_range = x.max() - x.min()
    dec_range = y.max() - y.min()
    
    # Use 3-5% of the range as offset
    offset_ra = ra_range * 0.04
    offset_dec = dec_range * 0.04

    # smaller marker size inversely proportional to magnitude
    sizes = 180 * (10 ** (-0.4 * df['magnitude']))

    # sizes = (10/top_stars['mag']) ** 2

    # Color stars based on color index (B-V)
    # Using a colormap that approximates star colors
    # You can tweak 'plasma', 'inferno', or use custom mapping
    colors = df['colour']  # assuming 'colour' is B-V
    scatter = plt.scatter(
        x, y, s=sizes, c=colors, cmap='RdYlBu_r'
    )
    plt.colorbar(scatter, label='B-V Colour Index')  # optional legend for color index

    # add padding around stars
    padding_ra = ra_range * 0.2
    padding_dec = dec_range * 0.2
    plt.xlim(x.min() - padding_ra, x.max() + padding_ra)
    plt.ylim(y.min() - padding_dec, y.max() + padding_dec)

    # Label stars with proper names if available (using unwrapped RA)
    for i, row in df.iterrows():
        this_ra = df['ra'].loc[i]  # use the corrected RA value
        if pd.notna(row['proper']) and str(row['proper']).strip() != "":
            plt.text(
                this_ra + offset_ra,
                row['dec'] + offset_dec,
                row['proper'],
                color='white',
                fontsize=8,
                ha='left',
                va='bottom'
            )

    plt.gca().set_facecolor('black')
    plt.xlabel("RA")
    plt.ylabel("Dec")
    # plt.gca().invert_xaxis()
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

    return img_base64


@router.post("/plot-constellation/")
async def plot_constellation(constellation: ConstellationRequest):

    # select constellation
    stars_sorted = get_constellation(constellation.name)

    # choose top N stars
    N = constellation.n_stars
    top_stars = stars_sorted.head(N).copy()

    image = plot_and_format_constellation(top_stars)

    return {'image': image}

@router.post("/get-max-magnitude/")
async def get_magnitude(request: ConstellationRequest):
    
    # get and sort constellation stars
    stars_sorted = get_constellation(request.name)

    # choose top N stars
    N = request.n_stars
    top_stars = stars_sorted.head(N).copy()

    max_magnitude = max(top_stars['magnitude'].tolist())

    return {'max_magnitude': max_magnitude}

@router.post("/get-n-stars/")
async def get_n_stars(request: NStarsRequest):

    # sort by brightness (smaller magnitude = brighter)
    stars_sorted = get_constellation(request.name)

    # choose stars up to max magnitude
    max_magnitude = request.max_magnitude
    selected_stars = stars_sorted[stars_sorted['magnitude'] <= max_magnitude].copy()

    n_stars = len(selected_stars)

    return {'n_stars': n_stars}

@router.post("/save-refined/")
async def save_refined(request: ConstellationRequest):

    # get and sort constellation stars
    stars = get_constellation(request.name)
    refined_stars = stars.head(request.n_stars).copy()

    # save to tmp directory (overwriting any existing dataset)
    session_id = session_id_var.get()
    filename = f'{request.name}.csv'
    filepath = TMP_DIR / session_id / filename
    refined_stars.to_csv(filepath, index=False)

    file_ref = f'session:{filename}'

    return {'file_ref': file_ref}

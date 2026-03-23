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
from matplotlib.figure import Figure

from io import BytesIO
from utils import resolve_file
from request_models import DataRequest, NightSkyRequest, MagRequest
from skyfield.data import hipparcos
from skyfield.api import load, Star, wgs84
from timezonefinder import TimezoneFinder
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Literal

LOG = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

router = APIRouter(prefix='/night-sky')

CATEGORY = 'night_sky'

COMPASS_KEYS = ['N','NNE','NE','ENE','E','ESE','SE',
                'SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

COMPASS_RADS = np.linspace(0, 2*np.pi, len(COMPASS_KEYS)+1)[:-1]

COMPASS_MAP = dict(zip(COMPASS_KEYS, COMPASS_RADS))

LOG.info("Loading night sky reference data…")

with load.open(hipparcos.URL) as f:
    HIP_DF = pd.read_csv(
        f,
        sep='|',
        names=hipparcos._COLUMN_NAMES,
        compression=None,
        usecols=['HIP','Vmag','RAdeg','DEdeg','Plx','pmRA','pmDE','B-V'],
        na_values=['     ','       ','        ','            ','      '],
    )

HIP_DF.columns = (
    'hip','magnitude','ra_degrees','dec_degrees',
    'parallax_mas','ra_mas_per_year','dec_mas_per_year','BVcol'
)

HIP_DF = HIP_DF.assign(
    ra_hours=HIP_DF['ra_degrees']/15.0,
    epoch_year=1991.25,
).set_index('hip')

LOG.info("Hipparcos loaded")

EPH = load('de421.bsp')
EARTH = EPH['earth']

LOG.info("Ephemeris loaded")

TF = TimezoneFinder()


def handle_observer(observer: dict, style: dict):
        
    lat = float(observer['latitude'])
    lon = float(observer['longitude'])
    
    ra, dec = observer['ra'], observer['dec']
    
    position = position_observer(lat, lon, observer['date_time'])
    
    ra_hours = ra / 15
    
    star = Star(ra_hours=ra_hours, dec_degrees=dec)
    observed_star = position.observe(star)
    alt, az, dist = observed_star.apparent().altaz()
    
    # Convert observing direction to radians
    direction = COMPASS_MAP[observer['orientation']]
    
    az_rads = (az.radians - direction + np.pi) % (2*np.pi) - np.pi
    polar_degs = 90 - alt.degrees
    
    # Normalise
    azimuth = (az_rads + np.pi) / (2*np.pi)
    polar = polar_degs / 180
    
    params = style['parameters']
    
    params = [p for p in params if p['output'] not in ('azimuth', 'polar')]
    
    params.append({
        'input': azimuth,
        'input_range': ('0%', '100%'),
        'output': 'azimuth'
    })
    
    params.append({
        'input': polar,
        'input_range': ('0%', '100%'),
        'output': 'polar'
    })
    
    style['parameters'] = params
    
    print(style)
    
    return style
    
    
def position_observer(lat, lon, date_time):
    
    # Get time zone from coordinates
    time_zone = TF.timezone_at(lng=lon, lat=lat)

    # Get time information
    ts = load.timescale()
    dt = datetime.strptime(date_time, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ZoneInfo(time_zone))

    t = ts.from_datetime(dt)

    # Orient observer
    location = EARTH + wgs84.latlon(lat, lon)
    position = location.at(t)
    
    return position
      

@router.post('/get-stars/')
def get_star_data(request: NightSkyRequest):

    # Position observer
    position = position_observer(request.latitude, request.longitude, request.date_time)

    # Load in star data
    bright_stars = Star.from_dataframe(HIP_DF)
    stars = position.observe(bright_stars)
    alt, az, dist = stars.apparent().altaz()
    
    # Convert observing direction to radians
    direction = COMPASS_MAP[request.facing]

    # Narrow down to stars above horizon
    above_horizon = np.logical_and(alt.degrees > 0, np.isfinite(HIP_DF['BVcol']))

    # Build dataframe to save
    star_data = pd.DataFrame({
        "azimuth_rad": az.radians[above_horizon],
        "altitude_deg": alt.degrees[above_horizon],
        "magnitude": HIP_DF['magnitude'][above_horizon].values + 1e-2*np.random.random(above_horizon.sum()),
        "colour": HIP_DF['BVcol'][above_horizon].astype(float).values,
        "direction_offset": direction
    })

    # Calculate azimuth relative to observer
    star_data['relative_az'] = (star_data["azimuth_rad"] - direction + np.pi) % (2*np.pi) - np.pi

    # save to tmp directory (overwriting any existing dataset)
    session_id = session_id_var.get()
    filename = f'{CATEGORY}_full.csv'
    filepath = TMP_DIR / session_id / filename
    star_data.to_csv(filepath, index=False)

    file_ref = f'session:{filename}'

    return {'file_ref': file_ref}

@router.post('/refine-stars/')
def refine_stars(request: MagRequest):

    parent_file = resolve_file(request.file_ref)

    df = pd.read_csv(parent_file)

    # Refine by mag limit
    filtered = df[df['magnitude'] < request.maglim].copy()

    session_id = session_id_var.get()
    filename = f'{CATEGORY}_refined.csv'
    filepath = TMP_DIR / session_id / filename

    filtered.to_csv(filepath, index=False)
    file_ref = f'session:{filename}'
    
    return{'file_ref': file_ref}


def plot_and_format_stars(df: pd.DataFrame):

    if df.empty:
        raise ValueError("No stars to plot.")

    x = df["azimuth_rad"].values
    y = df["altitude_deg"].values
    mags = df["magnitude"].values
    bv_indices = df["colour"].values
    direction = df["direction_offset"].iloc[0]

    fig = Figure(figsize=(10,5))
    ax = fig.add_subplot(111)

    ax.set_facecolor('#0b0c15')

    bvrange = np.nanmax(bv_indices) - np.nanmin(bv_indices)
    delrange = 0.4 * bvrange

    sc = ax.scatter(
        (x - direction - np.pi) % (np.pi*2),
        y,
        s=20 * 10**((-mags * 0.4)),
        c=bv_indices,
        cmap='RdYlBu_r',
        vmin=np.nanmin(bv_indices) - delrange,
        vmax=np.nanmax(bv_indices) + delrange
    )

    ax.set_ylim(0, 90)
    ax.set_xlim(0, 2*np.pi)

    ax.set_xticks((COMPASS_RADS - direction - np.pi) % (np.pi*2))
    ax.set_xticklabels(COMPASS_KEYS)

    ax.set_xlabel("Compass Direction")
    ax.set_ylabel("Altitude [°]")
    ax.set_title(f"Found {len(df)} stars above horizon")

    buf = BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    buf.seek(0)

    img_base64 = base64.b64encode(buf.read()).decode("utf-8")
    buf.close()
    gc.collect()

    return img_base64


@router.post('/plot/')
def plot_star_data(request: DataRequest):

    data_filepath = str(resolve_file(request.file_ref))

    if not data_filepath.endswith('.csv'):
        raise HTTPException(status_code=400, detail=f'Data file type must be .csv')
    
    df = pd.read_csv(data_filepath)
    image = plot_and_format_stars(df)

    return {'image': image}


test_request = NightSkyRequest(
    latitude=21.54238,
    longitude=39.19797,
    facing='SSE',
    date_time="2026-02-01 19:00:00",
    maglim=4.5
)





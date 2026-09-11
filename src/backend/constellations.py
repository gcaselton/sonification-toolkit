from fastapi import APIRouter, HTTPException
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR
from context import session_id_var
import logging, base64, gc, json

import pandas as pd

import matplotlib
matplotlib.use("Agg")
matplotlib.rcParams['font.family'] = 'monospace'  # This sets the monospace font globally for all plots!

from matplotlib.figure import Figure
from matplotlib.colors import Normalize
from matplotlib.patches import FancyArrowPatch
from io import BytesIO
from utils import resolve_file
from request_models import DataRequest, NStarsRequest, ConstellationRequest

router = APIRouter(prefix='/constellations')

SONI_TYPE = 'constellations'

STYLES_DIR = STYLE_FILES_DIR / SONI_TYPE
SUGGESTED_DIR = SUGGESTED_DATA_DIR / SONI_TYPE
HYG_DATA = SUGGESTED_DIR / 'hyg.csv'

# Load Stellarium data file 
SKYCULTURE_FILE = SUGGESTED_DIR / 'western_index.json'

logging.basicConfig(level=logging.DEBUG)
LOG = logging.getLogger(__name__)


def _edges_from_lines(lines):
    """
    Convert a stellarium index.json 'lines' entry into (hip_a, hip_b) edge
    pairs. Each entry is a polyline of HIP ids, e.g. [98036, 97649, 97278]
    means edges (98036,97649) and (97649,97278). Some polylines are tagged
    with a leading style string (currently just "thin", used for secondary/
    fainter lines) which we drop since we don't distinguish line weights.
    """
    edges = []
    for strip in lines:
        hips = [h for h in strip if isinstance(h, int)]
        edges.extend(zip(hips, hips[1:]))
    return edges


def _load_patterns(path):
    """
    Build a single name -> pattern lookup covering both constellations and
    asterisms, keyed by english common name (what the frontend/user sends
    as `name`). Each pattern records its type, edge list, and (for
    constellations only) the IAU code used for boundary-based filtering.
    """
    with open(path) as f:
        skyculture = json.load(f)

    patterns = {}

    for entry in skyculture.get('constellations', []):
        name = entry['common_name']['native']
        patterns[name] = {
            'type': 'constellation',
            'iau': entry.get('iau'),
            'edges': _edges_from_lines(entry['lines']),
        }

    for entry in skyculture.get('asterisms', []):
        if entry.get('is_ray_helper', False): continue
        
        edges = _edges_from_lines(entry['lines'])
        if not edges:
            # Some asterisms don't have associated lines
            continue
        
        name = entry['common_name']['english']
        patterns[name] = {
            'type': 'asterism',
            'iau': None,
            'edges': edges
        }

    return patterns


PATTERNS = _load_patterns(SKYCULTURE_FILE)


def _get_pattern(pattern_name: str) -> dict:
    try:
        return PATTERNS[pattern_name]
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown constellation or asterism: '{pattern_name}'")


def get_constellation(pattern_name: str, by_shape: bool = True) -> pd.DataFrame:

    pattern = _get_pattern(pattern_name)

    # load CSV
    df = pd.read_csv(HYG_DATA)

    # Asterisms have no IAU boundary, so they're always filtered by shape
    # membership regardless of the by_shape flag.
    if by_shape or pattern['type'] == 'asterism':
        star_ids = {hip for edge in pattern['edges'] for hip in edge}
        stars_in_pattern = df[df['hip'].isin(star_ids)].copy()
    else:
        if not pattern['iau']:
            raise HTTPException(
                status_code=400,
                detail=f"'{pattern_name}' has no IAU boundary data; only official constellations support by_shape=False"
            )
        # Filter by constellation boundaries
        stars_in_pattern = df[df['con'] == pattern['iau']].copy()

    # sort by brightness (smaller magnitude = brighter)
    stars_sorted = stars_in_pattern.sort_values('magnitude')

    # correct RA for wraparound if needed
    stars_sorted['ra_corrected'] = correct_ra(stars_sorted['ra'].copy())

    return stars_sorted


@router.post("/plot/")
async def plot_csv(data: DataRequest):

    data_filepath = str(resolve_file(data.file_ref))

    if not data_filepath.endswith('.csv'):
        raise HTTPException(status_code=400, detail=f'Data file type must be .csv')

    df = pd.read_csv(data_filepath)
    df = df.set_index('hip')

    by_shape = data.file_ref.split('.')[-2].endswith('shape')

    image = plot_and_format_constellation(df, by_shape)

    return {'image': image}


def correct_ra(ra):

    ra = ra.copy()

    # Detect if the constellation crosses the 0h line (RA wraparound)
    if ra.max() - ra.min() > 12:  # difference > 12h → likely wraparound
        ra[ra < 12] += 24  # add 24h to RA values < 12h to unwrap

    return ra


def get_pattern_from_df(df: pd.DataFrame):
    """
    Best-effort reverse lookup: given a set of stars (indexed by hip), find
    the constellation or asterism whose edges match the most of them.
    """
    best_pattern = None
    best_match_count = 0

    star_ids = set(df.index)

    for name, pattern in PATTERNS.items():
        match_count = sum(
            1 for a, b in pattern['edges']
            if a in star_ids and b in star_ids
        )

        if match_count > best_match_count:
            best_match_count = match_count
            best_pattern = name

    return best_pattern


def plot_and_format_constellation(df: pd.DataFrame, lines: bool):

    if df.empty:
        raise ValueError("No stars available to plot.")

    # RA/Dec as x/y
    x = df['ra_corrected'].values
    y = df['dec'].values

    fig = Figure(figsize=(6, 6))
    ax = fig.add_subplot(111)
    ax.set_facecolor('#0b0c15')

    # Calculate ranges for proportional offsets
    ra_range = x.max() - x.min()
    dec_range = y.max() - y.min()

    # Use 3-5% of the range as offset
    offset_ra = ra_range * 0.04
    offset_dec = dec_range * 0.04

    # smaller marker size inversely proportional to magnitude
    sizes = 180 * (10 ** (-0.4 * df['magnitude']))

    # Normalise B-V to prevent the extremes of the colormap (dark colours on dark background)
    bv_norm = Normalize(vmin=-0.3, vmax=2.0, clip=True)

    # Plot stars and colour based on colour index (B-V)
    scatter = ax.scatter(
        x,
        y,
        s=sizes,
        c=df["colour"].values,
        cmap='RdYlBu_r',
        norm=bv_norm,
        zorder=2
    )
    # Legend for colour index
    fig.colorbar(scatter, ax=ax, label='B-V Colour Index')

    # Add connecting lines if plotting shapes
    if lines:

        pattern_name = get_pattern_from_df(df)
        edges = PATTERNS[pattern_name]['edges'] if pattern_name else []

        for hip_a, hip_b in edges:

            if hip_a in df.index and hip_b in df.index:

                star_a = df.loc[hip_a]
                star_b = df.loc[hip_b]

                ax.plot(
                    [star_a.ra_corrected, star_b.ra_corrected],
                    [star_a.dec, star_b.dec],
                    color="white",
                    linewidth=1,
                    zorder=1
                )

    # add padding around stars
    padding_ra = ra_range * 0.2
    padding_dec = dec_range * 0.2
    ax.set_xlim(x.min() - padding_ra, x.max() + padding_ra)
    ax.set_ylim(y.min() - padding_dec, y.max() + padding_dec)

    # Invert x axis so RA increases left to right
    ax.invert_xaxis()

    # Indicate direction of increasing RA
    arrow = FancyArrowPatch(
        (0.85, 0.03),
        (0.15, 0.03),
        transform=ax.transAxes,
        arrowstyle="->",
        mutation_scale=15,
        linewidth=1.5,
        color="white",
    )
    ax.add_patch(arrow)

    ax.text(
        0.5,
        0.04,
        "(RA increases)",
        transform=ax.transAxes,
        color="white",
        ha="center",
        va="bottom",
    )

    # Label stars with proper names if available (using unwrapped RA)
    for i, row in df.iterrows():
        if pd.notna(row['proper']) and str(row['proper']).strip() != "":
            ax.text(
                row['ra_corrected'] + offset_ra,
                row['dec'] + offset_dec,
                row['proper'],
                color='white',
                fontsize=8,
                ha='left',
                va='bottom'
            )

    # Add labels
    ax.set_xlabel("Right Ascension (RA)")
    ax.set_ylabel("Declination (Dec)")
    ax.set_xticks([])
    ax.set_yticks([])

    # send bytes to buffer
    buf = BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # Clean up memory
    buf.close()
    gc.collect()

    return img_base64


@router.get("/list/")
async def list_patterns():
    """
    Lets the frontend distinguish constellations from asterisms (e.g. to
    show them in separate sections, or grey out boundary-based ordering
    for asterisms).
    """
    return {
        'constellations': [name for name, p in PATTERNS.items() if p['type'] == 'constellation'],
        'asterisms': [name for name, p in PATTERNS.items() if p['type'] == 'asterism'],
    }


@router.post("/get-plotting-data/")
async def get_plotting_data(request: ConstellationRequest):
    stars = get_constellation(
        request.name,
        by_shape=True
    )

    pattern_name = get_pattern_from_df(stars.set_index("hip"))
    edges = PATTERNS[pattern_name]['edges'] if pattern_name else []

    lines = [
        [int(hip_a), int(hip_b)]
        for hip_a, hip_b in edges
        if hip_a in stars["hip"].values
        and hip_b in stars["hip"].values
    ]

    stars = [
        {
            'id': int(row.hip),
            'ra': float(row.ra_corrected),
            'dec': float(row.dec),
            'display_name': row.display_name
        }
        for row in stars.itertuples()
    ]

    return {'lines': lines, 'stars': stars}


@router.post("/get-and-plot/")
async def plot_constellation(request: ConstellationRequest):
    
    try:

        # select constellation or asterism
        stars_sorted = get_constellation(request.name, by_shape=request.by_shape)

        # choose top N stars if not filtering by shape
        N = request.n_stars
        filtered_stars = stars_sorted.head(N).copy() if not request.by_shape else stars_sorted

        # Index by hipparcos ID
        filtered_stars = filtered_stars.set_index('hip')

        image = plot_and_format_constellation(filtered_stars, request.by_shape)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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


def constellation_center(df: pd.DataFrame):

    ra = df["ra"].copy()
    dec = df["dec"]

    # unwrap RA if needed
    if ra.max() - ra.min() > 12:
        ra[ra < 12] += 24
        
    if len(df) == 1:
        # If only one star, return its position
        ra_center = ra.iloc[0]
        dec_center = dec.iloc[0]
    else:
        ra_center = (ra.min() + ra.max()) / 2
        dec_center = (dec.min() + dec.max()) / 2

    ra_center = ra_center % 24

    # Convert RA from hours to degrees to match expected unit
    ra_degs = ra_center * 15

    return ra_degs, dec_center


@router.post("/save-refined/")
async def save_refined(request: ConstellationRequest):

    # get and sort constellation/asterism stars
    stars = get_constellation(request.name, request.by_shape)
    refined_stars = stars.head(request.n_stars).copy() if not request.by_shape else stars

    if request.by_shape:
        if request.order:
            # Add the custom order column
            order_map = {hip: i for i, hip in enumerate(request.order, start=1)}
            refined_stars["custom_order"] = refined_stars["hip"].map(order_map)
        else:
            refined_stars = stars
    else:
        # Constellation boundary
        refined_stars = stars.head(request.n_stars).copy()

    # compute 'center' of constellation for optional 'Place on Dome' feature
    ra, dec = constellation_center(refined_stars)

    # save to tmp directory (overwriting any existing dataset)
    session_id = session_id_var.get()
    suffix = '_shape' if request.by_shape else ''
    filename = f'{request.name}{suffix}.csv'
    filepath = TMP_DIR / session_id / filename
    refined_stars.to_csv(filepath, index=False)

    file_ref = f'session:{filename}'

    return {'file_ref': file_ref, 'ra': ra, 'dec': dec}
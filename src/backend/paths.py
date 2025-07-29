from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
SRC_DIR = BACKEND_DIR.parent
STYLE_FILES_DIR = BACKEND_DIR / "style_files"
SOUND_ASSETS_DIR = SRC_DIR / "sound_assets"
SYNTHS_DIR = SOUND_ASSETS_DIR / "synths"
SAMPLES_DIR = SOUND_ASSETS_DIR / "samples"

# Temp directory for storing data files and sonifications
TMP_DIR = BACKEND_DIR / "tmp"
TMP_DIR.mkdir(exist_ok=True)
from pathlib import Path
import shutil
import sys
import os
import yaml

def get_base_paths():
    """
    Determine base paths for development or server deployment.
    Returns tuple of (backend_dir, project_root)
    """

    # Directory where this file lives (/backend)
    backend_dir = Path(__file__).resolve().parent

    src_dir = backend_dir.parent

    # Project root (/sonification-toolkit)
    root_dir = src_dir.parent

    return backend_dir, root_dir


# Get the base paths
BACKEND_DIR, ROOT_DIR = get_base_paths()

# Define all paths
STYLE_FILES_DIR = BACKEND_DIR / "style_files"
SUGGESTED_DATA_DIR = BACKEND_DIR / "suggested_data"
HYG_DATA = SUGGESTED_DATA_DIR / "constellations" / "hyg.csv"
TMP_DIR = BACKEND_DIR / "tmp"
TMP_DIR.mkdir(exist_ok=True)
SETTINGS_DIR = BACKEND_DIR / "settings"
SETTINGS_FILE = create_default_settings()
SOUND_ASSETS_DIR = BACKEND_DIR / "sound_assets"
SYNTHS_DIR = SOUND_ASSETS_DIR / "synths"
SAMPLES_DIR = SOUND_ASSETS_DIR / "samples"
SAMPLES_DIR.mkdir(exist_ok=True)




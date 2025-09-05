from pathlib import Path
import shutil
import sys
import os

def get_base_paths():
    """
    Determine base paths for both development and production modes.
    Returns tuple of (backend_dir, src_dir)
    """
    if getattr(sys, 'frozen', False):
        # Running as bundled executable (PyInstaller)
        print("Running in PRODUCTION mode (bundled executable)")
        
        # In PyInstaller, sys._MEIPASS points to the temporary extraction directory
        # which contains the _internal folder contents
        if hasattr(sys, '_MEIPASS'):
            # This is the _internal folder contents
            bundle_dir = Path(sys._MEIPASS)
            print(f"Bundle directory (_MEIPASS): {bundle_dir}")
        else:
            # Fallback to executable directory
            bundle_dir = Path(sys.executable).parent
            print(f"Executable directory: {bundle_dir}")
        
        # In production, everything is in the bundle directory
        backend_dir = bundle_dir
        src_dir = bundle_dir  # All assets are in the same bundled location
        
    else:
        # Running in development (python main.py)
        print("Running in DEVELOPMENT mode")
        backend_dir = Path(__file__).resolve().parent
        src_dir = backend_dir.parent
        print(f"Development backend_dir: {backend_dir}")
        print(f"Development src_dir: {src_dir}")
    
    return backend_dir, src_dir

# Get the base paths
BACKEND_DIR, SRC_DIR = get_base_paths()

# Define all paths
STYLE_FILES_DIR = BACKEND_DIR / "style_files"
SUGGESTED_DATA_DIR = BACKEND_DIR / "suggested_data"
SETTINGS_FILE = BACKEND_DIR / "settings" / "settings.yml"
SOUND_ASSETS_DIR = BACKEND_DIR / "sound_assets"
SYNTHS_DIR = SOUND_ASSETS_DIR / "synths"
SAMPLES_DIR = SOUND_ASSETS_DIR / "samples"
SAMPLES_DIR.mkdir(exist_ok=True)

# Temp directory for storing data files and sonifications
TMP_DIR = BACKEND_DIR / "tmp"
TMP_DIR.mkdir(exist_ok=True)

def clear_tmp_dir():
    """Delete all contents of the TMP_DIR on startup."""
    for item in TMP_DIR.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()

# Debug output (remove once working)
print("=== PATH DEBUG INFO ===")
print(f"sys.frozen: {getattr(sys, 'frozen', False)}")
print(f"sys._MEIPASS: {getattr(sys, '_MEIPASS', 'Not set')}")
print(f"BACKEND_DIR: {BACKEND_DIR}")
print(f"SRC_DIR: {SRC_DIR}")
print(f"STYLE_FILES_DIR: {STYLE_FILES_DIR} (exists: {STYLE_FILES_DIR.exists()})")
print(f"SUGGESTED_DATA_DIR: {SUGGESTED_DATA_DIR} (exists: {SUGGESTED_DATA_DIR.exists()})")
print(f"SOUND_ASSETS_DIR: {SOUND_ASSETS_DIR} (exists: {SOUND_ASSETS_DIR.exists()})")
print(f"TMP_DIR: {TMP_DIR} (exists: {TMP_DIR.exists()})")

# List contents of bundle directory in production for debugging
if getattr(sys, 'frozen', False):
    print(f"Contents of {BACKEND_DIR}:")
    try:
        for item in BACKEND_DIR.iterdir():
            print(f"  {item.name} {'(dir)' if item.is_dir() else '(file)'}")
    except Exception as e:
        print(f"  Error listing contents: {e}")

print("=== END PATH DEBUG ===")
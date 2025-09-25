from pathlib import Path
import shutil
import sys
import os
import yaml

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

def get_user_data_dir():
    """Get user-specific data directory"""
    if sys.platform == 'win32':  # Windows
        return BACKEND_DIR
    elif sys.platform == 'darwin':  # macOS
        return Path.home() / 'Library' / 'Application Support' / 'Sonification Toolkit'
    else:  # Linux and other Unix-like systems
        return Path.home() / '.local' / 'share' / 'sonification-toolkit'
    

def get_tmp_dir():
    """Get temporary directory in user space"""
    user_data = get_user_data_dir()
    tmp_dir = user_data / 'tmp'
    tmp_dir.mkdir(parents=True, exist_ok=True)
    return tmp_dir

def get_settings_dir():
    """Get settings directory in user space"""
    user_data = get_user_data_dir()
    settings_dir = user_data / 'settings'
    settings_dir.mkdir(parents=True, exist_ok=True)
    return settings_dir


def create_default_settings():
    """Create default settings.yml file if it doesn't exist"""
    settings_file = get_settings_dir() / 'settings.yml'
    
    if not settings_file.exists():
       
        default_settings = {
            'data_resolution': 10
        }
        
        try:
            with open(settings_file, 'w') as f:
                yaml.dump(default_settings, f, default_flow_style=False, indent=2)
        except Exception as e:
            print(f"Warning: Could not create settings file: {e}")
    
    return settings_file


# Get the base paths
BACKEND_DIR, SRC_DIR = get_base_paths()

# Define all paths
STYLE_FILES_DIR = BACKEND_DIR / "style_files"
SUGGESTED_DATA_DIR = BACKEND_DIR / "suggested_data"
USER_DATA_DIR = get_user_data_dir()
TMP_DIR = get_tmp_dir()
SETTINGS_DIR = get_settings_dir()
SETTINGS_FILE = create_default_settings()
SOUND_ASSETS_DIR = BACKEND_DIR / "sound_assets"
SYNTHS_DIR = SOUND_ASSETS_DIR / "synths"
SAMPLES_DIR = SOUND_ASSETS_DIR / "samples"
SAMPLES_DIR.mkdir(exist_ok=True)


def clear_tmp_dir():
    """Clear temporary directory"""
    try:
        for file_path in TMP_DIR.glob('*'):
            if file_path.is_file():
                file_path.unlink()
    except PermissionError as e:
        print(f"Warning: Could not clear tmp directory: {e}")

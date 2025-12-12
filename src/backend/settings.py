from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from paths import TMP_DIR
from pathlib import Path
from context import session_id_var
import yaml

router = APIRouter(prefix='/settings')

class UserSettings(BaseModel):
    data_resolution: int

def load_settings_from_file():
    """Load settings from YAML file"""

    session_id = session_id_var.get()
    settings_file = TMP_DIR / session_id / 'settings.yml'

    if not settings_file.exists():
        # Create default settings if file doesn't exist
        default_settings = {"data_resolution": 10}
        save_settings_to_file(default_settings, settings_file)
        return default_settings
    
    try:
        with open(settings_file, 'r') as file:
            settings = yaml.safe_load(file) or {}
            return settings
    except Exception as e:
        print(f"Error loading settings: {e}")
        return {"data_resolution": 10}


def save_settings_to_file(settings: dict, settings_path: Path):
    """Save settings to YAML file"""
    try:
        with open(settings_path, 'w') as file:
            yaml.dump(settings, file, default_flow_style=False)
    except Exception as e:
        print(f"Error saving settings: {e}")
        raise


@router.get("/load-settings")
async def load_settings():
    """Endpoint to load current settings"""
    try:
        settings = load_settings_from_file()
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")

@router.post("/save-settings")
async def save_settings(settings: UserSettings):
    """Endpoint to save settings"""
    try:
        # Load existing settings
        current_settings = load_settings_from_file()
        
        # Update with new values
        current_settings.update(settings.model_dump())
        
        session_id = session_id_var.get()
        settings_path = TMP_DIR / session_id / 'settings.yml'

        # Save back to file
        save_settings_to_file(current_settings, settings_path)
        
        return {"message": "Settings saved successfully", "settings": current_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
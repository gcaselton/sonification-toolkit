from paths import SYNTHS_DIR, SAMPLES_DIR
from config import GITHUB_USER, GITHUB_REPO
import httpx
from pydantic import BaseModel

class SoundInfo(BaseModel):
    name: str
    composable: bool
    downloaded: bool
    

asset_cache = []

async def cache_online_assets():
    """Fetch sound asset names from the latest release on GitHub and cache them."""

    url = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/releases"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
        releases = resp.json()

    # Filter to only sound asset files
    for rel in releases:

        if rel.get("tag_name", "").startswith('sound-assets'):
            for asset in rel.get("assets", []):
                asset_dict = {'name': asset["name"],
                              'url': asset['browser_download_url']}
                asset_cache.append(asset_dict)
        
            break  # Only take the latest asset release


def online_sound_names():

    sounds = []

    for asset in asset_cache:
        file_name = asset.get('name', '')
        if not file_name:
            continue

        name = format_name(file_name)

        sounds.append(name)
       
    return sounds

def format_name(file_name: str):

    # Remove extension (.zip)
    base = file_name.rsplit('.', 1)[0]

    # Remove last underscore + file type ('_wav')
    base = base.rsplit('_', 1)[0]

    # Replace remaining dots with spaces
    name = base.replace('.', ' ')

    return name

def local_sound_names():

      synths = [f.stem for f in SYNTHS_DIR.iterdir() if f.is_file()]
      samples = [f.stem for f in SAMPLES_DIR.iterdir()]

      local_sounds = synths + samples
      
      return local_sounds

def all_sound_names():

    local = local_sound_names()
    online = online_sound_names()

    return set(local + online)
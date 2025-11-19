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


def online_sounds():

    online_sounds = []

    for asset in asset_cache:
        file_name = asset.get('name', '')
        if not file_name:
            continue

        name = format_name(file_name)
        sound = SoundInfo(name=name, composable=False, downloaded=False)

        online_sounds.append(sound)
       
    return online_sounds

def format_name(file_name: str):

    # Remove extension (.zip)
    base = file_name.rsplit('.', 1)[0]

    # Remove last underscore + file type ('_wav')
    base = base.rsplit('_', 1)[0]

    # Replace remaining dots with spaces
    name = base.replace('.', ' ')

    return name

def local_sounds():
      
    local_sounds = []

    for f in SYNTHS_DIR.iterdir():
        if f.is_file():
            composable = f.stem != 'White Noise'
            sound = SoundInfo(name=f.stem, composable=composable, downloaded=True)
            local_sounds.append(sound)

    for f in SAMPLES_DIR.iterdir():
        if f.is_dir():
            name = f.stem
    
            files = [file for file in f.iterdir() if file.is_file()]

            # Composable if:
            # 1) The directory contains a .sf2 file
            # 2) OR the directory contains multiple files
            composable = (
                any(file.suffix == ".sf2" for file in files)
                or len(files) > 1
            )

            sound = SoundInfo(name=name, composable=composable, downloaded=True)
            local_sounds.append(sound)
      
    return local_sounds

def all_sounds():

    local = local_sounds()
    online = online_sounds()

    sounds = {s.name: s for s in online}
    sounds.update({s.name: s for s in local})

    return list(sounds.values())
import logging
logging.basicConfig(level=logging.DEBUG)
for lib in ["uvicorn", "matplotlib", "httpcore", "asyncio", "httpx", "urllib3", 'lightkurve', 'scipy']:
    logging.getLogger(lib).setLevel(logging.INFO)

logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI
from light_curves import router as light_curve_router
from constellations import router as constellations_router
from performance import router as performance_router
from core import router as core_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from paths import SYNTHS_DIR, SAMPLES_DIR, TMP_DIR
from sounds import cache_online_assets
from contextlib import asynccontextmanager
from config import GITHUB_USER, GITHUB_REPO
from datetime import datetime
import asyncio, os, httpx, psutil, tracemalloc, time, threading



async def safe_cache_assets():
    try:
        await cache_online_assets()
        print("Cache complete")
    except Exception as e:
        print("Error caching assets:", e)


def clear_tmp_dir():
    """Completely clear tmp directory - to be used once at startup"""
    try:
        for file_path in TMP_DIR.glob('*'):
            if file_path.is_file():
                file_path.unlink()
    except PermissionError as e:
        logger.warning(f"Could not clear tmp directory: {e}")


def cleanup_tmp_dir(interval_minutes=60, max_age_minutes=120):
    """Periodically clean up tmp directory by deleting files older than max_age_minutes"""

    interval_seconds = interval_minutes * 60
    max_age_seconds = max_age_minutes * 60

    while True:
        
        logger.info("Starting TMP directory cleanup.")
        now = time.time()
        count = 0

        for filename in os.listdir(TMP_DIR):
            path = os.path.join(TMP_DIR, filename)
            if os.path.isfile(path):
                age = now - os.path.getmtime(path)
                if age > max_age_seconds:
                    try:
                        os.remove(path)
                        count += 1
                    except (Exception, PermissionError) as e:
                        logger.warning(f"Could not delete tmp file {path}: {e}")
                        continue

        logger.info(f"TMP directory cleanup complete. Deleted {count} files.")
        time.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to handle startup tasks"""

    # Clear TMP directory at startup
    await asyncio.to_thread(clear_tmp_dir)
    logger.info("Cleared TMP directory at startup.")

    # Run caching in background
    asyncio.create_task(safe_cache_assets())

    # Start background thread for periodic TMP cleanup
    thread = threading.Thread(target=cleanup_tmp_dir, daemon=True)
    thread.start()

    yield


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import API endpoints
app.include_router(light_curve_router)
app.include_router(constellations_router)
app.include_router(core_router)
app.include_router(performance_router)


@app.get("/")
def get_status():
    """
    Root of the API which returns a message to confirm the server is working.

    - Returns: JSON object of a string message.
    """
    return {'message': 'Hello! The server is up and running.'}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

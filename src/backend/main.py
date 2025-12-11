import logging
logging.basicConfig(level=logging.DEBUG)
for lib in ["uvicorn", "matplotlib", "httpcore", "asyncio", "httpx", "urllib3", 'lightkurve', 'scipy']:
    logging.getLogger(lib).setLevel(logging.INFO)

logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI, BackgroundTasks
from light_curves import router as light_curve_router
from constellations import router as constellations_router
from performance import router as performance_router
from core import router as core_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from paths import SYNTHS_DIR, SAMPLES_DIR, TMP_DIR, ROOT_DIR
from sounds import cache_online_assets
from contextlib import asynccontextmanager
from config import GITHUB_USER, GITHUB_REPO
from StorageManager import StorageManager
from datetime import datetime
import asyncio, os, httpx, psutil, tracemalloc, time, threading, shutil


async def safe_cache_assets():
    try:
        await cache_online_assets()
        print("Cache complete")
    except Exception as e:
        print("Error caching assets:", e)



# Initialize storage/cleanup manager
storage_manager = StorageManager(
    target_dir=TMP_DIR,
    max_age_days=2,
    disk_threshold_percent=70.0,
    cleanup_interval_hours=6,
    emergency_threshold_percent=80.0,
    min_free_gb=2.0
)




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to handle startup tasks"""

    # Run caching in background
    asyncio.create_task(safe_cache_assets())
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(storage_manager.start_background_cleanup())
    
    yield
    
    # Shutdown: cancel background task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass



app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://localhost:4173",
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


@app.get("/cleanup/status")
async def cleanup_status():
    """Get current disk usage and cleanup status."""
    used_percent, used_gb, free_gb = storage_manager.get_disk_usage()
    sessions = storage_manager.get_session_dirs()
    
    return {
        "disk_usage_percent": round(used_percent, 2),
        "used_gb": round(used_gb, 2),
        "free_gb": round(free_gb, 2),
        "total_sessions": len(sessions),
        "thresholds": {
            "normal_cleanup": storage_manager.disk_threshold,
            "emergency_cleanup": storage_manager.emergency_threshold,
            "min_free_gb": storage_manager.min_free_bytes / (1024**3)
        },
        "config": {
            "max_age_days": storage_manager.max_age_seconds / (24 * 60 * 60),
            "cleanup_interval_hours": storage_manager.cleanup_interval / 3600
        }
    }

@app.post("/cleanup/manual")
async def manual_cleanup(background_tasks: BackgroundTasks):
    """Trigger manual cleanup."""
    result = storage_manager.run_cleanup()
    return {
        "message": "Manual cleanup completed",
        "result": result
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)

import logging
logging.basicConfig(level=logging.DEBUG)
for lib in ["uvicorn", "matplotlib", "httpcore", "asyncio", "httpx", "urllib3", 'lightkurve', 'scipy']:
    logging.getLogger(lib).setLevel(logging.INFO)

logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse

from light_curves import router as light_curve_router
from constellations import router as constellations_router
from night_sky import router as night_sky_router
from core import router as core_router
from settings import router as settings_router
from paths import SYNTHS_DIR, SAMPLES_DIR, TMP_DIR, ROOT_DIR
from sounds import cache_online_assets
from contextlib import asynccontextmanager
from config import GITHUB_USER, GITHUB_REPO
from StorageManager import StorageManager
from context import session_id_var
from datetime import datetime
import asyncio, os, httpx, psutil, tracemalloc, time, threading, shutil, sys, traceback

# fcntl package is only available on unix systems
if sys.platform != "win32":
    import fcntl


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
    
    # Only run the cleanup in one worker using a file lock
    lock_file = None
    cleanup_task = None
    got_lock = False

    if sys.platform != "win32":
        lock_file = open("/tmp/cleanup.lock", "w")
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            got_lock = True
        except BlockingIOError:
            pass
    else:
        # On Windows (local dev), always start the cleanup task
        got_lock = True

    # First worker to get the lock 
    if got_lock:
        cleanup_task = asyncio.create_task(storage_manager.start_background_cleanup())

    yield

    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    if lock_file and got_lock:
        fcntl.flock(lock_file, fcntl.LOCK_UN)
    if lock_file:
        lock_file.close()



app = FastAPI(lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception:\n" + traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

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

# Middleware to set the session_id from cookie
@app.middleware("http")
async def session_middleware(request: Request, call_next):

    session_id = request.cookies.get("session_id")
    
    # Set the context variable
    token = session_id_var.set(session_id)
    
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error("Exception in request:\n" + traceback.format_exc())
        raise
    finally:
        # Reset the context variable for the next request
        session_id_var.reset(token)


# Import API endpoints
for router in [light_curve_router, constellations_router, night_sky_router, core_router, settings_router]:
    app.include_router(router)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)

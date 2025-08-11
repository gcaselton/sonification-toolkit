from fastapi import FastAPI
from api import light_curve
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from paths import clear_tmp_dir
import os

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.abspath(os.path.join(BASE_DIR, "../frontend/dist"))

# app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")


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

# Clear tmp directory on startup
clear_tmp_dir()

# Import API endpoints
app.include_router(light_curve.router)

@app.get("/")
def get_status():
    """
    Root of the API which returns a message to confirm the server is working.

    - Returns: JSON object of a string message.
    """
    return {'message': 'Hello! The server is up and running.'}

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8000)

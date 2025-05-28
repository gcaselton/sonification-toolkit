from fastapi import FastAPI
from api import light_curve

app = FastAPI()

app.include_router(light_curve.router)

@app.get("/")
def get_status():
    return {'message': 'Hello! The server is up and running.'}
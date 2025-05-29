from fastapi import FastAPI
from api import light_curve

app = FastAPI()

# Import API endpoints
app.include_router(light_curve.router)

@app.get("/")
def get_status():
    """
    Root of the API which returns a message to confirm the server is working.

    - Returns: JSON object of a string message.
    """
    return {'message': 'Hello! The server is up and running.'}
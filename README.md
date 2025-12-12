# Data Sonification Toolkit

An application to communicate astronomical data through sound and music. Powered by the STRAUSS python package!

## Pre-requisites

- React v19.1.0
- Vite v6.1.1
- Node v20.9.0
- npm v10.2.2
- FastAPI v0.0.7
- Python v3.11.0

## Instructions to run the app

Open a terminal from the location you cloned the repo.

Install the required python packages:

`pip install .`

### Run fastapi

Go into the backend directory

`cd .\src\backend\`

Run fastAPI using uvicorn:

`uvicorn main:app --reload`

The fastapi should be running at http://127.0.0.1:8000

You can find the documentation of the API available at http://127.0.0.1:8000/docs

### Run the React app

Open a new terminal, and go into the frontend directory

`cd .\src\frontend\`

Install the required node packages

`npm install`

Run the React app

`npm run dev`

Open a web browser window and navigate to http://localhost:5173/


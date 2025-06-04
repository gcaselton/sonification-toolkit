# Data Sonification Toolkit

An application to play sounds of astronomical objects using the Strauss package.

## Pre-requisites

- React v19.1.0
- Vite v6.1.1
- Node v20.9.0
- npm v10.2.2
- FastAPI v0.0.7
- Python v3.11.0

## Application structure

The backend uses fastapi and the frontend uses React + Vite

- backend/
  - api/
    - __init__.py
    - light_curve.py
  main.py
- frontend/
  - public
  - src/
    - assets/
    - components/
    App.css
    App.tsx
    index.css
    main.tsx
    vite-env.d.ts
    .gitignore

## Instructions to run the app

Open a terminal from the location you cloned the repo

### Run fastapi

Go into the backend directory

`cd .\src\backend\`

Run fastapi

`fastapi dev .\main.py`

The fastapi should be running at http://127.0.0.1:8000

You can find the documentation of the APIs available at http://127.0.0.1:8000/docs

### Run the React app

Go into the frontend directory

`cd .\src\frontend\`

Run the React app

`npm run dev`

The frontend application should be running at http://localhost:5173/

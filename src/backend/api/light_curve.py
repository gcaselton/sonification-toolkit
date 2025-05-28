from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lightkurve import search_lightcurve
import logging

router = APIRouter()

class StarQuery(BaseModel):
    star_name: str

@router.post('/search-lightcurves/')
async def search_lightcurves(query: StarQuery):
    try:
        search_result = search_lightcurve(query.star_name)

        if len(search_result) == 0:
            raise HTTPException(status_code=404, detail=f'No light curves found for {query.star_name}.')
        
        results_metadata = []

        for row in search_result.table:
            results_metadata.append({
                "mission": row.get("project"),
                #"obs_id": row.get("obs_id"),
                "exposure": row.get("exptime"),
                "pipeline": row.get("author"),
                "year": row.get("year"),
                "period": row.get("mission"),
                # "productFilename": row.get("productFilename"),
                # "observation_id": row.get("observation_id"),
                "dataURL": row.get("dataURL")
            })

        return {'results': results_metadata}
    
    except Exception as e:
        logging.exception('Error searching for light curves: ')
        raise HTTPException(status_code=500, detail=str(e))
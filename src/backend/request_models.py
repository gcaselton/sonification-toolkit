from pydantic import BaseModel
from typing import Optional, Literal

# Define BaseModels for expected request types

#---------- Core ----------#

class DataRequest(BaseModel):
    file_ref: str

class SoundSettings(BaseModel):
    sound: str
    filterCutOff: bool
    pitch: bool
    volume: bool
    leftRightPan: bool
    chordMode: bool
    rootNote: str
    scale: str
    quality: str

class SoundRequest(BaseModel):
    sound_name: str

class SonificationRequest(BaseModel):
    category: str
    data_ref: str
    style_ref: str
    duration: float
    system: str
    data_name: str
    observer: Optional[dict]
    
#---------- Constellations ----------#
    
class ConstellationRequest(BaseModel):
    name: str
    by_shape: bool = True
    n_stars: int

class NStarsRequest(BaseModel):
    name: str
    max_magnitude: float
    
#---------- Light Curves ----------#
    
class StarQuery(BaseModel):
    star_name: str
    filters: dict

class DownloadRequest(BaseModel):
    data_uri: str

class PlotRequest(BaseModel):
    file_ref: str
    new_range: list[int]

class RefineRequest(BaseModel):
    data_name: str
    file_ref: str
    new_range: list[float]
    sigma: int
    
#---------- Night Sky ----------#   

class NightSkyRequest(BaseModel):
    latitude: float
    longitude: float
    facing: Literal['N','NNE','NE','ENE','E','ESE','SE',
                'SSE','S','SSW','SW','WSW','W','WNW',
                'NW','NNW']
    date_time: str

class MagRequest(BaseModel):
    maglim: float
    file_ref: str
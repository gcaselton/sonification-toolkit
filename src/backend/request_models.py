from pydantic import BaseModel
from typing import Optional, Literal, List

# Define BaseModels for expected API request types

#---------- Core ----------#

class DataRequest(BaseModel):
    file_ref: str
    
class StyleMetadata(BaseModel):
    mappingParams: list[dict]
    customNotes: bool
    rootNote: Optional[str] = None
    harmony: Optional[str] = None
    octaveRange: Optional[List[int]] = None

class CustomStyleSettings(BaseModel):
    dataMode: str
    sound: str
    map: list[dict]
    notes: list[str]
    metadata: StyleMetadata

class SoundRequest(BaseModel):
    sound_name: str
    
class SoundInfo(BaseModel):
    name: str
    composable: bool
    data_modes: list[str]
    
class LayerRequest(BaseModel):
    data_ref: str
    style_ref: str
    id_column: Optional[str] = None
    volume: float = 1.0

class SonificationRequest(BaseModel):
    category: str
    layers: list[LayerRequest]
    duration: float
    system: Literal['mono', 'stereo', '5.1', '7.1']
    data_name: str
    observer: Optional[dict]
    
class VolumeRequest(BaseModel):
    volumes: list[float]
    
#---------- Constellations ----------#
    
class ConstellationRequest(BaseModel):
    name: str
    by_shape: bool = True
    n_stars: int
    order: Optional[list[int]] = None

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
    nan_strategy: str
    fill_with: str
    
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
    
#---------- Data Composer ----------#
    
class ComposerRefineRequest(BaseModel):
    file_ref: str
    columns: list[str]
    nan_strategy: Literal["silence", "interpolate", "fill"]
    fill_with: Optional[str] = None
    row_range: list[int, int]
    n_preview_rows: Optional[int] = 20
    
class HeaderRequest(BaseModel):
    file_ref: str
    has_header: bool

from pydantic import BaseModel, Field, field_validator
from typing import Literal
from paths import *

class StyleFile(BaseModel):
    name: str
    description: str
    sound: str

    @field_validator("sound")
    @classmethod
    def validate_sound(cls, v):
        valid = sound_names()
        if v not in valid:
            raise ValueError(f"'{v}' is not a valid sound. Choose from: {valid}")
        return v
    


def sound_names():

      synths = [f.stem for f in SYNTHS_DIR.iterdir() if f.is_file()]
      samples = [f.stem for f in SAMPLES_DIR.iterdir() if f.is_file()]

      all_sounds = synths + samples
      
      return all_sounds
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal, Optional, Dict, List
from paths import *
from strauss.sources import param_lim_dict
from pychord import Chord
from musical_scales import scale as parse_scale

defaults = {
        'light_curve': {
            'name': 'Light Curve Default',
            'description': 'Default style for sonifying light curves. It combines the default STRAUSS synth sound with a cutoff filter, and chooses a random chord to play.',
            'sound': 'default_synth',
            'data_mode': 'continuous',
            'parameters': {'cutoff': [0,1]},
            'chord_mode': 'on',
            'chord': 'random'
        },
        'orbit': {
            'name': 'Orbit Default',
            'description': 'Style for orbit sonification etc',
        }
    }

class BaseStyle(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sound: Optional[str] = None
    data_mode: Literal['discrete', 'continuous'] = 'continuous'
    parameters: Optional[Dict[str, Optional[List[float]]]] = None
    chord_mode: Literal['on', 'off'] = 'on'
    chord: Optional[str] = None
    scale: Optional[str] = None

    @field_validator('sound')
    @classmethod
    def validate_sound(cls, value: Optional[str]):

        valid_sounds = sound_names()
        
        if '.' in value:
             value = value.split('.')[0]
             
        if value not in valid_sounds:
            raise ValueError(f"'{value}' is not a valid sound name.")
        return value
    
    @field_validator('parameters')
    @classmethod
    def validate_parameters(cls, value: Optional[Dict[str, Optional[List[float]]]]):

        if value is None:
            return value

        for key, limits in value.items():
            if key not in param_lim_dict.keys():
                raise ValueError(f'Parameter "{key}" is not a valid parameter.')
            if limits is None:
                continue  # (Uses default)
            if not isinstance(limits, list) or len(limits) != 2:
                raise ValueError(f'Parameter "{key}" must have a list of two numbers [min, max].')
            
            min, max = limits
            valid_min, valid_max = param_lim_dict[key]

            if min > max:
                raise ValueError(f'Parameter "{key}" has min limit greater than max limit: {limits}')
            if min < valid_min or max > valid_max:
                raise ValueError(f'Parameter limits for "{key}" must be between those stated in the schema.')
            
        return value
    
    @field_validator('chord')
    @classmethod
    def validate_chord(cls, value: Optional[str]):

        if value is None or value.lower() == 'random':
            return value
        
        try:
            chord = Chord(value)
        except Exception as e:
            raise ValueError(f'Invalid chord "{value}": {e}')
        
        return value
    
    @field_validator('scale')
    @classmethod
    def validate_scale(cls, value: Optional[str]):
        if value is None:
            return value
        
        try:
            root, quality = value.split(' ', 1)
            scale  = parse_scale(root, quality)
        except Exception as e:
            raise ValueError(f'Invalid scale "{value}": {e}')
        
        return value
    
    @model_validator(mode="after")
    def check_scale_conflicts(self):

        if self.scale:
            if 'pitch' not in self.parameters:
                raise ValueError('"pitch" must be a parameter to use a musical scale.')
            if self.data_mode != 'discrete':
                raise ValueError('Data mode must be "discrete" to use a musical scale.')
        else:
            if 'pitch' in self.parameters and self.data_mode == 'discrete':
                self.scale = 'chromatic'

        return self

# create child classes for different style/sonification types?

def sound_names():

      synths = [f.stem for f in SYNTHS_DIR.iterdir() if f.is_file()]
      samples = [f.stem for f in SAMPLES_DIR.iterdir() if f.is_file()]

      all_sounds = synths + samples
      
      return all_sounds
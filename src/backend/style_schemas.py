from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Dict, List, Union, Tuple
from paths import *
from strauss.sources import param_lim_dict
from pychord import Chord
from musical_scales import scale as parse_scale
from sounds import all_sounds

# defaults = {
#         'light_curves': {
#             'name': 'Light Curve Default',
#             'description': 'Default style for sonifying light curves. It combines the default STRAUSS synth sound with a cutoff filter, and chooses a random chord to play.',
#             'sound': 'default_synth',
#             'parameters': {'cutoff': [0,1]},
#             'chord_mode': 'on',
#             'chord': 'random'
#         },
#         'constellation': {
#             'name': 'Constellation Default',
#             'description': 'Default style for sonifying constellations. It uses the mallets sound and maps star colour to pitch.',
#             'sound': 'Mallets',
#             'parameters': {'magnitude': {'map_to': 'time'}, 'colour': {'map_to': 'pitch'}, 'ra': {'map_to': 'azimuth'}, 'dec': {'map_to': 'altitude'}},
#             'music': 'Cmaj7'
#         },
#         'orbit': {
#             'name': 'Orbit Default',
#             'description': 'Style for orbit sonification etc',
#         }
#     }

metadata = {
    'input': {
        'title': 'Input Parameter Name',
        'description': 'This is the name of the data variable to map from, e.g. magnitude.'
    },
    'input_range': {
        'title': 'Input Parameter Range',
        'description': "The range of the input data to use. Can be specified as percentiles (e.g. '5%','95%') or absolute values (e.g. 0,100). All values outside this range will be clipped to this range."
    },
    'output': {
        'title': 'Output Parameter Name',
        'description': 'This is the name of the sound parameter to map to, e.g. pitch.'
    },
    'output_range': {
        'title': 'Output Parameter Range',
        'description': 'The range of the output sound parameter values. E.g. for pitch, this could be between 0-24 semitones. Can also be specified as percentiles (e.g. "5%","95%") or absolute values (e.g. 0,100).'
    }
}

class ParameterMapping(BaseModel):
    input: str = Field(..., title=metadata['input']['title'], description=metadata['input']['description'])
    input_range: Tuple[Union[str, float, int], Union[str, float, int]] = Field(default=('0%','100%'), title=metadata['input_range']['title'], description=metadata['input_range']['description'])
    output: str = Field(..., title=metadata['output']['title'], description=metadata['output']['description'])
    output_range: Optional[Tuple[Union[float, int], Union[float, int]]] = Field(default=None, title=metadata['output_range']['title'], description=metadata['output_range']['description'])

    @field_validator('output')
    @classmethod
    def validate_output(cls, value: str):

        if value not in param_lim_dict.keys():
            raise ValueError(f'Parameter "{value}" is not a valid parameter.')
        
        return value
    
    @model_validator(mode="after")
    def validate_output_range(self):

        if self.output_range is None:
            return self

        valid_min, valid_max = param_lim_dict[self.output]

        for val in self.output_range:

            if val < valid_min or val > valid_max:
                if self.output == 'pitch':
                    continue
                raise ValueError(f'Parameter limits for "{self.output}" must be between those stated in the schema.')
            
        return self


class BaseStyle(BaseModel):
    name: Optional[str] = Field(None)
    description: Optional[str] = Field(None)
    sound: str = Field(...)
    parameters: List[ParameterMapping] = Field(...)
    harmony: Optional[str] = Field(None)

    @field_validator('sound')
    @classmethod
    def validate_sound(cls, value: Optional[str]):

        valid_sounds = [s.name for s in all_sounds()]
        
        if '.' in value:
             value = value.split('.')[0]
             
        if value not in valid_sounds:
            raise ValueError(f"'{value}' is not a valid sound name.")
        
        return value
    
    @field_validator('parameters')
    @classmethod
    def validate_parameters(cls, value: List[ParameterMapping]):

        if not value:
            raise ValueError("At least one parameter mapping is required.")
        
        # check for duplicate output parameters (e.g. two mappings to 'pitch')
        read_outputs = set()
        for param in value:
            if param.output in read_outputs:
                raise ValueError(f"Duplicate output parameter: '{param.output}'. Each output parameter can only be mapped once.")
            read_outputs.add(param.output)

        return value
    
    @field_validator('harmony')
    @classmethod
    def validate_chord(cls, value: Optional[str]):

        if value is None:
            return value
        
        if ' ' in value: # likely a scale e.g. "C major"
            try:
                root, quality = value.split(' ', 1)
                scale  = parse_scale(root, quality)
            except Exception as e:
                raise ValueError(f'Invalid scale "{value}": {e}')
        else: # likely a chord e.g. "Cmaj7"
            try:
                chord = Chord(value)
            except Exception as e:
                raise ValueError(f'Invalid chord "{value}": {e}')
        
        return value

    
    @model_validator(mode="after")
    def check_for_conflicts(self):

        # need to check that the chosen sound is composable if harmony is set
        if self.harmony:
            valid_sounds = [s.name for s in all_sounds() if s.composable]
            if self.sound not in valid_sounds:
                raise ValueError(f'Sound "{self.sound}" is not composable, so harmony cannot be applied.')

        # need to check that pitch is mapped if using a scale
        is_scale = ' ' in self.harmony if self.harmony else False

        mapped_outputs = {param.output for param in self.parameters}

        if is_scale and 'pitch' not in mapped_outputs:
            raise ValueError('"pitch" must be a parameter to use a musical scale.')

        return self




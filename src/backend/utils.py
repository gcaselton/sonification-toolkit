import yaml
from strauss.presets import read_yaml

def read_style_file(filepath):

    with filepath.open(mode='r') as fdata:
        try:
            style_dict = yaml.safe_load(fdata)
        except yaml.YAMLError as err:
            print(err)
    
    
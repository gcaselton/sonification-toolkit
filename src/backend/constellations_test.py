from extensions import sonify


style = 'C:\\Users\\ngc133\\sonification-toolkit\\src\\backend\\style_files\\constellations\\stars_appearing.yml'
data = 'C:\\Users\\ngc133\\sonification-toolkit\\src\\backend\\suggested_data\\constellations\\Cassiopeia_8b5c20ee69e34234abfdd99de9dd85be.csv'

soni = sonify(data=data, style_file=style, sonify_type='constellations', length=20, system='stereo')
soni.hear()
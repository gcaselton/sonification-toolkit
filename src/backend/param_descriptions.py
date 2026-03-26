_MAGNITUDE = {
    'name': 'Magnitude',
    'desc': 'How bright the star appears from Earth (lower values are brighter)'
}

_COLOUR = {
            'name': 'Colour',
            'desc': 'The colour of the star. Lower values are bluer and hotter, higher values are redder and cooler'         
}

INPUTS = {
    'light_curves':
        {
        'flux':
            {
            'name': 'Flux',
            'desc': 'Brightness of the star over time'
            },
        'time':
            {
                'name': 'Time',
                'desc': ''
            }
        },
    'constellations':
        {
        'ra_corrected': 
            {
            'name': 'RA',
            'desc': 'Right Ascension (increases West to East)'
            },
        'dec': 
            {
            'name': 'Dec',
            'desc': 'Declination'
            },
        'dist': 
            {
            'name': 'Distance',
            'desc': "The star's distance from Earth"
            },
        'pmra': 
            {
            'name': 'Proper Motion (RA)',
            'desc': 'How fast the star is moving across the sky (east to west)'
            },
        'pmdec': 
            {
            'name': 'Proper Motion (Dec)',
            'desc': 'How fast the star is moving across the sky (north to south)'
            },
        'magnitude': _MAGNITUDE,
        'absmag':
            {
            'name': 'Absolute Magnitude',
            'desc': 'How bright the star would appear from a distance of 10 parsecs'
            },
        'colour': _COLOUR  
        },
    'night_sky':
        {
            'magnitude': _MAGNITUDE,
            'colour': _COLOUR,
            'altitude_deg': 
                {
                    'name': 'Altitude',
                    'desc': 'The angle of the star above the horizon in degrees'
                },
            'relative_az':
                {
                    'name': 'Azimuth',
                    'desc': 'The horizontal position of the star relative to the observer'
                }
        }
    
}

OUTPUTS = {
    'time': {
        'name': 'Time',
        'desc': 'When in the sonification the data point is heard'
    },
    'cutoff': {
        'name': 'Filter Cutoff',
        'desc': 'The brightness of the sound'
    },
    'pitch': {
        'name': 'Pitch',
        'desc': 'The perceived highness or lowness of the note'
    },
    'volume': {
        'name': 'Volume',
        'desc': 'The loudness of each data point'
    },
    'azimuth': {
        'name': 'Azimuth',
        'desc': 'The position of the sound in surround space (0 and 1 are behind, 0.5 is front)'
    },
    'pan': {
        'name': 'Pan',
        'desc': 'The position of the sound in stereo (0 is left, 1 is right)'
    }
}
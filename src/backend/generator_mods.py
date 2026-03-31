
BASIC_LOOP = {
      'looping': 'forwardback',
      'loop_start': 0,
      'loop_end': 5.
}

BASIC_MODS = {
      'Sci-Fi Strings': BASIC_LOOP,
      'Nuclear Crackle': BASIC_LOOP,
      'Power Hum': BASIC_LOOP,
      'Twinkle Mallets': {
            'looping': 'forward',
            'loop_start': 0.3,
            'loop_end': 5
      },
      'Orchestra': {
            'looping': 'forwardback',
            'note_length': 120,
            'loop_start': 0.8,
            'loop_end': 3.
      }
}

NIGHT_SKY_MODS = {
    'Orchestra': {
        'note_length': 2.,
        'volume_envelope': {
            'A': 0.,
            'D': 0.,
            'S': 1.,
            'R': 2.,
        }
    }
}

GENERATOR_MODS = {
      'light_curves': BASIC_MODS,
      'constellations': BASIC_MODS,
      'night_sky': NIGHT_SKY_MODS
}
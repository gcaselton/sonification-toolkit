scales = {
    # Diatonic Scales
    "major": [0, 2, 4, 5, 7, 9, 11],       # Ionian
    "minor": [0, 2, 3, 5, 7, 8, 10],       # Aeolian/Natural minor
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "locrian": [0, 1, 3, 5, 6, 8, 10],

    # Pentatonic Scales
    "major pentatonic": [0, 2, 4, 7, 9],
    "minor pentatonic": [0, 3, 5, 7, 10],

    # Blues Scales
    "blues minor": [0, 3, 5, 6, 7, 10],
    "blues major": [0, 2, 3, 4, 7, 9],

    # Harmonic Scales
    "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
    "harmonic major": [0, 2, 4, 5, 7, 8, 11],
    "phrygian dominant": [0, 1, 4, 5, 7, 8, 10],

    # Melodic Minor
    "melodic minor": [0, 2, 3, 5, 7, 9, 11],  # ascending

    # Other Scales
    "whole tone": [0, 2, 4, 6, 8, 10],
    "chromatic": list(range(12)),
}

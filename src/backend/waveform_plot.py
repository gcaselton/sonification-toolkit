import soundfile as sf
import matplotlib.pyplot as plt
from paths import TMP_DIR
from pathlib import Path

session = 'e9a11e07-ef94-4b97-a01e-93264bf7f9a1'

star = 'Sirius'

filepath = TMP_DIR / session / f'{star} Light Curve.wav'

# Load 5.1 audio
data, samplerate = sf.read(filepath)

# Plot each channel
channels = ['FL', 'FR', 'C', 'LFE', 'BL', 'BR']
plt.figure(figsize=(12, 8))
for i in range(6):
    plt.subplot(6, 1, i+1)
    plt.plot(data[:, i])
    plt.title(f"Channel {i} ({channels[i]})")
    plt.ylabel("Amplitude")
plt.xlabel("Sample index")
plt.tight_layout()
plt.show()
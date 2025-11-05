import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from constellations import HYG_DATA

# load CSV
df = pd.read_csv(HYG_DATA)

# select a constellation, e.g., Orion
constellation_name = "Psc"
stars_in_constellation = df[df['con'] == constellation_name]

# sort by brightness (smaller magnitude = brighter)
stars_sorted = stars_in_constellation.sort_values('mag')

# choose top N stars
N = 13
top_stars = stars_sorted.head(N)

plt.figure(figsize=(6,6))

# RA/Dec as x/y
x = top_stars['ra']
y = top_stars['dec']

# smaller marker size inversely proportional to magnitude
sizes = np.sqrt(10 / top_stars['mag']) * 50

# # Glow effect
# for scale, alpha in zip([1.5, 1.2], [0.1, 0.3]):
#     plt.scatter(x, y, s=sizes*scale, c='white', alpha=alpha)

plt.scatter(x, y, s=sizes, c='white', alpha=1.0)




# add some padding around stars
padding_ra = (x.max() - x.min()) * 0.1
padding_dec = (y.max() - y.min()) * 0.1
plt.xlim(x.min() - padding_ra, x.max() + padding_ra)
plt.ylim(y.min() - padding_dec, y.max() + padding_dec)

plt.gca().set_facecolor('black')
plt.title(f"{constellation_name} - Top {N} Brightest Stars")
plt.xlabel("RA")
plt.ylabel("Dec")
plt.gca().invert_xaxis()  # sky plots usually invert RA
plt.xticks([])
plt.yticks([])

plt.savefig("orion_top10.png", dpi=150, bbox_inches='tight')
print("Plot saved as orion_top10.png")

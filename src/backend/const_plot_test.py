import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from constellations import HYG_DATA

# load CSV
df = pd.read_csv(HYG_DATA)

# select a constellation, e.g., Pegasus
constellation_name = "Ori"
stars_in_constellation = df[df['con'] == constellation_name].copy()

# sort by brightness (smaller magnitude = brighter)
stars_sorted = stars_in_constellation.sort_values('mag')

# choose top N stars
N = 10
top_stars = stars_sorted.head(N).copy()

plt.figure(figsize=(6,6))

ra = top_stars['ra'].copy()

# Detect if the constellation crosses the 0h line (RA wraparound)
if ra.max() - ra.min() > 12:  # difference > 12h → likely wraparound
    ra[ra < 12] += 24

# RA/Dec as x/y
x = ra
y = top_stars['dec']

# smaller marker size inversely proportional to magnitude
sizes = np.sqrt(10 / top_stars['mag']) * 50

plt.scatter(x, y, s=sizes, c='white', alpha=1.0)

# add padding around stars
padding_ra = (x.max() - x.min()) * 0.2
padding_dec = (y.max() - y.min()) * 0.2
plt.xlim(x.min() - padding_ra, x.max() + padding_ra)
plt.ylim(y.min() - padding_dec, y.max() + padding_dec)

# Label stars with proper names if available (using unwrapped RA)
for i, row in top_stars.iterrows():
    this_ra = ra.loc[i]  # use the corrected RA value
    if pd.notna(row['proper']) and str(row['proper']).strip() != "":
        plt.text(
            this_ra + 0.15,   # small offset
            row['dec'] + 0.15,
            row['proper'],
            color='white',
            fontsize=8,
            ha='left',
            va='bottom'
        )



plt.gca().set_facecolor('black')
# plt.title(f"{constellation_name} - Top {N} Brightest Stars")
plt.xlabel("RA")
plt.ylabel("Dec")
plt.gca().invert_xaxis()
plt.xticks([])
plt.yticks([])

filename = "const_plot.png"
plt.savefig(filename, dpi=150, bbox_inches='tight')

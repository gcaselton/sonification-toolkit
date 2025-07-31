import lightkurve as lk
import matplotlib.pyplot as plt

search_result = lk.search_lightcurve(
    target="KIC 11804465",
    exptime=1800,
    mission="Kepler",
    author="Kepler",
    quarter=1
)

print(search_result)
lc = search_result.download()

lc.plot()
plt.show()
search_result.download(download_dir='.')

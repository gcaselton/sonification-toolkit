import lightkurve as lk
import matplotlib.pyplot as plt

# Search TESS Sector 58 data for a specific target (example: TIC ID or coordinates)
search_result = lk.search_lightcurve(
    target="beta persei",  # Replace this with a valid TIC ID or coordinates
    mission="TESS",
    author="SPOC",
    sector=58
)

search_result.download(download_dir='.')

import lightkurve as lk
import matplotlib.pyplot as plt

search_result = lk.search_lightcurve(
    target="delta cephei"
    # mission="TESS",
    # author="SPOC",
    # sector=58
)

print(search_result)
# search_result.download(download_dir='.')

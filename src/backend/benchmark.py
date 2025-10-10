import time
from lightkurve import search_lightcurve
from astroquery.mast import Observations
from astroquery.simbad import Simbad
from light_curve import search_lightcurves, get_identifiers

kic = 'KIC 7548061'
tic = 'TIC 28569279'
common = 'HD 175082'


start = time.time()
lc_result = search_lightcurve(common)
end = time.time()
print(f"LK search found {len(lc_result)} results in {end - start:.2f} seconds.")

# # --- Lightkurve search ---
# start = time.time()
# lk_result = search_lightcurve(target, mission="Kepler")
# end = time.time()
# print(f"Lightkurve 2nd search found {len(lk_result)} results in {end - start:.2f} seconds.")

# # --- Direct MAST query ---
# start = time.time()
# mast_result = Observations.query_criteria(
#     objectname=target,
#     obs_collection="Kepler",
#     dataproduct_type="timeseries"
# )
# end = time.time()
# print(f"MAST query found {len(mast_result)} results in {end - start:.2f} seconds.")


# products = Observations.get_product_list(mast_result)
# lc_products = Observations.filter_products(products, productSubGroupDescription="LC")
# print(f"Filtered to {len(lc_products)} long-cadence products.")

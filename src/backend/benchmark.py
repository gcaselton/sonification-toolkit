import time
from lightkurve import search_lightcurve
from astroquery.mast import Observations

target = "Kepler-10"

# --- Lightkurve search ---
start = time.time()
lk_result = search_lightcurve(target, mission="Kepler")
end = time.time()
print(f"Lightkurve search found {len(lk_result)} results in {end - start:.2f} seconds.")

# --- Direct MAST query ---
start = time.time()
mast_result = Observations.query_criteria(
    objectname=target,
    obs_collection="Kepler",
    dataproduct_type="timeseries"
)
end = time.time()
print(f"MAST query found {len(mast_result)} results in {end - start:.2f} seconds.")


products = Observations.get_product_list(mast_result)
lc_products = Observations.filter_products(products, productSubGroupDescription="LC")
print(f"Filtered to {len(lc_products)} long-cadence products.")

import lightkurve as lk
import matplotlib.pyplot as plt
import numpy as np

from extensions import quick_sonify

def filter_by_author(search_result):

    # To do - determine which HLSPs/pipelines are the best for our purposes

    filtered_result = search_result[(search_result.author == "SPOC") | (search_result.author == "TESS-SPOC")]

    if len(filtered_result) > 0:
        return filtered_result
    else:
        filtered_result = search_result[search_result.author == 'QLP']

        if len(filtered_result) > 0:
            return filtered_result
        else:
            return search_result
        
def search_for_star(star_name):

   

    print('Searching the Universe for ' + star_name + '...')

    search_result = lk.search_lightcurve(star_name)

    if len(search_result) == 0:
        return None
    
    # filtered_result = filter_by_author(search_result)

    print('Light curve data found!')
    search_result.table.write("lightcurve_table.csv", format='csv', overwrite=True)

    # Download most recent light curve to mitigate noise from thermal effects of launch
    lc = search_result[-1].download()

    return None

def lc_to_arrays(light_curve):

    # Extract time and flux (brightness) from the light curve object such that it can be fed into strauss
    time = np.asarray(light_curve.time.value)
    flux = np.asarray(light_curve.flux)

    return time, flux

def clean_lc(light_curve):

    # Remove the NANs and outliers
    return light_curve.remove_nans().remove_outliers()

def sonify_star(star_name):

    lc = search_for_star(star_name)

    if lc is None:
        print('No light curve results found for ' + star_name)
    else:
        cleaned_lc = clean_lc(lc)
        time, flux = lc_to_arrays(cleaned_lc)
        # plt.scatter(time, flux)
        cleaned_lc.plot()
        plt.show()

        quick_sonify(time, flux)

    




    


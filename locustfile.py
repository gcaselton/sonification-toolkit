from locust import HttpUser, task, between
import random

class APIUser(HttpUser):
    
    # Wait 1-3 seconds between tasks (simulates real user behavior)
    wait_time = between(1, 3)
    
    # Root
    web = "my web address"
    local = 'http://localhost:8000'
    
    host = local

    def on_start(self):
       
        response = self.client.get("/core/session/")
        print(response.cookies)
        self.counter = 0
        

    @task(3)
    def get_light_curves(self):
        self.client.get("/core/suggested-data/light_curves/")
        
    @task(3)
    def get_consts(self):
        self.client.get("/core/suggested-data/constellations/")
        
    @task(3)
    def get_lc_styles(self):
        self.client.get("/core/styles/light_curves")
        
    @task(3)
    def get_const_styles(self):
        self.client.get("/core/styles/constellations")
        
    @task(3)
    def get_nightsky_styles(self):
        self.client.get("/core/styles/night_sky")

    @task(2)
    def plot_lc1(self):
        self.client.post("/light-curves/plot/", json={
            "file_ref": "suggested_data:light_curves:kepler-12.fits"
        })
        
    @task(2)
    def plot_lc2(self):
        self.client.post("/light-curves/plot/", json={
            "file_ref": "suggested_data:light_curves:v477_cygni.fits"
        })
        
    @task(2)
    def plot_const1(self):
        self.client.post("/constellations/get-and-plot/", json={
            "name": "Orion",
            "by_shape": True,
            "n_stars": 10
        })
        
    @task(2)
    def plot_const2(self):
        self.client.post("/constellations/get-and-plot/", json={
            "name": "Scorpius",
            "by_shape": True,
            "n_stars": 10
        })
        
    @task(1)
    def sonify_lc(self):
        datas = ['beta_persei.fits', 'kepler-12.fits', 'v477_cygni.fits', 'v1154_cygni.fits']
        styles = ['flute_notes.yml', 'nuclear.yml', 'sci_fi.yml', 'twinkle.yml', 'windy.yml', 'power_hum.yml']
        durations = [10, 15, 20 , 30, 60]
        
        chosen_data = random.choice(datas)
        chosen_style = random.choice(styles)
        chosen_dur = random.choice(durations)
        
        data_ref = f'suggested_data:light_curves:{chosen_data}'
        style_ref = f'style_files:light_curves:{chosen_style}'
        name = f"{chosen_data.split('.')[0]}_{str(self.counter)}"
        
        self.counter += 1
        
        self.client.post("/core/generate-sonification/", json={
            'category': 'light_curves',
            'data_ref': data_ref,
            'style_ref': style_ref,
            'duration': chosen_dur,
            'system': 'mono',
            'data_name': name
        })
        

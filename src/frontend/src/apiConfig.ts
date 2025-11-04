const viteEnv = import.meta.env.VITE_API_URL;
const local = 'http://localhost:8000'
const renderURL = 'https://sonification-toolkit.onrender.com'

export const apiUrl = local
export const coreAPI = `${apiUrl}/core`
export const lightCurvesAPI = `${apiUrl}/light-curves`
export const constellationsAPI = `${apiUrl}/constellations`



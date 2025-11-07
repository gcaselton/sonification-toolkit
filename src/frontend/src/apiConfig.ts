const viteEnv = import.meta.env.VITE_API_URL;
const local = import.meta.env.VITE_SONIFICATION_BACKEND_URL

export const apiUrl = local
export const coreAPI = `${apiUrl}/core`
export const lightCurvesAPI = `${apiUrl}/light-curves`
export const constellationsAPI = `${apiUrl}/constellations`



import { data } from "react-router-dom";
import { apiUrl } from "../apiConfig";
import { apiRequest } from "./requests";

export async function plotData (dataRef: string, soniType: string ) {

    const endpoint = `${apiUrl}/${soniType}/plot/`
    const payload = {
        file_ref: dataRef
    }

    const plotResult = await apiRequest(endpoint, payload)
    
    return plotResult.image;

}
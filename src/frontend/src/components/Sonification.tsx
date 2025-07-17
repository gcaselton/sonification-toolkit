import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useLocation } from 'react-router-dom';

import {
  Box,
  Button,
  Card,
  Image, 
  Input,
  Dialog,
  Stack,
  VStack,
  Table,
} from "@chakra-ui/react";

export default function Sonification() {

    const variants = ["Sci-Fi", "Windy", "Musical", "Custom"] as const;
    //const [lightcurves, setLightcurves] = useState([])
    const location = useLocation();
    const dataURI = location.state;
    console.log("Data URI from Lightcurves:", dataURI);
    const selectLightCurve = async (lightcurve: string) => {
        const select_lightcurve_url = "http://localhost:8000/select-lightcurve";
        const response = await fetch(select_lightcurve_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "data_uri": lightcurve }),
        });
        const data = await response.json();
        return data.filepath;
    }

    return (
        <Box>
            <h1>Sonification</h1>
            <br />

            <Stack gap="4" direction="row" wrap="wrap">
                {variants.map((variant) => (
                    <Card.Root width="200px" key={variant}>
                    <img src={`/assets/${variant}.jpg`} alt={variant} style={{ width: "100%", borderRadius: "8px" }} />
                    <Card.Body gap="2">
                        <Card.Title mb="2">{variant}</Card.Title>
                    </Card.Body>
                    </Card.Root>
                ))}
            </Stack>
        </Box>

    )
}
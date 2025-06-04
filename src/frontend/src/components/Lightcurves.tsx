import React, { useEffect, useState, createContext, useContext } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Input,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Stack,
  Text,
  DialogActionTrigger,
} from "@chakra-ui/react";

interface Lightcurve {
  id: string;
  item: string;
}

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => {}
})

export default function Lightcurves() {
  const [lightcurves, setLightcurves] = useState([])
  const url = "http://localhost:8000/search-lightcurves"
  const data = {
    "star_name": "HD 12345"
  }
  const config = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }
  const fetchLightcurves = async () => {
    const response = await fetch(url, config)
    const lc = await response.json()
    setLightcurves(lc.data)
  }
  useEffect(() => {
    fetchLightcurves()
  }, [])

  return (
    <LightcurvesContext.Provider value={{lightcurves, fetchLightcurves}}>
      <Container maxW="container.xl" pt="100px">
        <Stack gap={5}>
          {lightcurves.map((lc: Lightcurve) => (
            <b key={lc.id}>{lc.item}</b>
          ))}
        </Stack>
      </Container>
    </LightcurvesContext.Provider>
  )
}
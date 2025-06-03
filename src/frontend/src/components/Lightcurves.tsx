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
  const fetchLightcurves = async () => {
    const response = await fetch("http://localhost:8000/search-lightcurves")
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
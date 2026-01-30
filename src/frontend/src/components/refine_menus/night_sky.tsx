import {
  Box,
  Button,
  createListCollection,
  Checkbox,
  Code,
  Field,
  Heading,
  Image,
  Input,
  Text,
  Flex,
  NumberInput,
  VStack,
  Select,
  Slider,
  Skeleton,
  HStack,
} from "@chakra-ui/react";
import { RefineMenuProps } from "./RefineMenu";
import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { plotLightcurve } from "../pages/Lightcurves";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, nightSkyAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";


export default function Constellations({ dataRef, dataName, onApply }: RefineMenuProps) {

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // magnitude state
  const [magnitude, setMagnitude] = useState('4.5')

  const [applyLoading, setApplyLoading] = useState(false)

  // re-plot when nStars or magnitude changes(also on initial magnitude fetch)
  useEffect(() => {
    const handler = setTimeout(() => {
      plotNightSky();
    }, 300); // wait after the last change

    // cancel the timeout if magnitude changes again
    return () => clearTimeout(handler);
  }, [magnitude]);


  // request plot from backend
  const plotNightSky = async () => {
    
    setImageLoading(true)

    const refineURL = `${nightSkyAPI}/refine-stars/`
    const refinePayload = {
        maglim: magnitude,
        file_ref: dataRef
    }
    
    const refineResult = await apiRequest(refineURL, refinePayload)
    const refinedRef = refineResult.file_ref
    

    const plotURL= `${nightSkyAPI}/plot/`
    const plotPayload = {
      file_ref: refinedRef
    }

    const result = await apiRequest(plotURL, plotPayload)
    
    // update image state
    setImageSrc(`data:image/png;base64,${result.image}`);

    setImageLoading(false)
  }


  return (
    <VStack gap="4" align="start" justify="center">
      <Box width="50%">
      <VStack align='start' justify='center' gap='16' w='80%'>
        <Field.Root width='auto'>
        <Field.Label>Magnitude less than</Field.Label>
        <NumberInput.Root
          min={-1.5}
          max={21} 
          value={magnitude} 
          onValueChange={(e) => {
            setMagnitude(e.value);
          }}
          inputMode="decimal">
          <NumberInput.Control />
            <NumberInput.Input />
        </NumberInput.Root>
        </Field.Root>
    
      </VStack>
      </Box>

      <Box width="100%" >
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt={`A plot of the brightest stars in ${dataName}.`} animation="fade-in 300ms ease-out"/>
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
    </VStack>
  );
}

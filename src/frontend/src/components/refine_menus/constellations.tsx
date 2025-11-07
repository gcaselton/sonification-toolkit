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
  HStack
} from "@chakra-ui/react";
import { RefineMenuProps } from "./RefineMenu";
import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { plotLightcurve } from "../pages/Lightcurves";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, constellationsAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { InfoTip } from "../ui/ToggleTip";


export default function Constellations({ dataFilepath, dataName, onApply }: RefineMenuProps) {

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // number of stars
  const [nStars, setNStars] = useState('10')

  // magnitude state
  const [magnitude, setMagnitude] = useState('6')

  const [applyLoading, setApplyLoading] = useState(false)
  
  // fetch plot on first load
  useEffect(() => {
    const fetchPlot = async () => {
      await plotConstellation();
    };

    fetchPlot();
  }, []);

  // request plot from backend
  const plotConstellation = async () => {
    
    setImageLoading(true)

    const endpoint = `${constellationsAPI}/plot-constellation/`
    const payload = {
      name: dataName,
      n_stars: nStars,
    }

    const result = await apiRequest(endpoint, payload)
    
    // update image state
    setImageSrc(`data:image/png;base64,${result.image}`);

    setImageLoading(false)
  }


  const handleClickApply = async () => {

    setApplyLoading(true)

    const endpoint = `${constellationsAPI}/save-refined/`
    const payload = {
      name: dataName,
      n_stars: nStars
    }

    const result = await apiRequest(endpoint, payload)

    if (onApply) {
        onApply(result.data_filepath); // pass new filepath up to parent Refine.tsx
      }
    
      setApplyLoading(false)

  }

  // const invalidNStars = isNaN(Number(nStars)) || !Number.isInteger(Number(nStars)) || Number(nStars) <= 0 || Number(nStars) > 60;

  // const applyButtonOn = cropValues && cropRange ?
  //                           cropValues![0] == cropRange![0] &&
  //                           cropValues![1] == cropRange![1] &&
  //                           sigma == 0
  //                           ? false
  //                           : true
  //                         : false


  return (
    <HStack gap="4" align="start" justify="center">
      <Box width="50%">
      <VStack align='start' justify='center' gap='16' w='80%'>
        <HStack>
        <Field.Root>
        <Field.Label>Number of Stars</Field.Label>
        <NumberInput.Root
          min={1}
          max={1000} 
          value={nStars} 
          onValueChange={(e) => {
            const intValue = Math.floor(Number(e.value));
            if (!isNaN(intValue)) {
              setNStars(intValue.toString());
            }
          }}
          inputMode="numeric"
          width='40%'>
          <NumberInput.Control />
            <NumberInput.Input />
        </NumberInput.Root>
        </Field.Root>
        <Field.Root>
        <Field.Label>Magnitude less than</Field.Label>
        <NumberInput.Root
          min={-1.5}
          max={21} 
          value={magnitude} 
          onValueChange={(e) => {
            const intValue = Math.floor(Number(e.value));
            if (!isNaN(intValue)) {
              setMagnitude(intValue.toString());
            }
          }}
          inputMode="numeric"
          width='40%'>
          <NumberInput.Control />
            <NumberInput.Input />
        </NumberInput.Root>
        </Field.Root>
        </HStack>
        <HStack gap='5' justify="center" w="100%" animation="fade-in 300ms ease-out">
          <Button w='40%' onClick={plotConstellation} colorPalette="teal" variant="surface">
            Preview changes
          </Button>
          <Button w='40%' onClick={handleClickApply} colorPalette="teal" loading={applyLoading} loadingText="Saving...">
            Apply & Continue
          </Button>
        </HStack>
      </VStack>
      </Box>

      <Box width="50%" >
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt="Constellation plot" animation="fade-in 300ms ease-out"/>
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
    </HStack>
  );
}

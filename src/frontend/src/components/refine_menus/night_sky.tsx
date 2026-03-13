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
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, nightSkyAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { plotData } from "../../utils/plot";
import { InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { LuArrowRight } from "react-icons/lu";


export default function Constellations({ dataRef, dataName, onApply }: RefineMenuProps) {

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [fileRef, setFileRef] = useState(dataRef);

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
    
    setFileRef(refinedRef);

    const image = await plotData(refinedRef, 'night-sky')

    // update image state
    setImageSrc(`data:image/svg+xml;base64,${image}`);

    setImageLoading(false)
  }

  const handleClickApply = async () => {

    setApplyLoading(true);

    if (onApply){
      onApply(fileRef); // Pass the refined data file reference up to Refine.tsx
    }

  }


  return (
    <VStack gap="4" align="start" justify="center">
      <Box width="50%">
        <Field.Root width='auto'>
          <Field.Label>Magnitude less than</Field.Label>
          <NumberInput.Root
            min={-1.5}
            max={6}
            value={magnitude}
            onValueChange={(e) => {
              setMagnitude(e.value);
            }}
            inputMode="decimal">
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
        </Field.Root>
      </Box>
      <Box width="100%" >
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt={`A plot of the brightest stars in ${dataName}.`} animation="fade-in 300ms ease-out" rounded='md'/>
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
      <Button
        w="auto"
        onClick={handleClickApply}
        colorPalette="teal"
        loading={applyLoading}
        loadingText="Saving..."
      >
        Apply & Continue <LuArrowRight />
      </Button>
    </VStack>
  );
}

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
import { apiUrl, lightCurvesAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { InfoTip } from "../ui/ToggleTip";


export default function LightCurves({ dataFilepath, onApply }: RefineMenuProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // fetched range from backend (x axis min/max)
  const [cropRange, setCropRange] = useState<[number, number] | null>(null);

  // controlled slider value
  const [cropValues, setCropValues] = useState<[number, number] | null>(null);

  const [slidersLoading, setSlidersLoading] = useState(true)

  // sigma value for data smoothing
  const [sigma, setSigma] = useState(0)

  const [applyLoading, setApplyLoading] = useState(false)
  const [hasEdited, setHasEdited] = useState(false)
  
  // fetch plot
  useEffect(() => {
    let mounted = true;
    async function fetchPlot() {
      try {
        const base64 = await plotLightcurve(dataFilepath);
        if (!mounted) return;
        setImageSrc(`data:image/png;base64,${base64}`);
      } catch (err) {
        console.error("Error generating plot:", err);
      } finally {
        if (mounted) setImageLoading(false);
      }
    }
    fetchPlot();
    return () => { mounted = false; };
  }, [dataFilepath]);

  // fetch cropRange
  useEffect(() => {
    
    if (!dataFilepath) return;

    let mounted = true;
    async function fetchCropRange() {
    
      const endpoint = `${lightCurvesAPI}/get-range/`;
      try {
        const payload = { data_filepath: dataFilepath}
        const result = await apiRequest(endpoint, payload, 'POST')

        if (mounted && Array.isArray(result.range) && result.range.length === 2) {
          const r: [number, number] = [Number(result.range[0]), Number(result.range[1])];
          setCropRange(r);
          setCropValues(r);
          setSlidersLoading(false)
        }

      } catch (error) {
        console.error("Error fetching x-axis range:", error);
        setSlidersLoading(false);
      }
    }
    fetchCropRange();
    return () => { 
      mounted = false; 
    };
  }, [dataFilepath]);

  // prepare marks when cropRange exists
  const sliderMarks = cropRange ? [
        { value: cropRange[0], label: String(cropRange[0]) },
        { value: cropRange[1], label: String(cropRange[1]) },
      ]
  : [];
  

  // preview function
  const fetchPreviewPlot = async (range: [number, number] | null, sigmaVal: number) => {
    if (!range) return;
    setImageLoading(true);

    const endpoint = `${lightCurvesAPI}/preview-refined/`;
    const payload = {
      data_filepath: dataFilepath,
      new_range: range,
      sigma: sigmaVal,
    };

    try {
      const result = await apiRequest(endpoint, payload);
      setImageSrc(`data:image/png;base64,${result.image}`);
    } catch (err) {
      console.error("Error previewing plot:", err);
    } finally {
      setImageLoading(false);
    }
  };


  const handleClickApply = async () => {

    setApplyLoading(true)

    const endpoint = `${lightCurvesAPI}/save-refined/`
    const payload = {
      data_filepath: dataFilepath,
      new_range: cropValues,
      sigma: sigma
    }

    const result = await apiRequest(endpoint, payload)

    if (onApply) {
        onApply(result.data_filepath); // pass new filepath up to parent Refine.tsx
      }
    
      setApplyLoading(false)

  }

  const applyButtonOn = cropValues && cropRange ?
                            cropValues![0] == cropRange![0] &&
                            cropValues![1] == cropRange![1] &&
                            sigma == 0
                            ? false
                            : true
                          : false


  return (
    <HStack gap="4" align="start" justify="center">
      <Box width="50%">
        <VStack align='start' justify='center' gap='16' w='80%'>
        {/* render slider only when we have cropRange & cropValues */}
        {!slidersLoading && cropRange && cropValues ? (
          <Slider.Root
            w="100%"
            minStepsBetweenThumbs={1}
            colorPalette="teal"
            min={cropRange[0]}
            max={cropRange[1]}
            value={cropValues}
            animation="fade-in 300ms ease-out"
            onValueChange={(e) => {
              setCropValues(e.value as [number, number]);
              setHasEdited(true);
            }}
            onValueChangeEnd={(e) => {
              fetchPreviewPlot(e.value as [number, number], sigma); // only runs on mouse release
            }}
          >
            <Slider.Label textStyle='md'>
              {'Trim start ('}
              <Code textStyle='md'>{cropValues[0]}</Code>
              {') and end ('}
              <Code textStyle='md'>{cropValues[1]}</Code>
              {') points'}
            </Slider.Label>
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
              <Slider.Marks marks={sliderMarks} />
            </Slider.Control>
          </Slider.Root>
        ) : (
          <Box width="100%">
            <Skeleton height='4em'/>
          </Box>
        )}
        {!slidersLoading ? (
          <Slider.Root  
            w='100%'
            colorPalette='teal'
            min={0}
            max={10}
            value={[sigma]}
            animation="fade-in 300ms ease-out"
            onValueChange={(e) => {
              setSigma(e.value[0]);
              setHasEdited(true)
            }}
            onValueChangeEnd={(e) => {
              fetchPreviewPlot(cropValues, e.value[0]);
            }}
            >
            <HStack>
              <Slider.Label textStyle='md'>Smoothing Factor</Slider.Label>
              <InfoTip content='This is the standard deviation to give to a Gaussian filter, removing noise from the signal.' positioning={{placement: 'top'}}/>
              <Code textStyle='md' ml='auto'>{sigma}</Code>
            </HStack>
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
          </Slider.Root>
        ) : (
          <Box width="100%">
            <Skeleton height='4em'/>
          </Box>
        )}
      {!slidersLoading ? (
      <HStack gap='5' justify="center" w="100%" animation="fade-in 300ms ease-out">
        <Button w='40%' onClick={handleClickApply} colorPalette="teal" loading={applyLoading} loadingText="Saving..." variant={applyButtonOn ? 'solid' : 'surface'}>
          {applyButtonOn ? 'Apply & Continue' : 'Skip'}
        </Button>
      </HStack>) : (
      <Box width="100%">
        <Skeleton height='4em'/>
      </Box>
      )}
      </VStack>
      </Box>

      <Box width="50%" >
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt="Light curve plot" animation="fade-in 300ms ease-out"/>
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
    </HStack>
  );
}

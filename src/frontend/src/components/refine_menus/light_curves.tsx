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
import { apiUrl as baseAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";


const lightCurveAPI = baseAPI + '/light-curves'


export default function LightCurves(dataFilepath: RefineMenuProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // fetched range from backend (x axis min/max)
  const [cropRange, setCropRange] = useState<[number, number] | null>(null);

  // controlled slider value
  const [cropValues, setCropValues] = useState<[number, number] | null>(null);

  // window length for data smoothing
  const [window, setWindow] = useState<[number] | null>(null)
  const [maxWindow, setMaxWindow] = useState<number | null>(null)

  // fetch plot
  useEffect(() => {
    let mounted = true;
    async function fetchPlot() {
      try {
        const base64 = await plotLightcurve(dataFilepath.dataFilepath);
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
    if (!dataFilepath?.dataFilepath) return;

    let mounted = true;
    async function fetchCropRange() {
      const endpoint = `${lightCurveAPI}/get-range-data/`;
      try {
        const payload = { data_filepath: dataFilepath.dataFilepath}
        const result = await apiRequest(endpoint, payload, 'POST') // Send the request

        setMaxWindow(result.max_window)
        setWindow([result.max_window])

        // ensure range is a two-element numeric array
        if (mounted && Array.isArray(result.range) && result.range.length === 2) {
          const r: [number, number] = [Number(result.range[0]), Number(result.range[1])];
          setCropRange(r);
          setCropValues(r); // set slider values
        }
      } catch (error) {
        console.error("Error fetching x-axis range:", error);
      }
    }
    fetchCropRange();
    return () => { mounted = false; };
  }, [dataFilepath.dataFilepath]);

  // prepare marks when cropRange exists
  const sliderMarks = cropRange ? [
        { value: cropRange[0], label: String(cropRange[0]) },
        { value: cropRange[1], label: String(cropRange[1]) },
      ]
  : [];

  const handleClickPreview = async () => {

    setImageLoading(true)

    const endpoint = `${lightCurveAPI}/preview-refined/`
    const payload = {
      data_filepath: dataFilepath.dataFilepath,
      new_range: cropValues,
      window_length: window![0]
    }

    const result = await apiRequest(endpoint, payload)
  
    setImageSrc(`data:image/png;base64,${result.image}`);
    setImageLoading(false)

  }



  return (
    <HStack gap="4" align="start" justify="center">
      <Box width="50%">
        <VStack align='start' justify='center' gap='10'>
        {/* render slider only when we have cropRange & cropValues */}
        {cropRange && cropValues ? (
          <Slider.Root
            w="md"
            minStepsBetweenThumbs={1}
            colorPalette="teal"
            min={cropRange[0]}
            max={cropRange[1]}
            value={cropValues}
            onValueChange={(e) => setCropValues(e.value as [number, number])}
          >
            <Slider.Label>
              {'Trim start ('}
              <Code textStyle='md'>{cropValues[0]}</Code>
              {') and end ('}
              <Code textStyle='md'>{cropValues[1]}</Code>
              {') of the x-axis.'}
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
          <Skeleton height='5em'/>
        )}
        {window ? (
          <Slider.Root  
            w='md'
            colorPalette='teal'
            min={0}
            max={maxWindow!}
            value={window}
            onValueChange={(e) => setWindow(e.value as [number])}>
            <HStack justify="space-between">
              <Slider.Label>Window Length</Slider.Label>
              <Code textStyle='md'>{window[0]}</Code>
            </HStack>
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
          </Slider.Root>
        ) : (
          <Skeleton height='5em'/>
        )}
      
        
      <Button onClick={handleClickPreview} 
              colorPalette='teal'
              >Preview changes</Button>
      </VStack>
      </Box>

      <Box width="50%">
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt="Light curve plot" />
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
    </HStack>
  );
}

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
  useSlider,
  HStack
} from "@chakra-ui/react";
import { RefineMenuProps } from "./RefineMenu";
import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { plotLightcurve } from "../pages/Lightcurves";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl as baseAPI } from "../../apiConfig";


const lightCurveAPI = baseAPI + '/light-curves'


export default function LightCurves(dataFilepath: RefineMenuProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // fetched range from backend (x axis min/max)
  const [cropRange, setCropRange] = useState<[number, number] | null>(null);

  // controlled slider value
  const [cropValues, setCropValues] = useState<[number, number] | null>(null);

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
      const endpoint = `${lightCurveAPI}/get-range`;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ data_filepath: dataFilepath.dataFilepath }),
        });
        const result = await res.json();

        // ensure range is a two-element numeric array
        if (mounted && Array.isArray(result.range) && result.range.length === 2) {
          const r: [number, number] = [Number(result.range[0]), Number(result.range[1])];
          setCropRange(r);
          setCropValues(r); // set slider value after we know min/max
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



  return (
    <HStack gap="4" align="start" justify="center">
      <Box width="50%">
        {/* render slider only when we have cropRange & cropValues to avoid clamping issues */}
        {cropRange && cropValues ? (
          <Slider.Root
            maxW="md"
            minStepsBetweenThumbs={1}
            colorPalette="teal"
            min={cropRange[0]}
            max={cropRange[1]}
            value={cropValues}
            onValueChange={(e) => setCropValues(e.value as [number, number])}
          >
            <Slider.Label>
              {'Trim start ('}
              <Code size='md'>{cropValues[0]}</Code>
              {') and end ('}
              <Code size='md'>{cropValues[1]}</Code>
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
      </Box>

      <Box width="50%">
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image src={imageSrc} alt="Lightcurve plot" />
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
    </HStack>
  );
}

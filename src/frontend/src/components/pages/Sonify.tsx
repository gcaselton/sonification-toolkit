import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import LoadingMessage from "../ui/LoadingMessage";
import {BackButton} from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, lightCurvesAPI, coreAPI, constellationsAPI} from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import {
  Box,
  Button,
  createListCollection,
  Checkbox,
  Field,
  Heading,
  Image,
  Input,
  Text,
  Flex,
  NumberInput,
  VStack,
  Select,
  HStack
} from "@chakra-ui/react";
import { plotLightcurve } from "./Lightcurves";


export default function Sonify() {

  const location = useLocation();
  const soniType = location.state.soniType;
  const styleFilepath = location.state.styleFilepath;
  const dataFilepath = location.state.dataFilepath;

  // states
  const [length, setLength] = useState('15');
  const [audioSystem, setAudioSystem] = useState<string[]>([(soniType == 'light_curves') ? "mono" : "stereo"])
  const [audioFilepath, setAudioFilepath] = useState("");
  const [soniReady, setSoniReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [daysPerSec, setDaysPerSec] = useState('');
  const [totalDays, setTotalDays] = useState<number>(0);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // Generate the plot once when component mounts
  useEffect(() => {
    async function fetchPlot() {
      try {

        var imageBase64

        if (soniType === 'light_curves') {
          imageBase64 = await plotLightcurve(dataFilepath)
        }
        else if (soniType === 'constellations') {

          const endpoint = `${constellationsAPI}/plot-csv/`
          const payload = {data_filepath: dataFilepath}
          
          const result = await apiRequest(endpoint, payload)
          imageBase64 = result.image
        }

        setImageSrc(`data:image/png;base64,${imageBase64}`);
      } catch (error) {
        console.error("Error generating plot:", error);
      } finally {
        setImageLoading(false);
      }
    }
    fetchPlot();
  }, [dataFilepath]);

  // Fetch data range once on load
  useEffect(() => {
    const fetchDataRange = async () => {
      const url_range = `${lightCurvesAPI}/get-range/`;
      const data = {
        "data_filepath": dataFilepath
      };
      try {
        const response = await apiRequest(url_range, data, 'POST');
        const dataRange = response.range;
        const days = dataRange[1] - dataRange[0];
        setTotalDays(days);
        const rounded = Number((days / Number(length))).toFixed(1);
        setDaysPerSec(rounded);
      } catch (error) {
        console.error("Error fetching data range:", error);
      }
    };
    fetchDataRange();
  }, []);

  const audioSystemOptions = createListCollection({
    items: [
      { label: "Stereo", value: "stereo" },
      { label: "Mono", value: "mono" },
      { label: "5.1 Surround", value: "5.1" },
      { label: "7.1 Surround", value: "7.1" },
    ],
  });

  const requestSonification = async () => {

    setErrorMessage("")
    
    const url_sonification = `${coreAPI}/generate-sonification/`;
  
    const data = {
      "category": soniType,
      "data_filepath": dataFilepath,
      "style_filepath": styleFilepath,
      "duration": length,
      "system": audioSystem[0]
    };
    const config = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };
    try {
      const response = await fetch(url_sonification, config);
      if (!response.ok) {
        setErrorMessage("Error generating sonification. Please try again with different Style settings.")
        throw new Error("Network response was not ok");
      }
      const result = await response.json();
      console.log("Sonification result:", result);
      return result.filename; 
    } catch (error) {
      console.error("Error fetching sonification:", error);
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSoniReady(false)
    setLoading(true)

    console.log("Sonification Length:", length);
    console.log("Audio System:", audioSystem);

    requestSonification().then((filename) => {
      setLoading(false)
      if (filename) {
        console.log("Sonification file created:", filename);
        setAudioFilepath(filename);
        setSoniReady(true)
      } else {
        console.error("No sonification file returned.");
      }
    });
  };

  const handleLengthChange = (value: string) => {
    setLength(value);
    if (totalDays > 0 && value) {
      const rounded = Number(totalDays / Number(value)).toFixed(1);
      setDaysPerSec(rounded);
    }
  }

  const handleDaysPerSecChange = (value: string) => {

    setDaysPerSec(value);
    const floatValue = parseFloat(value);
  
    if (totalDays > 0 && floatValue > 0) {
      const rounded = Number(totalDays / floatValue).toFixed(0);
      setLength(rounded);
    }
  }

  const invalidLength = (
    Number(length) > 60 ||
    length === '0' || 
    length.includes('.') ||
    length.includes('-')
  );


  return (
    <PageContainer>
      <Box position='relative' as="main" role="main">
        <Heading size="4xl">Step 3: Sonify</Heading>
        <br />
        <Text textStyle='lg'>Set the length of the sonification and specify the audio system you intend to play it on.</Text>
        <br />
        <HStack gap='4' align='start' justify='center'>
        <Box width='50%'>
          <form onSubmit={handleSubmit}>
              <VStack align='start' justify='center' w='80%' gap={8}>
                <HStack gap={10}>
                <Field.Root invalid={invalidLength} width='auto'>
                  <Field.Label>Duration (seconds)</Field.Label>
                  <NumberInput.Root 
                  value={length} 
                  onValueChange={(e) => 
                    handleLengthChange(e.value)
                  }
                  inputMode="numeric"
                  min={1}
                  max={60}>
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                  <Field.ErrorText>Please enter a whole number up to 60 seconds.</Field.ErrorText>
                </Field.Root>
                <Text textStyle='2xl' height='0.5'>=</Text>
                <Field.Root width='auto'>
                <Field.Label>Days per Second</Field.Label>
                <NumberInput.Root
                  value={String(daysPerSec)} 
                  onValueChange={(e) => {
                    handleDaysPerSecChange(e.value)
                  }}
                  inputMode="decimal"
                  min={0}
                  max={totalDays}>
                  <NumberInput.Control />
                    <NumberInput.Input />
                </NumberInput.Root>
                </Field.Root>
                </HStack>
                <Select.Root collection={audioSystemOptions} value={audioSystem} onValueChange={(e) => setAudioSystem(e.value)} variant='outline'>
                    <Select.HiddenSelect />
                    <Select.Label>Audio System</Select.Label>
                    <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select audio system" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                        <Select.Indicator />
                        </Select.IndicatorGroup>
                    </Select.Control>
                        <Select.Content>
                            {audioSystemOptions.items.map((option) => (
                              <Select.Item item={option} key={option.value}>
                                  {option.label}
                                  <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                        </Select.Content>
                </Select.Root>
                <Button type="submit" colorPalette="teal" width='50%' disabled={invalidLength || length === ''}>
                  Generate
                </Button>
              </VStack>
          </form>
          <br/>
          {loading && <LoadingMessage msg="Generating Sonification..."/>}
          {errorMessage && <ErrorMsg message={errorMessage}/>}
          {!loading && soniReady && (
            <Box mt={4} animation="fade-in" animationDuration="0.3s">
              <audio
                src={`${coreAPI}/audio/${audioFilepath}`}
                controls
                style={{ width: "100%" }}
              />
            </Box>
          )}
        </Box>
        <Box width='50%'>
          {imageLoading ? (
            <LoadingMessage msg="" icon="pulsar" />
          ) : imageSrc ? (
            <Image src={imageSrc} alt="Lightcurve plot" />
          ) : (
            <ErrorMsg message="Unable to plot data."/>
          )}
        </Box>
        </HStack>
      </Box>
    </PageContainer>
  );
}
import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import LoadingMessage from "../ui/LoadingMessage";
import {BackButton} from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, lightCurvesAPI, coreAPI} from "../../apiConfig";
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

  const [length, setLength] = useState('15');
  const [audioSystem, setAudioSystem] = useState<string[]>(["mono"])
  const [audioFilename, setAudioFilename] = useState("");
  const location = useLocation();
  const soniType = location.state.soniType;
  const styleFilepath = location.state.styleFilepath;
  const dataFilepath = location.state.dataFilepath;
  const [soniReady, setSoniReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPlot, setShowPlot] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // Generate the plot once when component mounts
  useEffect(() => {
    async function fetchPlot() {
      try {
        const base64 = await plotLightcurve(dataFilepath);
        setImageSrc(`data:image/png;base64,${base64}`);
      } catch (error) {
        console.error("Error generating plot:", error);
      } finally {
        setImageLoading(false);
      }
    }
    fetchPlot();
  }, [dataFilepath]);

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
    
    const url = `${coreAPI}/generate-sonification/`;
  
    const data = {
      "category": soniType,
      "data_filepath": dataFilepath,
      "style_filepath": styleFilepath,
      "duration": length,
      "system": audioSystem[0]
    };
    
    try {
      const response = await apiRequest(url, data);
      console.log("Sonification result:", response);
      return response.filename; 
    } catch (error) {
      setErrorMessage("Error generating sonification. Please try again with different Style settings.")
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
        setAudioFilename(filename);
        setSoniReady(true)
      } else {
        console.error("No sonification file returned.");
      }
    });
  };

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
              <VStack gap="5">
                <Field.Root invalid={invalidLength}>
                  <Field.Label>Duration (seconds)</Field.Label>
                  <NumberInput.Root value={length} onValueChange={(e) => setLength(e.value)} inputMode="numeric">
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                  {!invalidLength && <Field.HelperText>The sonification will compress or stretch to fit this length.</Field.HelperText>}
                  <Field.ErrorText>Please enter a whole number up to 60 seconds.</Field.ErrorText>
                </Field.Root>
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
                <Checkbox.Root checked={showPlot} onCheckedChange={(details) => setShowPlot(details.checked === true)}>
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>View plot</Checkbox.Label>
                </Checkbox.Root>
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
                src={`${coreAPI}/audio/${audioFilename}`}
                controls
                style={{ width: "100%" }}
              />
            </Box>
          )}
        </Box>
        {showPlot && (
            <Box width='50%'>
              {imageLoading ? (
                <LoadingMessage msg="" icon="pulsar" />
              ) : imageSrc ? (
                <Image src={imageSrc} alt="Lightcurve plot" />
              ) : (
                <ErrorMsg message="Unable to plot data."/>
              )}
            </Box>
          )}
        </HStack>
      </Box>
    </PageContainer>
  );
}
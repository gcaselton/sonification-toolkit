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
  ActionBar,
  Button,
  createListCollection,
  Checkbox,
  DataList,
  Field,
  Heading,
  IconButton,
  Image,
  Input,
  Text,
  Flex,
  NumberInput,
  VStack,
  Select,
  HStack
} from "@chakra-ui/react";
import { LuAudioLines, LuDownload } from "react-icons/lu";
import { plotLightcurve } from "./Lightcurves";


export default function Sonify() {


  const location = useLocation();
  const dataName = location.state.dataName;
  const dataRef = location.state.dataRef;
  const styleName = location.state.styleName;
  const styleRef = location.state.styleRef;
  const soniType = location.state.soniType;


  // Define length limits based on sonification type
  const lengthDict = {
    'light_curves': {'max': 60, 'default': 15},
    'constellations': {'max': 120, 'default': 20}
  }

  const lengths = lengthDict[soniType as keyof typeof lengthDict];

  // states
  const [length, setLength] = useState(lengths.default.toString());
  const [audioSystem, setAudioSystem] = useState<string[]>([(soniType == 'light_curves') ? "mono" : "stereo"])
  const [audioFilename, setAudioFilename] = useState("");
  const [soniReady, setSoniReady] = useState(false)
  const [soniClicked, setSoniClicked] = useState(false)
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
          imageBase64 = await plotLightcurve(dataRef)
        }
        else if (soniType === 'constellations') {

          const endpoint = `${constellationsAPI}/plot-csv/`
          const payload = {file_ref: dataRef}
          
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
  }, [dataRef]);

  // Fetch data range once on load
  useEffect(() => {
    const fetchDataRange = async () => {
      const url_range = `${lightCurvesAPI}/get-range/`;
      const data = {
        file_ref: dataRef
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
    
    const url = `${coreAPI}/generate-sonification/`;
  
    const data = {
      "category": soniType,
      "data_ref": dataRef,
      "style_ref": styleRef,
      "duration": length,
      "system": audioSystem[0]
    };
    
    try {
      const response = await apiRequest(url, data);
      console.log("Sonification result:", response);
      return response.file_ref; 
    } catch (error) {
      setErrorMessage("Error generating sonification. Please try again with different Style settings.")
      console.error("Error fetching sonification:", error);
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSoniClicked(true)
    setSoniReady(false)
    setLoading(true)

    console.log("Sonification Length:", length);
    console.log("Audio System:", audioSystem);

    requestSonification().then((fileRef) => {
      setLoading(false)
      if (fileRef) {
        console.log("Sonification file created:", fileRef);
        setAudioFilename(`${dataName} - ${styleName}`);
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
    Number(length) > lengths.max ||
    length === '0' || 
    length.includes('.') ||
    length.includes('-')
  );

  function formatSoniType(value: string) {
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toLowerCase())
      .replace(/s$/, '')
  }

  const summaryItems = [
  { label: "Data", value: dataName, fileRef: dataRef},
  { label: "Style", value: styleName, fileRef: styleRef},
]

  return (
    <PageContainer>
      <Box position='relative' as="main" role="main">
        <Heading size="4xl" as='h1'>Step 3: Sonify</Heading>
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
                  max={lengths.max}>
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                  <Field.ErrorText>Please enter a whole number up to {lengths.max} seconds.</Field.ErrorText>
                </Field.Root>
                {soniType === 'light_curves' &&
                <> 
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
                </>
                }
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
                  <LuAudioLines/> Sonify
                </Button>
                <DataList.Root orientation="horizontal" divideY="1px" variant='bold' w='100%'>
                  {summaryItems.map((item) => (
                    
                    <DataList.Item key={item.label} pt="4">
                      <DataList.ItemLabel fontWeight='bold'>{item.label}</DataList.ItemLabel>
                      <DataList.ItemValue>{item.value}</DataList.ItemValue>
                      <DataList.ItemValue>
                        <IconButton
                        asChild 
                        colorPalette='teal' 
                        size='sm' 
                        variant='ghost' 
                        >
                          <a href={`${coreAPI}/download?filename=${encodeURIComponent(item.fileRef)}`}><LuDownload /></a>
                        </IconButton>
                      </DataList.ItemValue>
                    </DataList.Item>
                  ))}
                </DataList.Root>
              </VStack>
          </form>
          <br/>
          
        </Box>
        <Box width='50%'>
          {imageLoading ? (
            <LoadingMessage msg="" icon="pulsar" />
          ) : imageSrc ? (
            <Image src={imageSrc} alt={`A plot of the ${dataName} ${formatSoniType(soniType)}`} />
          ) : (
            <ErrorMsg message="Unable to plot data."/>
          )}
        </Box>
        </HStack>
        <ActionBar.Root open={soniClicked}>
          <ActionBar.Positioner>
            <ActionBar.Content w={loading ? '20%' : '50%'} justifyContent='center'>
              {loading && <LoadingMessage msg="Generating Sonification..."/>}
              {errorMessage && <ErrorMsg message={errorMessage}/>}
              {soniReady && 
              <audio
                  src={`${coreAPI}/audio/${audioFilename}`}
                  controls
                  style={{ width: "100%" }}
                />}
            </ActionBar.Content>
          </ActionBar.Positioner>
        </ActionBar.Root>
        <Box h='4em'/>
      </Box>
    </PageContainer>
  );
}
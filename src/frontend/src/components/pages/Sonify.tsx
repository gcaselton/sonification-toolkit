import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import LoadingMessage from "../ui/LoadingMessage";
import {BackButton} from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import {
  Box,
  Button,
  createListCollection,
  Field,
  Heading,
  Image,
  Input,
  Text,
  Flex,
  VStack,
  Select,
  HStack
} from "@chakra-ui/react";
import { plotLightcurve } from "./Lightcurves";


export function LightcurveViewer({ filepath }: { filepath: string }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlot() {
      const base64 = await plotLightcurve(filepath);
      setImageSrc(`data:image/png;base64,${base64}`);
    }
    fetchPlot();
  }, [filepath]);

  if (!imageSrc) {
    return <LoadingMessage msg="" icon="pulsar" />;
  }

  return <Image src={imageSrc} alt="Lightcurve plot" />;
}

export default function Sonify() {

  const [length, setLength] = useState(15);
  const [audioSystem, setAudioSystem] = useState<string[]>(["stereo"])
  const [audioFilepath, setAudioFilepath] = useState("");
  const location = useLocation();
  const settingsFilepath = location.state.filepath;
  const dataFilepath = location.state.dataFilepath;
  const [soniReady, setSoniReady] = useState(false)
  const [loading, setLoading] = useState(false)
  console.log("Filepath of Selected Lightcurve:", dataFilepath);
  console.log("Settings filepath:", settingsFilepath);

  const audioSystemOptions = createListCollection({
    items: [
      { label: "Stereo", value: "stereo" },
      { label: "Mono", value: "mono" },
      { label: "5.1 Surround", value: "5.1" },
      { label: "7.1 Surround", value: "7.1" },
    ],
  });

  // const handleAudioSystemChange = (value: string) => {
  //   console.log("Selected Audio System:", value);
  //   setAudioSystem(value);
  // };

  const requestSonification = async () => {
    const url_sonification = "http://localhost:8000/sonify-lightcurve";
  
    const data = {
      "data_filepath": dataFilepath,
      "style_filepath": settingsFilepath,
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
        throw new Error("Network response was not ok");
      }
      const result = await response.json();
      console.log("Sonification result:", result);
      return result.filename; // Assuming the result contains the sonification data
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


  



  return (
    <PageContainer>
      <Box position='relative'>
        <Heading size="4xl">Sonify</Heading>
        <br />
        <Text textStyle='lg'>Set the length of the sonification and specify the audio system you intend to play it on.</Text>
        <br />
        <HStack>
        <form onSubmit={handleSubmit}>
            <VStack gap="5">
              <Field.Root width="320px">
                <Field.Label>Duration (seconds)</Field.Label>
                <Input
                  placeholder="Duration (seconds)"
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                />
              </Field.Root>
              <Select.Root collection={audioSystemOptions} size="sm" width="320px" value={audioSystem} onValueChange={(e) => setAudioSystem(e.value)} variant='outline'>
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
              <Button type="submit" colorPalette="teal" width="320px">
                Generate
              </Button>
            </VStack>
        </form>
        <LightcurveViewer filepath={dataFilepath}/>
        </HStack>
        <br/>
        {loading && <LoadingMessage msg="Generating Sonification..."/>}
        {!loading && soniReady && (
          <Box mt={4} animation="fade-in" animationDuration="0.3s">
            <audio
              src={`http://localhost:8000/audio/${audioFilepath}`}
              controls
              style={{ width: "100%" }}
            />
          </Box>
        )}
        
      </Box>
    </PageContainer>
  );
}
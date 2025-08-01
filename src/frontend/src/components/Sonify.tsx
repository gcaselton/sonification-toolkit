import React, { useState } from "react";
import { useLocation } from 'react-router-dom';
// import ReactAudioPlayer from 'react-audio-player';
// If you want to use a simple audio player, use the HTML <audio> element below.

import {
  Box,
  Button,
  createListCollection,
  Field,
  Input,
  VStack,
  Select,
} from "@chakra-ui/react";

export default function Sonify() {

  const [length, setLength] = useState(15);
  const [audioSystem, setAudioSystem] = useState<{ label: string; value: string }>({
    label: "Stereo",
    value: "stereo",
  });
  const [audioFilepath, setAudioFilepath] = useState("assets/sample-15s.mp3");
  const location = useLocation();
  const settingsFilepath = location.state.filepath;
  const dataFilepath = location.state.dataFilepath;
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

  const handleAudioSystemChange = (value: string) => {
    console.log("Selected Audio System:", value);
    setAudioSystem(value);
  };

  const requestSonification = async () => {
    const url_sonification = "http://localhost:8000/sonify-lightcurve";
  
    const data = {
      "data_filepath": dataFilepath,
      "style_filepath": settingsFilepath,
      "duration": length,
      "system": audioSystem.value
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
    // Log the length and audio system for debugging
    console.log("Sonification Length:", length);
    console.log("Audio System:", audioSystem);
    requestSonification().then((filename) => {
      if (filename) {
        console.log("Sonification file created:", filename);
        // You can handle the sonification file here, e.g., download it or play it
        setAudioFilepath(filename);
      } else {
        console.error("No sonification file returned.");
      }
    });


  };

  return (
    <Box>
      <h1>Sonify</h1>
      <br />
      <h4>Set the length of the sonification and specify the audio system you intend to play it on</h4>
      <br />
      <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <Field.Root width="320px">
              <Field.Label>Duration (seconds)</Field.Label>
              <Input
                placeholder="Duration (seconds)"
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
              />
            </Field.Root>
            <Select.Root collection={audioSystemOptions} size="sm" width="320px" value={audioSystem} onValueChange={(details) => {setAudioSystem(details);}}>
                <Select.HiddenSelect />
                <Select.Label>Audio System</Select.Label>
                <Select.Control>
                    <Select.Trigger>
                    <Select.ValueText placeholder={audioSystem} />
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
            <Button type="submit" colorScheme="blue" width="320px">
              Generate
            </Button>
          </VStack>
      </form>
      <audio
        src={`http://localhost:8000/audio/${audioFilepath}`} // Replace with the actual audio file URL
        //autoPlay
        controls
        style={{ width: "100%" }}
      />
      <Button type="submit" colorScheme="blue" width="320px">
        Download Sonification
      </Button>
    </Box>
  );
}
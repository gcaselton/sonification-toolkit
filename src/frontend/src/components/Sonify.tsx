import React, { useState } from "react";
import { useLocation } from 'react-router-dom';

import {
  Box,
  Button,
  createListCollection,
  Input,
  VStack,
  Select,
} from "@chakra-ui/react";

export default function Sonify() {

  const [length, setLength] = useState(10);
  const [audioSystem, setAudioSystem] = useState("stereo");

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Log the length and audio system for debugging
    console.log("Sonification Length:", length);
    console.log("Audio System:", audioSystem);
    // Submit the data to the server to get the sonification
  };

  return (
    <Box>
      <h1>Sonify</h1>
      <br />
      <h4>Set the length of the sonification and specify the audio system you intend to play it on</h4>
      <br />
      <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <Input
              placeholder="Length of Sonification (seconds)"
              type="number"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
            <Select.Root collection={audioSystemOptions} size="sm" width="320px" onChange={handleAudioSystemChange}>
                <Select.HiddenSelect />
                <Select.Label>Root Note</Select.Label>
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
            <Button type="submit" colorScheme="blue" width="100%">
              Generate
            </Button>
          </VStack>
      </form>
    </Box>
  );
}
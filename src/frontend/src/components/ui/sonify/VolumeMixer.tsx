import { Box, HStack, Slider, Stack, Text, VStack } from "@chakra-ui/react";
import { Layer } from "../../../types/layers";

interface VolumeMixerProps {
  layers: Layer[];
  onLayerVolumeChange: (layer: Layer, volume: number) => void;
}

const formatVolume = (volume: number) => `${Math.round(volume * 100)}%`;

export default function VolumeMixer({
  layers,
  onLayerVolumeChange,
}: VolumeMixerProps) {
  return (
    <Box width="100%">
      <VStack align="stretch" gap={5}>
        {/* Layer volumes */}
        <Stack gap={4}>
          {layers.map((layer) => (
            <HStack key={layer.id} gap={4}>
              <Text minWidth="120px" fontSize="sm">
                {layer.label}
              </Text>

              <Slider.Root
                colorPalette="teal"
                value={[layer.volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChangeEnd={(details) => {
                  onLayerVolumeChange(layer, details.value[0] / 100);
                }}
                flex={1}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>

                  <Slider.Thumb index={0} />
                </Slider.Control>
              </Slider.Root>

              <Text
                width="45px"
                textAlign="right"
                fontSize="sm"
                fontVariantNumeric="tabular-nums"
              >
                {formatVolume(layer.volume)}
              </Text>
            </HStack>
          ))}
        </Stack>
      </VStack>
    </Box>
  );
}

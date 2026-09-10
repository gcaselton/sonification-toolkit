import {
  Box,
  HStack,
  Slider,
  Text,
  VStack,
  Separator,
  ScrollArea,
} from "@chakra-ui/react";
import { Layer } from "../../../types/layers";
import { Fragment } from "react";

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
    <Box py={4} width="100%" minW={0}>
      <ScrollArea.Root width="100%" minW={0}>
        <ScrollArea.Viewport>
          <ScrollArea.Content py={10}>
            <HStack
              gap={5}
              align="stretch"
              width="max-content"
              px={6}
              mx='auto'
            >
              {layers.map((layer, index) => (
                <Fragment key={layer.id}>
                  {index > 0 && <Separator orientation="vertical" />}
                  <VStack
                    gap={3}
                    borderRadius="lg"
                    py={5}
                    width="90px"
                    flexShrink={0}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color="fg.muted"
                      maxW="90px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {layer.label}
                    </Text>

                    <Slider.Root
                      aria-label={[layer.label + " volume"]}
                      orientation="vertical"
                      height="180px"
                      colorPalette="teal"
                      value={[Math.round(layer.volume * 100)]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(details) =>
                        onLayerVolumeChange(layer, details.value[0] / 100)
                      }
                    >
                      <Slider.Control>
                        <Slider.Track width="6px">
                          <Slider.Range />
                        </Slider.Track>
                        <Slider.Thumb index={0} shadow="sm" />
                      </Slider.Control>
                    </Slider.Root>

                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                      minW="3ch"
                      textAlign="center"
                    >
                      {formatVolume(layer.volume)}
                    </Text>
                  </VStack>
                </Fragment>
              ))}
            </HStack>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" />
        <ScrollArea.Corner />
      </ScrollArea.Root>
    </Box>
  );
}

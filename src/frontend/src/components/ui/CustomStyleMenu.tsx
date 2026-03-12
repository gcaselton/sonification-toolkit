import React, {
  useEffect,
  useState,
  createContext,
  ChangeEvent,
  useRef,
} from "react";
import { data, useLocation, useNavigate } from "react-router-dom";
import StyleCard from "../ui/StyleCard";
import { BackButton } from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import { ToggleTip, InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { apiUrl, lightCurvesAPI, coreAPI } from "../../apiConfig";
import { LuUpload, LuX, LuPlus } from "react-icons/lu";

import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Collapsible,
  Grid,
  GridItem,
  createListCollection,
  Dialog,
  FileUpload,
  Span,
  Heading,
  HStack,
  VStack,
  IconButton,
  Portal,
  Field,
  NumberInput,
  Link,
  LinkBox,
  LinkOverlay,
  SegmentGroup,
  Select,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { apiRequest } from "../../utils/requests";

interface CustomStyleMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soniType: string;
  dataRef: string;
  onStyleCreated: (styleRef: string) => void;
}

export default function CustomStyleMenu({
  open,
  onOpenChange,
  soniType,
  dataRef,
  onStyleCreated,
}: CustomStyleMenuProps) {

  interface BaseSound {
    name: string;
    composable: boolean;
    downloaded: boolean;
  }

  const defaultSound: BaseSound = {
    name: "Default Synth 🎹",
    composable: true,
    downloaded: true,
  };

  interface ParameterMapping {
    input: string;
    input_range: [number, number] | null;
    output: string;
    output_range: [number, number] | null;
    function: string | null;
  }

  interface ParamMetadata {
    name: string;
    desc: string;
    range: [number, number];
  }

  const [styleName, setStyleName] = useState("");
  const [styleDescription, setStyleDescription] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [sound, setSound] = useState<BaseSound>(defaultSound);
  const [parameterMappings, setParameterMappings] = useState<
    ParameterMapping[]
  >([]);

  const pitchMapped = parameterMappings.some(
    (m) => m.output.toLowerCase() === "pitch",
  );

  const [chordMode, setChordMode] = useState(false);
  const [rootNote, setRootNote] = useState("C");
  const [scale, setScale] = useState("None");
  const [quality, setQuality] = useState("maj");

  const [soundOptions, setSoundOptions] = useState(
    createListCollection<BaseSound & { label: string; value: string }>({
      items: [],
    }),
  );
  const [inputOptions, setInputOptions] = useState(
    createListCollection<{
      label: string;
      value: string;
      description: string;
    }>({
      items: [],
    }),
  );

  const [outputOptions, setOutputOptions] = useState(
    createListCollection<{
      label: string;
      value: string;
      description: string;
    }>({
      items: [],
    }),
  );

  const [applyLoading, setApplyLoading] = useState(false);
  const [loadingSounds, setLoadingSounds] = useState(true);
  const [loadingInputs, setLoadingInputs] = useState(true);
  const [loadingOutputs, setLoadingOutputs] = useState(true);
  const [loadingCustomPreview, setLoadingCustomPreview] = useState(false);
  const [autoMappedTime, setAutoMappedTime] = useState(false);

  const rootNoteOptions = createListCollection({
    items: [
      { label: "C", value: "C" },
      { label: "C#/Db", value: "C#" },
      { label: "D", value: "D" },
      { label: "D#/Eb", value: "D#" },
      { label: "E", value: "E" },
      { label: "F", value: "F" },
      { label: "F#/Gb", value: "F#" },
      { label: "G", value: "G" },
      { label: "G#/Ab", value: "G#" },
      { label: "A", value: "A" },
      { label: "A#/Bb", value: "A#" },
      { label: "B", value: "B" },
    ],
  });

  const scaleOptions = createListCollection({
    items: [
      { label: "None", value: "None" },
      { label: "Major", value: "major" },
      { label: "Harmonic Minor", value: "harmonic minor" },
      { label: "Pentatonic", value: "pentatonic minor" },
      { label: "Blues", value: "blues" },
      { label: "Chromatic", value: "chromatic" },
      { label: "Flamenco", value: "flamenco" },
      { label: "Romani", value: "romani" },
      { label: "Hirajoshi", value: "hijaroshi" },
      { label: "Persian", value: "persian" },
      { label: "Phrygian Dominant", value: "phrygian dominant" },
    ],
  });

  const qualityOptions = createListCollection({
    items: [
      { label: "Major", value: "maj" },
      { label: "Minor", value: "min" },
      { label: "Major 7", value: "maj7" },
      { label: "Major 9", value: "maj9" },
      { label: "5", value: "5" },
      { label: "6", value: "6" },
      { label: "7", value: "7" },
      { label: "9", value: "9" },
      { label: "Minor 7", value: "m7" },
      { label: "Minor 9", value: "m9" },
      { label: "Sus2", value: "sus2" },
      { label: "Sus4", value: "sus4" },
      { label: "7sus4", value: "7sus4" },
      { label: "Add9", value: "add9" },
      { label: "Minor Add9", value: "madd9" },
    ],
  });

  useEffect(() => {
    setLoadingInputs(true);
    setLoadingOutputs(true);

    const fetchParams = async () => {
      try {
        const [inputs, outputs] = await Promise.all([
          apiRequest(
            `${coreAPI}/get-inputs/?file_ref=${encodeURIComponent(dataRef)}`,
            {},
            "GET",
          ) as Promise<ParamMetadata[]>,
          apiRequest(`${coreAPI}/get-outputs/`, {}, "GET") as Promise<
            ParamMetadata[]
          >,
        ]);

        const inputItems = inputs.map((input) => ({
          label: input.name,
          value: input.name,
          description: input.desc,
        }));

        const outputItems = outputs.map((output) => ({
          label: output.name,
          value: output.name.toLowerCase(),
          description: output.desc,
        }));

        setInputOptions(createListCollection({ items: inputItems }));
        setOutputOptions(createListCollection({ items: outputItems }));

        // Auto-map time → time if both exist
        const hasTimeInput = inputItems.some(
          (i) => i.value.toLowerCase() === "time",
        );
        const hasTimeOutput = outputItems.some(
          (o) => o.value.toLowerCase() === "time",
        );

        if (hasTimeInput && hasTimeOutput) {
          setParameterMappings([
            {
              input: "Time",
              input_range: null,
              output: "time",
              output_range: null,
              function: null,
            },
          ]);

          setAutoMappedTime(true);
        }
      } catch (error) {
        console.error("Error fetching parameters:", error);
      } finally {
        setLoadingInputs(false);
        setLoadingOutputs(false);
      }
    };

    fetchParams();
  }, []);

  useEffect(() => {
    setLoadingSounds(true);

    const fetchSounds = async () => {
      try {
        const response = await fetch(`${coreAPI}/sound_info/`);

        if (!response.ok) {
          throw new Error("Failed to fetch sounds");
        }
        const soundsData: BaseSound[] = await response.json();

        const collection = createListCollection({
          items: soundsData.map((sound) => ({
            ...sound,
            label: `${sound.name}${sound.composable ? " 🎹" : ""}`, // Add piano emoji for composable sounds
            value: sound.name,
          })),
        });
        setSoundOptions(collection);
      } catch (error) {
        console.error("Error fetching sounds:", error);
      } finally {
        setLoadingSounds(false);
      }
    };

    fetchSounds();
  }, []);

  useEffect(() => {
    const hasTimeMapping = parameterMappings.some(
      (m) =>
        m.input.toLowerCase() === "time" && m.output.toLowerCase() === "time",
    );

    if (!hasTimeMapping) {
      setAutoMappedTime(false);
    }
  }, [parameterMappings]);
  

  const addMapping = () => {
    setParameterMappings((prev) => [
      ...prev,
      {
        input: "",
        input_range: null,
        output: "",
        output_range: null,
        function: null,
      },
    ]);
  };

  const removeMapping = (index: number) => {
    setParameterMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMapping = (
    index: number,
    field: keyof ParameterMapping,
    value: any,
  ) => {
    setParameterMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const saveSoundSettings = async () => {
    const url = `${coreAPI}/save-sound-settings/`;
    const data = {
      sound: sound.name.replace(/\s*🎹$/, ""),
      map: parameterMappings.map((m) => ({
        ...m,
        input: m.input.toLowerCase(),
        output: m.output.toLowerCase(),
      })),
      chordMode: chordMode,
      rootNote: rootNote,
      scale: scale,
      quality: quality,
    };

    const response = await apiRequest(url, data);

    return response.file_ref;
  };

  const handlePreviewStyle = async () => {
    try {
      setLoadingCustomPreview(true);

      // Wait for sound settings to save and get filepath
      const fileRef = await saveSoundSettings();
      console.log(fileRef);

      const preview_endpoint = `${coreAPI}/preview-style-settings/${soniType}`;

      const response = await apiRequest(preview_endpoint, {
        file_ref: fileRef,
      });

      const audioUrl = `${coreAPI}/audio/${response.file_ref}`;
      const preview = new Audio(audioUrl);
      preview.play();
      setLoadingCustomPreview(false);
    } catch (err) {
      console.error("Error previewing style settings:", err);
    }
  };

  const handleApply = async () => {
    setApplyLoading(true);

    const styleRef = await saveSoundSettings();
    
    onStyleCreated(styleRef);
    setApplyLoading(false);
  };

  return (
    <Dialog.Root
      open={open}
      placement="center"
      onOpenChange={(e) => onOpenChange(e.open)}
      size="lg"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh" overflow="hidden">
          <Dialog.Header>
            <Dialog.Title>Custom Style</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body overflowY="auto">
            <VStack gap={5} align="stretch">
              <Select.Root
                size="sm"
                collection={soundOptions}
                value={[sound.name]}
                onValueChange={(e) => {
                  const selected = soundOptions.items.find(
                    (s) => s.value === e.value[0],
                  );
                  if (selected) setSound(selected);
                }}
              >
                <Select.HiddenSelect />
                <HStack>
                  <Select.Label>Base Sound</Select.Label>
                  <InfoTip
                    content="This is the underlying sound (or instrument) that is used as a basis for the sonification"
                    positioning={{ placement: "right" }}
                  />
                </HStack>
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder={sound.name} />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content maxH="200px">
                      {soundOptions.items.map((option) => (
                        <Select.Item item={option} key={option.value}>
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>

              <VStack gap={4} align="stretch">
                <HStack>
                  <Text fontWeight="medium">Parameter Mappings</Text>
                  <InfoTip
                    content="Map input data variables to output sound properties"
                    positioning={{ placement: "right" }}
                  />
                </HStack>
                {autoMappedTime && (
                  <Alert.Root
                    status="info"
                    size="sm"
                    colorPalette="teal"
                    variant="subtle"
                    alignItems="center"
                    pb={1}
                    pt={1}
                  >
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        Automatically mapped Time to Time
                      </Alert.Description>
                    </Alert.Content>
                    <CloseButton
                      variant="subtle"
                      size="2xs"
                      my="auto"
                      onClick={() => setAutoMappedTime(false)}
                    />
                  </Alert.Root>
                )}
                {parameterMappings.map((mapping, index) => {
                  return (
                    <Card.Root key={index} variant="elevated" size="sm">
                      <Card.Body>
                        <VStack align="stretch" gap={3}>
                          {/* Input / Output row */}
                          <HStack align="flex-end">
                            <Field.Root>
                              <HStack>
                                <Field.Label>Input</Field.Label>
                                <InfoTip
                                  content="Choose the data variable to be sonified"
                                  positioning={{ placement: "right" }}
                                />
                              </HStack>
                              <Select.Root
                                collection={inputOptions}
                                value={mapping.input ? [mapping.input] : []}
                                onValueChange={(e) =>
                                  updateMapping(index, "input", e.value[0])
                                }
                                size="sm"
                              >
                                <Select.HiddenSelect />
                                <Select.Control>
                                  <Select.Trigger>
                                    <Select.ValueText placeholder="Select..." />
                                  </Select.Trigger>
                                  <Select.IndicatorGroup>
                                    <Select.Indicator />
                                  </Select.IndicatorGroup>
                                </Select.Control>
                                <Portal>
                                  <Select.Positioner>
                                    <Select.Content maxH='200px' overflowY='auto'>
                                      {inputOptions.items.map((option) => (
                                        <Select.Item
                                          item={option}
                                          key={option.value}
                                        >
                                          <Stack>
                                            <Select.ItemText>
                                              {option.label}
                                            </Select.ItemText>
                                            {option.description && (
                                              <Span
                                                color="fg.muted"
                                                textStyle="xs"
                                              >
                                                {option.description}
                                              </Span>
                                            )}
                                          </Stack>
                                          <Select.ItemIndicator />
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select.Positioner>
                                </Portal>
                              </Select.Root>
                            </Field.Root>

                            <Text pb={1} textStyle="xl">
                              →
                            </Text>

                            <Field.Root>
                              <HStack>
                                <Field.Label>Output</Field.Label>
                                <InfoTip
                                  content="Choose which sound property the input data will control"
                                  positioning={{ placement: "right" }}
                                />
                              </HStack>
                              <Select.Root
                                collection={outputOptions}
                                value={mapping.output ? [mapping.output] : []}
                                onValueChange={(e) =>
                                  updateMapping(index, "output", e.value[0])
                                }
                                size="sm"
                              >
                                <Select.HiddenSelect />
                                <Select.Control>
                                  <Select.Trigger>
                                    <Select.ValueText placeholder="Select..." />
                                  </Select.Trigger>
                                  <Select.IndicatorGroup>
                                    <Select.Indicator />
                                  </Select.IndicatorGroup>
                                </Select.Control>
                                <Portal>
                                  <Select.Positioner>
                                    <Select.Content>
                                      {outputOptions.items.map((option) => {
                                        const isUsedElsewhere =
                                          parameterMappings.some(
                                            (m, i) =>
                                              m.output === option.value &&
                                              i !== index,
                                          );

                                        return (
                                          <Select.Item
                                            item={{
                                              ...option,
                                              disabled: isUsedElsewhere,
                                            }}
                                            key={option.value}
                                          >
                                            <Stack gap="0">
                                              <Select.ItemText>
                                                {option.label}
                                              </Select.ItemText>
                                              {option.description && (
                                                <Span
                                                  color="fg.muted"
                                                  textStyle="xs"
                                                >
                                                  {option.description}
                                                </Span>
                                              )}
                                            </Stack>
                                            <Select.ItemIndicator />
                                          </Select.Item>
                                        );
                                      })}
                                    </Select.Content>
                                  </Select.Positioner>
                                </Portal>
                              </Select.Root>
                            </Field.Root>
                            <Tooltip content="Remove Mapping">
                              <IconButton
                                aria-label="Remove mapping"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMapping(index)}
                              >
                                <LuX />
                              </IconButton>
                            </Tooltip>
                          </HStack>

                          {/* Options — collapsible */}
                          <Collapsible.Root>
                            <Collapsible.Trigger>
                              <Collapsible.Context>
                                {({ open }) => (
                                  <Text
                                    fontSize="xs"
                                    color="teal.500"
                                    cursor="pointer"
                                  >
                                    {open ? "−" : "+"} Options
                                  </Text>
                                )}
                              </Collapsible.Context>
                            </Collapsible.Trigger>
                            <Collapsible.Content>
                              <VStack align="stretch" gap={5} mt={3}>
                                {/* Output range */}
                                <VStack align="flex-start" gap={1}>
                                  <HStack>
                                    <Text fontSize="xs" fontWeight="medium">
                                      Output Range
                                    </Text>
                                    <InfoTip
                                      content="Use this to adjust the limits of the output sound parameter. E.g. setting this at 0.3 - 1 on a Volume mapping would mean that the lowest data point would be played at 30% volume, instead of 0% volume."
                                      positioning={{ placement: "right" }}
                                      contentProps={{ maxW: "300px" }}
                                    />
                                  </HStack>
                                  <HStack gap={10}>
                                    <HStack>
                                      <NumberInput.Root
                                        value={
                                          mapping.output_range?.[0]?.toString() ??
                                          "0"
                                        }
                                        onValueChange={(e) =>
                                          updateMapping(index, "output_range", [
                                            Math.min(
                                              parseFloat(e.value),
                                              (mapping.output_range?.[1] ?? 1) -
                                                0.01,
                                            ),
                                            mapping.output_range?.[1] ?? 1,
                                          ])
                                        }
                                        min={0}
                                        max={
                                          (mapping.output_range?.[1] ?? 1) -
                                          0.01
                                        }
                                        step={0.1}
                                        size="sm"
                                        width="80px"
                                      >
                                        <NumberInput.Input placeholder="0" />
                                        <NumberInput.Control />
                                      </NumberInput.Root>
                                      <Text fontSize="sm">–</Text>
                                      <NumberInput.Root
                                        value={
                                          mapping.output_range?.[1]?.toString() ??
                                          "1"
                                        }
                                        onValueChange={(e) =>
                                          updateMapping(index, "output_range", [
                                            mapping.output_range?.[0] ?? 0,
                                            Math.max(
                                              parseFloat(e.value),
                                              (mapping.output_range?.[0] ?? 0) +
                                                0.01,
                                            ),
                                          ])
                                        }
                                        min={
                                          (mapping.output_range?.[0] ?? 0) +
                                          0.01
                                        }
                                        max={1}
                                        step={0.1}
                                        size="sm"
                                        width="80px"
                                      >
                                        <NumberInput.Input placeholder="1" />
                                        <NumberInput.Control />
                                      </NumberInput.Root>
                                    </HStack>

                                    <HStack>
                                      <Checkbox.Root
                                        checked={mapping.function === "invert"}
                                        onCheckedChange={(e) =>
                                          updateMapping(
                                            index,
                                            "function",
                                            e.checked ? "invert" : null,
                                          )
                                        }
                                        colorPalette="teal"
                                      >
                                        <Checkbox.HiddenInput />
                                        <Checkbox.Control />
                                        <Checkbox.Label>
                                          Invert data
                                        </Checkbox.Label>
                                      </Checkbox.Root>
                                      <InfoTip
                                        content="Reverses the direction of the input data, so that the biggest values become the smallest and vice versa. E.g. Magnitude increases as stars get dimmer, but it's usually useful to flip that relationship so that the sound parameter increases as stars get brighter."
                                        positioning={{ placement: "right" }}
                                        contentProps={{ maxW: "300px" }}
                                      />
                                    </HStack>
                                  </HStack>
                                </VStack>

                                {/* Invert */}
                              </VStack>
                            </Collapsible.Content>
                          </Collapsible.Root>
                        </VStack>
                      </Card.Body>
                    </Card.Root>
                  );
                })}

                <Button
                  variant="subtle"
                  colorPalette="teal"
                  size="sm"
                  onClick={addMapping}
                  alignSelf="flex-start"
                >
                  <LuPlus /> Add Mapping
                </Button>
              </VStack>
              {sound.composable && (
                <Collapsible.Root transition="opacity 0.3s ease-in-out">
                  <Collapsible.Trigger>
                    <Text
                      color="teal.600"
                      fontWeight="medium"
                      cursor="pointer"
                      mb={3}
                    >
                      <Span _hover={{ textDecoration: "underline" }}>
                        Musical Settings
                      </Span>{" "}
                      🎹
                    </Text>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <Switch.Root
                      checked={chordMode}
                      onCheckedChange={(e) => setChordMode(e.checked)}
                      mb={3}
                      colorPalette="teal"
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                      <HStack>
                        <Switch.Label>Chord Mode</Switch.Label>
                        <InfoTip
                          content="This determines whether a full chord is held, or a single note."
                          positioning={{ placement: "right" }}
                        />
                      </HStack>
                    </Switch.Root>
                    <Select.Root
                      collection={rootNoteOptions}
                      value={[rootNote]}
                      size="sm"
                      width="320px"
                      onValueChange={(e) => setRootNote(e.value[0])}
                      mb={3}
                    >
                      <Select.HiddenSelect />
                      <Select.Label>Root Note</Select.Label>
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder={rootNote} />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Portal>
                        <Select.Positioner>
                          <Select.Content>
                            {rootNoteOptions.items.map((option) => (
                              <Select.Item item={option} key={option.value}>
                                {option.label}
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Portal>
                    </Select.Root>
                    {!chordMode && (
                      <Tooltip
                        content="Pitch must be selected to use a scale."
                        openDelay={100}
                        closeDelay={100}
                        disabled={pitchMapped}
                      >
                        <Box>
                          <Select.Root
                            collection={scaleOptions}
                            size="sm"
                            width="320px"
                            value={[scale]}
                            onValueChange={(e) => setScale(e.value[0])}
                            mb={3}
                            disabled={!pitchMapped}
                          >
                            <Select.HiddenSelect />
                            <Select.Label>Scale</Select.Label>

                            <Select.Control>
                              <Select.Trigger>
                                <Select.ValueText placeholder={scale} />
                              </Select.Trigger>
                              <Select.IndicatorGroup>
                                <Select.Indicator />
                              </Select.IndicatorGroup>
                            </Select.Control>

                            <Portal>
                              <Select.Positioner>
                                <Select.Content>
                                  {scaleOptions.items.map((option) => (
                                    <Select.Item
                                      item={option}
                                      key={option.value}
                                    >
                                      {option.label}
                                      <Select.ItemIndicator />
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Positioner>
                            </Portal>
                          </Select.Root>
                        </Box>
                      </Tooltip>
                    )}
                    {chordMode && (
                      <Select.Root
                        collection={qualityOptions}
                        size="sm"
                        width="320px"
                        value={[quality]}
                        onValueChange={(e) => setQuality(e.value[0])}
                        mb={3}
                      >
                        <Select.HiddenSelect />
                        <Select.Label>Chord</Select.Label>
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder={"Major"} />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                          <Select.Positioner>
                            <Select.Content>
                              {qualityOptions.items.map((option) => (
                                <Select.Item item={option} key={option.value}>
                                  {option.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Portal>
                      </Select.Root>
                    )}
                  </Collapsible.Content>
                </Collapsible.Root>
              )}
            </VStack>
          </Dialog.Body>
          {parameterMappings.length === 0 && (
            <Text pb={2} fontSize="sm" color="fg.muted" textAlign="center">
              Add at least one parameter mapping to continue
            </Text>
          )}
          <Dialog.Footer display="flex" justifyContent="center">
            <Button
              width="30%"
              colorPalette="teal"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              loading={loadingCustomPreview}
              disabled={parameterMappings.length === 0}
              width="30%"
              colorPalette="teal"
              variant="outline"
              onClick={() => handlePreviewStyle()}
            >
              Preview
            </Button>
            <Button
              disabled={parameterMappings.length === 0}
              width="30%"
              colorPalette="teal"
              onClick={() => handleApply()}
            >
              Apply
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

import { useEffect, useState, useRef } from "react";
import { InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { composerAPI, coreAPI } from "../../apiConfig";
import {
  LuUpload,
  LuX,
  LuPlus,
  LuVolume2,
  LuDices,
  LuChartSpline,
  LuChartScatter,
} from "react-icons/lu";
import ErrorMsg from "../ui/ErrorMsg";

import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Collapsible,
  createListCollection,
  Dialog,
  FileUpload,
  Span,
  HStack,
  VStack,
  IconButton,
  Portal,
  Field,
  Slider,
  NumberInput,
  SegmentGroup,
  Select,
  Stack,
  TagsInput,
  Text,
} from "@chakra-ui/react";
import { apiRequest } from "../../utils/requests";
import { groupBy } from "es-toolkit";

interface CustomStyleMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soniType: string;
  dataRef: string;
  userUpload: boolean;
  onStyleCreated: (
    styleRef: string,
    styleName?: string,
    styleDescription?: string,
  ) => void;
  editStyle?: string;
}

export default function CustomStyleMenu({
  open,
  onOpenChange,
  soniType,
  dataRef,
  userUpload,
  onStyleCreated,
  editStyle,
}: CustomStyleMenuProps) {
  type DataMode = "continuous" | "discrete";

  interface BaseSound {
    name: string;
    composable: boolean;
    data_modes: DataMode[];
  }

  const defaultSound: BaseSound = {
    name: "Default Synth 🎹",
    composable: true,
    data_modes: ["discrete", "continuous"],
  };

  interface ParameterMapping {
    input: string;
    output: string;
    output_range: [number, number] | null;
    function: string | null;
  }

  interface ParamMetadata {
    name: string;
    desc: string;
    key: string;
    numeric?: boolean;
  }

  // Determine whether we need to force 'Discrete' data mode or not
  const isEvents = ["constellations", "night_sky"].includes(soniType);

  const [styleName, setStyleName] = useState("");
  const [styleDescription, setStyleDescription] = useState("");

  // Tracks whether we are currently auto-filling the fields from a user's style file
  const [autoFilling, setAutoFilling] = useState(!!editStyle);

  const [errorMessage, setErrorMessage] = useState("");

  const [dataMode, setDataMode] = useState<DataMode>(
    isEvents ? "discrete" : "continuous",
  );

  // All sounds fetched from backend
  const [allSounds, setAllSounds] = useState<BaseSound[]>([]);

  // The list of sounds to display depending on which data mode is selected
  const filteredSounds = allSounds.filter((sound) =>
    sound.data_modes.includes(dataMode),
  );

  // Display information for each sound
  const soundOptions = createListCollection({
    items: filteredSounds.map((sound) => ({
      ...sound,
      label: `${sound.name}${sound.composable ? " 🎹" : ""}`,
      value: sound.name,
    })),
  });

  // The selected sound
  const [sound, setSound] = useState<BaseSound>(defaultSound);

  // Swap the currently selected sound for a compatible one if data mode changes
  useEffect(() => {
    if (!filteredSounds.some((s) => s.name === sound.name)) {
      setSound(filteredSounds[0] ?? defaultSound);
    }
  }, [filteredSounds, sound]);

  const [parameterMappings, setParameterMappings] = useState<
    ParameterMapping[]
  >([]);

  const hasTimeMapping = parameterMappings.some(
    (m) => m.input && m.output.toLowerCase() === "time",
  );

  // used to auto-open a mapping's options if they have been edited
  const [openOptions, setOpenOptions] = useState<boolean[]>(
    parameterMappings.map(() => false),
  );

  const [rootNote, setRootNote] = useState("C");
  const [harmony, setHarmony] = useState("maj");
  const [notes, setNotes] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState(false); // Has the user manually edited notes?
  const [octaveRange, setOctaveRange] = useState<[number, number]>([3, 4]);

  const [inputOptions, setInputOptions] = useState(
    createListCollection<{
      label: string;
      value: string;
      description: string;
      key: string;
      numeric: boolean | undefined;
    }>({
      items: [],
    }),
  );

  const [outputOptions, setOutputOptions] = useState(
    createListCollection<{
      label: string;
      value: string;
      description: string;
      key: string;
    }>({
      items: [],
    }),
  );

  const [applyLoading, setApplyLoading] = useState(false);
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

  const harmonyItems = [
    // Chords
    { label: "Major Chord", value: "maj", category: "Chords" },
    { label: "Minor Chord", value: "min", category: "Chords" },
    { label: "Major 7", value: "maj7", category: "Chords" },
    { label: "Major 9", value: "maj9", category: "Chords" },
    { label: "5", value: "5", category: "Chords" },
    { label: "6", value: "6", category: "Chords" },
    { label: "7", value: "7", category: "Chords" },
    { label: "Minor 7", value: "m7", category: "Chords" },
    { label: "Minor 9", value: "m9", category: "Chords" },
    { label: "Sus2", value: "sus2", category: "Chords" },
    { label: "Sus4", value: "sus4", category: "Chords" },
    { label: "7sus4", value: "7sus4", category: "Chords" },
    { label: "Add9", value: "add9", category: "Chords" },

    // Scales
    { label: "Major Scale", value: "majorScale", category: "Scales" },
    { label: "Harmonic Minor", value: "harmonicMinor", category: "Scales" },
    { label: "Pentatonic", value: "pentatonic", category: "Scales" },
    { label: "Blues", value: "blues", category: "Scales" },
    { label: "Chromatic", value: "chromatic", category: "Scales" },
    { label: "Hirajoshi", value: "hirajoshi", category: "Scales" },
  ];

  const filteredHarmonyItems = harmonyItems.filter((item) => {
    // Only display chords if continuous data mode is selected
    if (dataMode === "continuous") {
      return item.category === "Chords";
    }

    return true; // discrete: show everything
  });

  const harmonyOptions = createListCollection({
    items: customNotes
      ? [
          ...filteredHarmonyItems,
          {
            label: "Custom",
            value: "custom",
            category: "Custom",
          },
        ]
      : filteredHarmonyItems,
  });

  // Swap the currently selected harmony for a compatible one if data mode changes
  useEffect(() => {
    if (!filteredHarmonyItems.some((item) => item.value === harmony)) {
      setHarmony(filteredHarmonyItems[0]?.value ?? "maj");
    }
  }, [filteredHarmonyItems, harmony]);

  const randomiseHarmony = () => {
    // Randomising switches back to generated notes
    setCustomNotes(false);

    // Filter out current root note
    const rootNotes = rootNoteOptions.items
      .map((item) => item.value)
      .filter((note) => note !== rootNote);

    // Filter out current harmony (and ignore custom)
    const harmonies = filteredHarmonyItems
      .map((item) => item.value)
      .filter((h) => h !== harmony);

    // Get randoms
    const randomRoot = rootNotes[Math.floor(Math.random() * rootNotes.length)];
    const randomHarmony =
      harmonies[Math.floor(Math.random() * harmonies.length)];

    setRootNote(randomRoot);
    setHarmony(randomHarmony);
  };

  const harmonyIntervals: Record<string, number[]> = {
    // Chords
    maj: [0, 4, 7],
    min: [0, 3, 7],
    maj7: [0, 4, 7, 11],
    maj9: [0, 4, 7, 11, 14],
    "5": [0, 7],
    "6": [0, 4, 7, 9],
    "7": [0, 4, 7, 10],
    m7: [0, 3, 7, 10],
    m9: [0, 3, 7, 10, 14],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    "7sus4": [0, 5, 7, 10],
    add9: [0, 4, 7, 14],

    // Scales
    majorScale: [0, 2, 4, 5, 7, 9, 11],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    pentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    hirajoshi: [0, 2, 3, 7, 8],
  };

  const harmonyCategories = Object.entries(
    groupBy(harmonyOptions.items, (item) => item.category),
  );

  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  const generateNotes = (): string[] => {
    setCustomNotes(false);
    let notes: string[] = [];

    const rootIndex = noteNames.indexOf(rootNote);
    const [lowOctave, highOctave] = octaveRange;

    for (let octave = lowOctave; octave < highOctave; octave++) {
      for (const interval of harmonyIntervals[harmony]) {
        const noteIndex = (rootIndex + interval) % 12;
        const octaveOffset = Math.floor((rootIndex + interval) / 12);

        const note = `${noteNames[noteIndex]}${octave + octaveOffset}`;
        notes.push(note);
      }
    }

    // Finally, add root note from upper octave range to complete the set
    notes.push(`${rootNote}${highOctave}`);

    return notes;
  };

  const isValidNote = (input: string): boolean => {
    const note = input.trim();
    return /^[A-Ga-g](#|b)?[1-6]$/.test(note);
  };

  const normaliseNote = (note: string): string =>
    note
      .trim()
      .replace(
        /^([a-g])([#b]?)(\d)$/,
        (_, letter, accidental, octave) =>
          `${letter.toUpperCase()}${accidental}${octave}`,
      );

  const octaveSliderMarks = [
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 5, label: "5" },
    { value: 6, label: "6" },
  ];

  // Update the notes displayed any time root, harmony, or octaveRange changes (ignore if auto-populating fields)
  useEffect(() => {
    if (!autoFilling) setNotes(generateNotes());
  }, [rootNote, harmony, octaveRange]);

  // Get input and output options on first load
  useEffect(() => {
    const fetchParams = async () => {
      try {
        const [inputs, outputs] = await Promise.all([
          apiRequest(
            `${coreAPI}/get-inputs/?file_ref=${encodeURIComponent(dataRef)}&soni_type=${soniType}&user_upload=${userUpload}`,
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
          key: input.key,
          numeric: input.numeric,
        }));

        const outputItems = outputs.map((output) => ({
          label: output.name,
          value: output.name,
          description: output.desc,
          key: output.key,
        }));

        // Disable inputs with non-numeric data
        setInputOptions(
          createListCollection({
            items: inputItems,
            isItemDisabled: (item) => item.numeric === false,
          }),
        );
        setOutputOptions(createListCollection({ items: outputItems }));

        // Auto-map time → time if both exist (case-insensitive)
        const timeInput = inputItems.find(
          (i) => i.value.toLowerCase() === "time" || i.value === "Custom Order",
        );

        const timeOutput = outputItems.find(
          (o) => o.value.toLowerCase() === "time",
        );

        if (timeInput && timeOutput) {
          setParameterMappings([
            {
              input: timeInput.value,
              output: timeOutput.value,
              output_range: null,
              function: null,
            },
          ]);

          setAutoMappedTime(true);
        }
      } catch (error) {
        console.error("Error fetching parameters:", error);
      }
    };

    fetchParams();
  }, []);

  // Fetch sound options from backend on first load
  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const response = await fetch(`${coreAPI}/sound_info/`);

        if (!response.ok) {
          throw new Error("Failed to fetch sounds");
        }

        const soundsData: BaseSound[] = await response.json();
        setAllSounds(soundsData);
      } catch (error) {
        console.error("Error fetching sounds:", error);
      }
    };

    fetchSounds();
  }, []);

  const addMapping = () => {
    setParameterMappings((prev) => [
      ...prev,
      {
        input: "",
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

  interface StyleMetadata {
    /* This metadata is used to re-populate some of the custom style menu fields
  if users want to edit a given style.  We store the original parameter names
  (before formatting/swapping with STRAUSS param names), whether a custom note
  set has been used, and if not, the root note, harmony, and octave range. */
    mappingParams: { input: string; output: string }[];
    customNotes: boolean;
    rootNote?: string;
    harmony?: string;
    octaveRange?: [number, number];
  }

  interface StyleSettings {
    dataMode: DataMode;
    sound: string;
    map: ParameterMapping[];
    notes: string[];
    metadata: StyleMetadata;
  }

  const saveStyleSettings = async () => {
    const url = `${coreAPI}/save-style-settings/`;

    const cleanedMappings = parameterMappings.filter(
      (m) => m.input.trim() !== "" && m.output.trim() !== "",
    ); // remove empty mappings

    const metadata: StyleMetadata = {
      mappingParams: cleanedMappings.map((m) => ({
        input: m.input,
        output: m.output,
      })),
      customNotes,
      ...(customNotes
        ? {}
        : {
            rootNote, // Only include these if customNotes is false
            harmony,
            octaveRange,
          }),
    };

    console.log(metadata);

    const settings: StyleSettings = {
      dataMode,
      sound: sound.name.replace(/\s*🎹$/, ""),
      map: cleanedMappings.map((m) => ({
        ...m,
        input:
          inputOptions.items.find((i) => i.value === m.input)?.key ??
          m.input.toLowerCase(),
        output:
          outputOptions.items.find((o) => o.value === m.output)?.key ??
          m.output.toLowerCase(),
      })),
      notes: sound.composable ? notes : ["A3"], // Use A3 as the note for non-composable sounds
      metadata: metadata,
    };

    const response = await apiRequest(url, settings);

    return response.file_ref;
  };

  const previewRef = useRef<HTMLAudioElement | null>(null);

  const handlePreviewStyle = async () => {
    try {
      setLoadingCustomPreview(true);
      setErrorMessage("");

      // Stop any previous audio
      if (previewRef.current) {
        previewRef.current.pause();
        previewRef.current.currentTime = 0;
      }

      // Save sound settings and get filepath
      const fileRef = await saveStyleSettings();

      const preview_endpoint = `${coreAPI}/preview-style-settings/`;
      const response = await apiRequest(preview_endpoint, {
        file_ref: fileRef,
      });

      const audioUrl = `${coreAPI}/audio/${response.file_ref}?name=preview`;
      const preview = new Audio(audioUrl);

      // Save this audio instance so we can stop it next time
      previewRef.current = preview;
      preview.play();
    } catch (err) {
      setErrorMessage(
        "Error generating preview. Please try different style settings.",
      );
      console.error("Error previewing style settings:", err);
    } finally {
      setLoadingCustomPreview(false);
    }
  };

  // Stop any previews playing if menu is closed
  useEffect(() => {
    if (!open && previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
      previewRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!editStyle || allSounds.length === 0) return;

    const convertStyleToSettings = async (styleRef: string) => {
      setAutoFilling(true);

      try {
        const endpoint = `${coreAPI}/convert-style-to-settings/`;
        const payload = { file_ref: styleRef };

        const response = await apiRequest(endpoint, payload);

        setDataMode(response.data_mode);

        const baseSound = allSounds.find((s) => s.name === response.sound_name);
        if (baseSound) {
          setSound(baseSound);
        }

        const mappings: ParameterMapping[] = response.map.map(
          (mapping: ParameterMapping, index: number) => ({
            ...mapping,
            input: response.metadata.mappingParams[index].input,
            output: response.metadata.mappingParams[index].output,
            output_range:
              mapping.output === "pitch_shift" && mapping.output_range
              // convert pitch_shift range back from 0-24 to 0-1
                ? mapping.output_range.map((lim) => Math.round((lim / 24) * 100) / 100)
                : mapping.output_range,
          }),
        );

        setParameterMappings(mappings);

        setOpenOptions(
          mappings.map(
            (mapping) =>
              mapping.function === "invert" ||
              (mapping.output_range?.[0] ?? 0) !== 0 ||
              (mapping.output_range?.[1] ?? 1) !== 1,
          ),
        );

        setNotes(response.notes);

        const custom = !!response.metadata.customNotes;
        setCustomNotes(custom);

        if (!custom) {
          setRootNote(response.metadata.rootNote);
          setHarmony(response.metadata.harmony);
          setOctaveRange(response.metadata.octaveRange);
        }
      } finally {
        setAutoFilling(false);
      }
    };

    convertStyleToSettings(editStyle);
  }, [editStyle, allSounds]);

  const handleUploadStyle = async (files: File[]) => {
    setErrorMessage("");

    const file = files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${coreAPI}/upload-style/`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Style upload failed:", errorData?.detail);
      return;
    }

    const result = await res.json();

    const isValid = await validateUploadedStyle(result.file_ref);

    if (isValid) {
      onStyleCreated(
        result.file_ref,
        result.style_name,
        result.style_description,
      );
    }
  };

  const validateUploadedStyle = async (styleRef: string): Promise<boolean> => {
    const endpoint = `${composerAPI}/validate-layer/`;
    const payload = { data_ref: dataRef, style_ref: styleRef };

    const response = await apiRequest(endpoint, payload);
    const missing: string[] = response.missing_columns;

    if (missing.length > 0) {
      const multiple = missing.length > 1;

      const msg = `This style is not compatible with your chosen dataset. It requires the ${missing.join(
        ", ",
      )} column${multiple ? "s" : ""}, which ${
        multiple ? "are" : "is"
      } not available in your data. The style may have been created for a different type of data, 
      such as light curves, constellations, or night sky.`;

      setErrorMessage(msg);
      return false;
    }
    return true;
  };

  const handleNotesChange = (newNotes: string[]) => {
    // Capitalize notes and remove whitespace
    const normalised = newNotes.map(normaliseNote);
    setNotes(normalised);
    setCustomNotes(true);
  };

  const handleApply = async () => {
    setApplyLoading(true);

    const styleRef = await saveStyleSettings();

    // Stop any preview audio
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
      previewRef.current = null;
    }

    onStyleCreated(styleRef);
    setApplyLoading(false);
  };

  // Round to 2 decimal places
  const round2 = (n: number) => Math.round(n * 100) / 100;

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
              <HStack align="center" gap={4}>
                <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                  Have a Style File?
                </Text>
                <FileUpload.Root
                  accept={{ "*/*": [".yaml", ".yml"] }}
                  maxFiles={1}
                  maxFileSize={1 * 1024 * 1024} // 1MB file limit
                  onFileAccept={({ files }) => handleUploadStyle(files)}
                  onFileReject={(details) => {
                    setErrorMessage(
                      `File rejected: ${details.files[0].errors.join(", ")}`,
                    );
                  }}
                >
                  <FileUpload.HiddenInput />
                  <FileUpload.Trigger asChild>
                    <Button
                      size="xs"
                      variant="subtle"
                      colorPalette="teal"
                      aria-label="Upload style file"
                    >
                      <LuUpload /> Upload
                    </Button>
                  </FileUpload.Trigger>
                </FileUpload.Root>
              </HStack>

              <VStack gap={4} align="stretch">
                <HStack>
                  <Text fontWeight="medium">Parameter Mappings</Text>
                  <InfoTip
                    portalled={false}
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
                        Automatically mapped Time
                      </Alert.Description>
                    </Alert.Content>
                    <CloseButton
                      aria-label="close help tag"
                      variant="subtle"
                      size="2xs"
                      my="auto"
                      onClick={() => setAutoMappedTime(false)}
                    />
                  </Alert.Root>
                )}
                {parameterMappings.map((mapping, index) => {
                  const isCustomOrder =
                    mapping.input === "Custom Order" &&
                    mapping.output === "Time" &&
                    autoMappedTime;

                  // Used to disable output range for Azimuth and Polar (not allowed in STRAUSS)
                  const isSpatial = ["Azimuth", "Polar Angle"].includes(
                    mapping.output,
                  );

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
                                  portalled={false}
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
                                positioning={{
                                  strategy: "fixed",
                                  hideWhenDetached: true,
                                  sameWidth: true,
                                }}
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
                                <Select.Positioner>
                                  <Select.Content maxH="200px" overflowY="auto">
                                    {inputOptions.items.map((option) => {
                                      const disabled = option.numeric === false;
                                      const item = (
                                        <Select.Item
                                          item={option}
                                          key={option.value}
                                          _disabled={{
                                            opacity: 0.4,
                                            cursor: "not-allowed",
                                            pointerEvents: "auto",
                                          }}
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
                                      );

                                      return (
                                        <Tooltip
                                          openDelay={200}
                                          key={option.value}
                                          disabled={!disabled}
                                          content="This column contains non-numeric data"
                                        >
                                          {item}
                                        </Tooltip>
                                      );
                                    })}
                                  </Select.Content>
                                </Select.Positioner>
                              </Select.Root>
                            </Field.Root>

                            <Text pb={1} textStyle="xl">
                              →
                            </Text>

                            <Field.Root>
                              <HStack>
                                <Field.Label>Output</Field.Label>
                                <InfoTip
                                  portalled={true}
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
                                positioning={{
                                  strategy: "fixed",
                                  hideWhenDetached: true,
                                  sameWidth: true,
                                }}
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
                                <Select.Positioner>
                                  <Select.Content maxH="200px" overflowY="auto">
                                    {outputOptions.items.map((option) => {
                                      const selectedOutputs = parameterMappings
                                        .filter((_, i) => i !== index)
                                        .map((m) => m.output);

                                      // Disable outputs that are already selected
                                      const isUsedElsewhere =
                                        selectedOutputs.includes(option.value);

                                      // Disable 'pan' if Azimuth is selected and vice versa (both spatial parameters)
                                      const isSpatialConflict =
                                        (option.value === "Pan" &&
                                          selectedOutputs.includes(
                                            "Azimuth",
                                          )) ||
                                        (option.value === "Azimuth" &&
                                          selectedOutputs.includes("Pan"));

                                      return (
                                        <Select.Item
                                          item={{
                                            ...option,
                                            disabled:
                                              isUsedElsewhere ||
                                              isSpatialConflict,
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
                          <Collapsible.Root
                            hidden={isCustomOrder} // Disable options for custom constellation order
                            open={openOptions[index]}
                            onOpenChange={(e) => {
                              setOpenOptions((prev) => {
                                const next = [...prev];
                                next[index] = e.open;
                                return next;
                              });
                            }}
                          >
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
                                      {mapping.output} Range
                                    </Text>
                                    <InfoTip
                                      portalled={false}
                                      content="Use this to adjust the limits of the output sound parameter. E.g. setting this at 0.3 - 1 on a Volume mapping would mean that the lowest data point would be played at 30% volume, instead of 0% volume."
                                      positioning={{ placement: "right" }}
                                      contentProps={{ maxW: "300px" }}
                                    />
                                  </HStack>
                                  <HStack gap={8}>
                                    <Tooltip
                                      content="Range is not supported for spatial parameters"
                                      disabled={!isSpatial}
                                    >
                                      <HStack>
                                        <NumberInput.Root
                                          disabled={isSpatial}
                                          aria-label={`${mapping.output} range minimum`}
                                          value={
                                            mapping.output_range?.[0]?.toString() ??
                                            "0"
                                          }
                                          onValueChange={(e) => {
                                            const n = parseFloat(e.value);
                                            if (Number.isNaN(n)) return; // don't commit while the field is empty/mid-edit
                                            updateMapping(
                                              index,
                                              "output_range",
                                              [
                                                round2(
                                                  Math.min(
                                                    n,
                                                    (mapping
                                                      .output_range?.[1] ?? 1) -
                                                      0.01,
                                                  ),
                                                ),
                                                mapping.output_range?.[1] ?? 1,
                                              ],
                                            );
                                          }}
                                          min={0}
                                          max={
                                            (mapping.output_range?.[1] ?? 1) -
                                            0.01
                                          }
                                          size="sm"
                                          width="80px"
                                        >
                                          <NumberInput.Input
                                            placeholder="0"
                                            aria-valuetext={`${mapping.output_range?.[0] ?? 0}`}
                                          />
                                        </NumberInput.Root>
                                        <Text fontSize="sm">–</Text>
                                        <NumberInput.Root
                                          disabled={isSpatial}
                                          aria-label={`${mapping.output} range maximum`}
                                          value={
                                            mapping.output_range?.[1]?.toString() ??
                                            "1"
                                          }
                                          onValueChange={(e) => {
                                            const n = parseFloat(e.value);
                                            if (Number.isNaN(n)) return;
                                            updateMapping(
                                              index,
                                              "output_range",
                                              [
                                                mapping.output_range?.[0] ?? 0,
                                                round2(
                                                  Math.max(
                                                    n,
                                                    (mapping
                                                      .output_range?.[0] ?? 0) +
                                                      0.01,
                                                  ),
                                                ),
                                              ],
                                            );
                                          }}
                                          min={
                                            (mapping.output_range?.[0] ?? 0) +
                                            0.01
                                          }
                                          max={1}
                                          size="sm"
                                          width="80px"
                                        >
                                          <NumberInput.Input
                                            placeholder="1"
                                            aria-valuetext={`${mapping.output_range?.[1] ?? 1}`}
                                          />
                                        </NumberInput.Root>
                                      </HStack>
                                    </Tooltip>

                                    {/* Invert */}
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
                                        portalled={false}
                                        content="Reverses the direction of the input data, so that the biggest values become the smallest and vice versa. E.g. Magnitude increases as stars get dimmer, but it's usually useful to flip that relationship so that the sound parameter increases as stars get brighter."
                                        positioning={{ placement: "right" }}
                                        contentProps={{ maxW: "300px" }}
                                      />
                                    </HStack>
                                  </HStack>
                                </VStack>
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

              <Field.Root>
                <HStack>
                  <Field.Label>Data Mode</Field.Label>
                  <InfoTip
                    portalled={false}
                    content="Choose whether the data should be heard as a continuous stream or as individual discrete events."
                    positioning={{ placement: "right" }}
                    contentProps={{ maxW: "300px" }}
                  />
                </HStack>
                <SegmentGroup.Root
                  disabled={isEvents}
                  value={dataMode}
                  onValueChange={(e) =>
                    setDataMode(e.value as "continuous" | "discrete")
                  }
                  size="sm"
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items
                    items={[
                      {
                        label: (
                          <HStack>
                            <LuChartSpline />
                            Continuous
                          </HStack>
                        ),
                        value: "continuous",
                      },
                      {
                        label: (
                          <HStack>
                            <LuChartScatter />
                            Discrete
                          </HStack>
                        ),
                        value: "discrete",
                      },
                    ]}
                  />
                </SegmentGroup.Root>
              </Field.Root>

              <Select.Root
                size="sm"
                positioning={{
                  strategy: "fixed",
                  hideWhenDetached: true,
                  sameWidth: true,
                }}
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
                    portalled={false}
                    content="This is the underlying sound (or instrument) that is used as a basis for the sonification. Sounds with a 🎹 icon next to them are composable, meaning you can apply musical settings like chords and scales."
                    positioning={{ placement: "right" }}
                    contentProps={{ maxW: "300px" }}
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
              </Select.Root>

              {sound.composable && (
                <>
                  <HStack gap={5}>
                    <Select.Root
                      collection={rootNoteOptions}
                      value={[rootNote]}
                      size="sm"
                      positioning={{
                        strategy: "fixed",
                        hideWhenDetached: true,
                        sameWidth: true,
                      }}
                      onValueChange={(e) => {
                        setRootNote(e.value[0]);
                      }}
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
                      <Select.Positioner>
                        <Select.Content maxH="200px">
                          {rootNoteOptions.items.map((option) => (
                            <Select.Item item={option} key={option.value}>
                              {option.label}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>

                    <Select.Root
                      collection={harmonyOptions}
                      size="sm"
                      positioning={{
                        strategy: "fixed",
                        hideWhenDetached: true,
                        sameWidth: true,
                      }}
                      value={[customNotes ? "custom" : harmony]}
                      onValueChange={(e) => {
                        const value = e.value[0];
                        if (value === "custom") return;
                        setCustomNotes(false);
                        setHarmony(value);
                      }}
                    >
                      <Select.HiddenSelect />
                      <Select.Label>Harmony</Select.Label>
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder={"Major"} />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content maxH="200px">
                          {harmonyCategories.map(([category, items]) => (
                            <Select.ItemGroup key={category}>
                              <Select.ItemGroupLabel
                                fontWeight="bold"
                                fontSize="xs"
                                color="teal.500"
                                textTransform="uppercase"
                                letterSpacing="widest"
                                pt={2}
                                pb={1}
                              >
                                {category}
                              </Select.ItemGroupLabel>
                              {items.map((item) => (
                                <Select.Item item={item} key={item.value}>
                                  {item.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.ItemGroup>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                    <Tooltip content="Randomise harmony">
                      <IconButton
                        aria-label="Randomise"
                        colorPalette="teal"
                        size="sm"
                        variant="subtle"
                        alignSelf="end"
                        onClick={randomiseHarmony}
                      >
                        <LuDices />
                      </IconButton>
                    </Tooltip>
                  </HStack>
                  <Field.Root>
                    <TagsInput.Root
                      editable
                      validate={(e) => isValidNote(e.inputValue)}
                      maxLength={3}
                      value={notes}
                      onValueChange={(details) => {
                        handleNotesChange(details.value);
                      }}
                      colorPalette="teal"
                    >
                      <TagsInput.Label>Notes</TagsInput.Label>
                      <TagsInput.Control>
                        <TagsInput.Items />
                        <TagsInput.Input placeholder="Add or edit notes..." />
                      </TagsInput.Control>
                    </TagsInput.Root>
                    {/* <Field.HelperText>
                      Double-click on a note or use keyboard navigation to edit
                    </Field.HelperText> */}
                  </Field.Root>
                  <Slider.Root
                    size="sm"
                    step={1}
                    colorPalette="teal"
                    min={1}
                    max={6}
                    value={octaveRange}
                    minStepsBetweenThumbs={0}
                    thumbCollisionBehavior="push"
                    onValueChange={(e) => {
                      setOctaveRange(e.value as [number, number]);
                    }}
                  >
                    <Slider.Label>Octave Range</Slider.Label>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Range />
                      </Slider.Track>
                      <Slider.Thumbs />
                      <Slider.Marks marks={octaveSliderMarks} />
                    </Slider.Control>
                  </Slider.Root>
                </>
              )}
            </VStack>
          </Dialog.Body>
          {!hasTimeMapping && (
            <Text
              pb={2}
              pt={2}
              fontSize="sm"
              color="fg.muted"
              textAlign="center"
            >
              One parameter must be mapped to <strong>Time</strong> to continue.
            </Text>
          )}
          {errorMessage && (
            <HStack px="5">
              <ErrorMsg
                message={errorMessage}
                onClose={() => setErrorMessage("")}
              />
            </HStack>
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
              disabled={!hasTimeMapping}
              width="30%"
              colorPalette="teal"
              variant="outline"
              onClick={() => handlePreviewStyle()}
            >
              <HStack gap={3}>
                <LuVolume2 />
                Preview
              </HStack>
            </Button>
            <Button
              disabled={!hasTimeMapping}
              width="30%"
              colorPalette="teal"
              onClick={() => handleApply()}
              loading={applyLoading}
            >
              Apply
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

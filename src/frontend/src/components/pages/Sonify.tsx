import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LoadingMessage from "../ui/LoadingMessage";
import { BackButton } from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import ErrorMsg from "../ui/ErrorMsg";
import {
  apiUrl,
  lightCurvesAPI,
  coreAPI,
  constellationsAPI,
  nightSkyAPI,
} from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import {
  Box,
  ActionBar,
  Button,
  createListCollection,
  Checkbox,
  CloseButton,
  DataList,
  Dialog,
  Field,
  Heading,
  IconButton,
  Image,
  Tag,
  Input,
  Text,
  Flex,
  Portal,
  NumberInput,
  Separator,
  VStack,
  Select,
  HStack,
} from "@chakra-ui/react";
import { LuAudioLines, LuDownload, LuLocateFixed } from "react-icons/lu";
import { plotData } from "../../utils/plot";
import ObserverSetup, { ObserverValues, ORIENTATIONS } from "../utils/ObserverSetup";

export default function Sonify() {

  // Route states
  const location = useLocation();
  const dataName = location.state.dataName;
  const dataRef = location.state.dataRef;
  const styleName = location.state.styleName;
  const styleDescription = location.state.styleDescription;
  const styleRef = location.state.styleRef;
  const soniType = location.state.soniType;
  const ra = location.state.ra ?? null;
  const dec = location.state.dec ?? null;

  console.log('Ra: ' + ra)
  console.log('Dec: ' + dec)

  // Define length limits based on sonification type
  const defaultsDict = {
    light_curves: { max_length: 60, default_length: 15, audio_system: "mono" },
    constellations: {
      max_length: 120,
      default_length: 15,
      audio_system: "stereo",
    },
    night_sky: { max_length: 120, default_length: 30, audio_system: "stereo" },
  };

  const defaults = defaultsDict[soniType as keyof typeof defaultsDict];

  // states
  const [length, setLength] = useState(defaults.default_length.toString());
  const [audioSystem, setAudioSystem] = useState<string[]>([
    defaults.audio_system,
  ]);
  const [audioFilename, setAudioFilename] = useState("");
  const [soniReady, setSoniReady] = useState(false);
  const [soniClicked, setSoniClicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [daysPerSec, setDaysPerSec] = useState("");
  const [totalDays, setTotalDays] = useState<number>(0);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // Tracks audio files to prevent caching
  const [audioKey, setAudioKey] = useState('');

  const [observerOpen, setObserverOpen] = useState(false);
  const [observerValues, setObserverValues] = useState<ObserverValues | null>(null);

  // Generate the plot once when component mounts
  useEffect(() => {
    async function fetchPlot() {
      try {
        const imageBase64 = await plotData(dataRef, soniType);

        setImageSrc(`data:image/svg+xml;base64,${imageBase64}`);
      } catch (error) {
        console.error("Error generating plot:", error);
      } finally {
        setImageLoading(false);
      }
    }
    fetchPlot();
  }, [dataRef]);

  // Fetch data range once on load for lightcurves
  useEffect(() => {
    if (soniType != "light_curves") {
      return;
    }

    const fetchDataRange = async () => {
      const url_range = `${lightCurvesAPI}/get-range/`;
      const data = {
        file_ref: dataRef,
      };
      try {
        const response = await apiRequest(url_range, data, "POST");
        const dataRange = response.range;
        const days = dataRange[1] - dataRange[0];
        setTotalDays(days);
        const rounded = Number(days / Number(length)).toFixed(1);
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
    setErrorMessage("");

    const url = `${coreAPI}/generate-sonification/`;

    const data = {
      category: soniType,
      data_ref: dataRef,
      style_ref: styleRef,
      duration: length,
      system: audioSystem[0],
      data_name: dataName,
      observer: observerValues
        ? {
            latitude: observerValues.latitude,
            longitude: observerValues.longitude,
            orientation: observerValues.orientation,
            date_time: observerValues.dateTime,
            ra,
            dec,
          }
        : null,
    };

    console.log(data);

    try {
      const response = await apiRequest(url, data);
      console.log("Sonification result:", response);
      return response.file_ref;
    } catch (error) {
      setErrorMessage(
        "Error generating sonification. Please try again with different Style settings.",
      );
      console.error("Error fetching sonification:", error);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSoniClicked(true);
    setSoniReady(false);
    setLoading(true);

    requestSonification().then((fileRef) => {
      setLoading(false);
      if (fileRef) {
        console.log("Sonification file created:", fileRef);
        setAudioKey(Date.now().toString());
        setAudioFilename(`${fileRef}`);
        setSoniReady(true);
      } else {
        console.error("No sonification file returned.");
      }
    });
  };

  const handleLengthChange = (value: string) => {
    setLength(value);
    if (totalDays > 0 && value) {
      const rounded = Number(totalDays / Number(value)).toFixed(2);
      setDaysPerSec(rounded);
    }
  };

  const handleDaysPerSecChange = (value: string) => {
    setDaysPerSec(value);
    const floatValue = parseFloat(value);

    if (totalDays > 0 && floatValue > 0) {
      const rounded = Number(totalDays / floatValue).toFixed(2);
      setLength(rounded);
    }
  };

  const handlePlaceOnDome = async (values: ObserverValues) => {
    setObserverValues(values);
    setObserverOpen(false);
  };

  const invalidLength =
    Number(length) > defaults.max_length ||
    length === "0" ||
    length.includes("-");

  function formatSoniType(value: string) {
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toLowerCase())
      .replace(/s$/, "");
  }

  const summaryItems = [
    { label: "Description", value: styleDescription, downloadable: false},
    { label: "Data", value: dataName, downloadable: true, fileRef: dataRef },
    { label: "Style", value: styleName, downloadable: true, fileRef: styleRef }
  ];

  const COMPASS = Object.fromEntries(
    ORIENTATIONS.map(({ value, label }) => [value, label]),
  );

  return (
    <PageContainer>
      <Box position="relative" as="main" role="main">
        <Heading as="h1">Step 3: Sonify</Heading>
        <br />
        <Text textStyle="lg">
          Set the length of the sonification and specify the audio system you
          intend to play it on
        </Text>
        <br />
        <HStack gap="4" align="start" justify="center">
          <Box width="50%">
            <form onSubmit={handleSubmit}>
              <VStack align="start" justify="center" w="80%" gap={8}>
                <HStack gap={10}>
                  <Field.Root invalid={invalidLength} width="auto">
                    <Field.Label>Duration (seconds)</Field.Label>
                    <NumberInput.Root
                      value={length}
                      onValueChange={(e) => handleLengthChange(e.value)}
                      inputMode="decimal"
                      step={1}
                      min={1}
                      max={defaults.max_length}
                    >
                      <NumberInput.Control />
                      <NumberInput.Input />
                    </NumberInput.Root>
                    <Field.ErrorText>
                      Please enter a number up to {defaults.max_length} seconds.
                    </Field.ErrorText>
                  </Field.Root>
                  {soniType === "light_curves" && (
                    <>
                      <Text textStyle="2xl" height="0.5">
                        =
                      </Text>
                      <Field.Root width="auto">
                        <Field.Label>Days per Second</Field.Label>
                        <NumberInput.Root
                          value={String(daysPerSec)}
                          onValueChange={(e) => {
                            handleDaysPerSecChange(e.value);
                          }}
                          inputMode="decimal"
                          min={0}
                          max={totalDays}
                        >
                          <NumberInput.Control />
                          <NumberInput.Input />
                        </NumberInput.Root>
                      </Field.Root>
                    </>
                  )}
                </HStack>

                {/* Audio system options */}
                <HStack alignItems="flex-end" w="100%">
                  <Select.Root
                    collection={audioSystemOptions}
                    value={audioSystem}
                    onValueChange={(e) => setAudioSystem(e.value)}
                    minW="50%"
                  >
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
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          {audioSystemOptions.items.map((option) => (
                            <Select.Item item={option} key={option.value}>
                              {option.label}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                  </Select.Root>
                  {soniType !== "night_sky" && ra && dec && (
                    <Button
                      colorPalette="teal"
                      variant={observerValues ? "solid" : "subtle"}
                      disabled={audioSystem[0] == "mono"}
                      onClick={() => setObserverOpen(true)}
                    >
                      <LuLocateFixed />
                      Place on Dome
                    </Button>
                  )}
                </HStack>

                {observerValues && (
                  <Tag.Root colorPalette="teal" size="md">
                    <Tag.Label>
                      {observerValues.locationName}, facing{" "}
                      {COMPASS[observerValues.orientation]}
                    </Tag.Label>
                    <Tag.EndElement>
                      <Tag.CloseTrigger
                        onClick={() => setObserverValues(null)}
                      />
                    </Tag.EndElement>
                  </Tag.Root>
                )}

                <Dialog.Root
                  open={observerOpen}
                  onOpenChange={(e) => setObserverOpen(e.open)}
                  placement="center"
                  motionPreset="slide-in-bottom"
                >
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content>
                      <Dialog.Header>
                        <Dialog.Title>Place on Dome</Dialog.Title>
                      </Dialog.Header>
                      <Dialog.Body>
                        <VStack gap={5}>
                          <Text>
                            Set your location, orientation, and the date and
                            time of your observation to position the audio at
                            this object's location.
                          </Text>
                          <ObserverSetup
                            onSubmit={handlePlaceOnDome}
                            onCancel={() => setObserverOpen(false)}
                          />
                        </VStack>
                      </Dialog.Body>
                      <Dialog.CloseTrigger asChild>
                        <CloseButton size="sm" />
                      </Dialog.CloseTrigger>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Root>

                <Button
                  type="submit"
                  colorPalette="teal"
                  minW="50%"
                  disabled={invalidLength || length === ""}
                  loading={loading}
                >
                  <LuAudioLines />
                  Generate
                </Button>

                <HStack w="100%">
                  <Separator w="100%" size="lg" />
                  <Text flexShrink="0">Summary</Text>
                  <Separator w="100%" size="lg" />
                </HStack>

                <DataList.Root
                  orientation="horizontal"
                  divideY="1px"
                  variant="bold"
                  w="100%"
                >
                  {summaryItems.map((item) => (
                    <DataList.Item key={item.label} pt="4">
                      <DataList.ItemLabel fontWeight="bold">
                        {item.label}
                      </DataList.ItemLabel>
                      <DataList.ItemValue>{item.value}</DataList.ItemValue>
                      {item.downloadable && item.fileRef && (
                        <DataList.ItemValue>
                          <IconButton
                            asChild
                            colorPalette="teal"
                            size="sm"
                            variant="ghost"
                          >
                            <a
                              href={`${coreAPI}/download?file_ref=${encodeURIComponent(item.fileRef)}`}
                              style={{ color: "inherit" }}
                            >
                              <LuDownload />
                            </a>
                          </IconButton>
                        </DataList.ItemValue>
                      )}
                    </DataList.Item>
                  ))}
                </DataList.Root>
              </VStack>
            </form>
            <br />
          </Box>
          <Box width="50%">
            {imageLoading ? (
              <LoadingMessage msg="" icon="pulsar" />
            ) : imageSrc ? (
              <Image
                src={imageSrc}
                alt={`A plot of the ${dataName} ${formatSoniType(soniType)}`}
                rounded="md"
                animation="fade-in 300ms ease-out"
              />
            ) : (
              <ErrorMsg message="Unable to plot data." />
            )}
          </Box>
        </HStack>
        <ActionBar.Root open={soniClicked}>
          <ActionBar.Positioner>
            <ActionBar.Content
              w={loading ? "20%" : "50%"}
              justifyContent="center"
            >
              {loading && <LoadingMessage msg="Generating Sonification..." />}
              {errorMessage && <ErrorMsg message={errorMessage} />}
              {soniReady && (
                <audio
                  key={audioKey}
                  src={`${coreAPI}/audio/${audioFilename}?v=${audioKey}`}
                  controls
                  style={{ width: "100%" }}
                />
              )}
            </ActionBar.Content>
          </ActionBar.Positioner>
        </ActionBar.Root>
        <Box h="4em" />
      </Box>
    </PageContainer>
  );
}

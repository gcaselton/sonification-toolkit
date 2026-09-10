import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingMessage from "../ui/LoadingMessage";
import PageContainer from "../ui/PageContainer";
import ErrorMsg from "../ui/ErrorMsg";
import { InfoTip } from "../ui/ToggleTip";
import SpecHelper from "../ui/sonify/SpecHelper";
import {
  lightCurvesAPI,
  coreAPI,
} from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import {
  Box,
  ActionBar,
  Button,
  createListCollection,
  CloseButton,
  Dialog,
  Field,
  Heading,
  Image,
  Text,
  Flex,
  Portal,
  SegmentGroup,
  NumberInput,
  VStack,
  Stack,
  Select,
  HStack,
  VisuallyHidden,
  Link,
} from "@chakra-ui/react";
import {
  LuAudioLines,
  LuLocateFixed,
  LuDatabase,
  LuCircleHelp,
  LuSlidersVertical,
  LuRotateCcw,
} from "react-icons/lu";
import { plotData } from "../../utils/plot";
import ObserverSetup, {
  ObserverValues,
  ORIENTATIONS,
} from "../utils/ObserverSetup";
import { Tooltip } from "../ui/Tooltip";
import { Layer } from "../../types/layers";
import { NavigationState } from "../../types/navigation";
import AudioDownloadButton from "../ui/AudioDownloadButton";
import { SummaryList, LayerSummary } from "../ui/sonify/SummaryComponents";
import { formatCoord, formatSoniType } from "../../utils/formatting";
import { Toaster, toaster } from "../ui/toaster";
import VolumeMixer from "../ui/sonify/VolumeMixer";
import { debounce } from "es-toolkit";
import { useOptionalComposer } from "../../context/ComposerContext";

export default function Sonify() {
  const navigate = useNavigate();
  const composer = useOptionalComposer();

  const MAX_DURATION = 60;

  // Route states
  const location = useLocation();
  const dataName = location.state.dataName;
  const dataRef = location.state.dataRef;
  const styleName = location.state.styleName;
  const styleDescription = location.state.styleDescription;
  const styleRef = location.state.styleRef;
  const soniType = location.state.soniType;
  const userUpload = location.state.userUpload;
  const ra = location.state.ra ?? null;
  const dec = location.state.dec ?? null;

  /*---------- States ----------*/

  // Default duration of 45 sec for night sky, 15 sec for everything else
  const [length, setLength] = useState(soniType === "night_sky" ? "45" : "15");
  const [audioSystem, setAudioSystem] = useState("stereo");

  // Track the audio system used for the most recently generated sonification.
  // This is used to disable mp3 downloads if system has more channels than mono or stereo.
  const [generatedAudioSystem, setGeneratedAudioSystem] = useState(audioSystem);
  const [masterAudioFileRef, setMasterAudioFileRef] = useState("");

  const [soniReady, setSoniReady] = useState(false);
  const [soniClicked, setSoniClicked] = useState(false);

  // States to control spectrogram
  const [specLoading, setSpecLoading] = useState(false);
  const [specImage, setSpecImage] = useState<string | null>(null);
  const [specHelperOpen, setSpecHelperOpen] = useState(false);
  const [specNeedsRefresh, setSpecNeedsRefresh] = useState(false);

  // States to control data plot
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<
    "mixer" | "data" | "spectrogram"
  >(soniType === "data_composer" ? "mixer" : "data");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [daysPerSec, setDaysPerSec] = useState("");
  const [totalDays, setTotalDays] = useState<number>(0);

  // Tracks audio files to prevent caching
  const [audioKey, setAudioKey] = useState("");

  const [observerOpen, setObserverOpen] = useState(false);
  const [observerValues, setObserverValues] = useState<ObserverValues | null>(
    null,
  );
  const [altAz, setAltAz] = useState<string[] | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const [layers, setLayers] = useState<Layer[]>(location.state.layers ?? []);

  // Focus keyboard navigation onto audio player once sonification generated
  useEffect(() => {
    if (soniReady) {
      audioRef.current?.focus();
    }
  }, [soniReady]);

  // Generate the plot once when component mounts
  useEffect(() => {
    async function fetchPlot() {
      try {
        // Don't plot if using Data Composer
        if (soniType === "data_composer") return;

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

  // Auto-switch to spectrogram for light curves when it's ready
  useEffect(() => {
    if (specImage && soniType === "light_curves") setActivePanel("spectrogram");
  }, [specImage]);

  // Fetch data range once on load for lightcurves
  useEffect(() => {
    if (soniType != "light_curves") {
      return;
    }

    const fetchDataRange = async () => {
      const url_range = `${lightCurvesAPI}/get-range-and-nans/`;
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

    const soniLayers = soniType === 'data_composer'
      ? // Send an array of data/style refs if using Data Composer
        layers.map((l) => ({
          data_ref: l.dataRef,
          style_ref: l.styleRef,
          id_column: l.idColumn,
          volume: l.volume
        }))
      : [
          // Otherwise, send just the one wrapped in an array
          {
            data_ref: dataRef,
            style_ref: styleRef,
          },
        ];

    const data = {
      category: soniType,
      layers: soniLayers,
      duration: length,
      system: audioSystem,
      data_name: soniType === "data_composer" ? "Layers" : dataName,
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

    try {
      const response = await apiRequest(url, data);

      if (response.alt_az) {
        setAltAz(response.alt_az);
      }

      return response.file_ref;
    } catch (error: any) {
      setErrorMessage(
        error?.message ?? "Unknown error generating sonification.",
      );
      console.error("Error fetching sonification:", error);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSoniClicked(true);
    setSoniReady(false);
    setLoading(true);
    setAltAz(null);

    requestSonification().then((fileRef) => {
      setLoading(false);
      if (fileRef) {
        setGeneratedAudioSystem(audioSystem);
        setAudioKey(Date.now().toString());
        setMasterAudioFileRef(fileRef);
        setSoniReady(true);

        // Request spectrogram
        getSpectrogram(fileRef)
      } else {
        console.error("No sonification file returned.");
      }
    });
  };

  const getSpectrogram = async (fileRef: string) => {
    setSpecLoading(true);

    const response = await apiRequest(`${coreAPI}/generate-spectrogram/`, {
      file_ref: fileRef,
    });

    setSpecImage(response.image);
    setSpecLoading(false);
    setSpecNeedsRefresh(false);
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

  const handlePlaceOnDome = (values: ObserverValues) => {
    setObserverValues(values);
    setObserverOpen(false);
  };

  const handleEditStyle = (styleRef: string) => {
    const state: NavigationState = {
      ...location.state,
      dataRef,
      dataName,
      soniType,
      ra,
      dec,
      userUpload,
      editStyle: styleRef,
    };
    navigate("../style", { state });
  };

  const handleLayerVolumeChange = (layer: Layer, volume: number) => {
    const updatedLayers = layers.map((l) =>
      l.id === layer.id ? { ...l, volume } : l,
    );
    setLayers(updatedLayers);

    if (soniClicked){
      debouncedMix(updatedLayers);
      setSpecNeedsRefresh(true);
    }
  };

  const mixVolume = useCallback(
    async (layers: Layer[]) => {
      setLoading(true);
      setSoniReady(false);
      try {
        const response = await apiRequest(`${coreAPI}/mix-layer-volumes/`, {
          volumes: layers.map((l) => l.volume),
        });

        setMasterAudioFileRef(response.file_ref);
        setAudioKey(Date.now().toString());
      } catch (error) {
        console.error("Error mixing volume:", error);
      } finally {
        setSoniReady(true);
        setLoading(false);
      }
    },
    [coreAPI],
  );

  const debouncedMix = useMemo(() => debounce(mixVolume, 300), [mixVolume]);

  useEffect(() => {
    return () => {
      debouncedMix.cancel();
    };
  }, [debouncedMix]);

  const askForFeedback = () => {
    if (sessionStorage.getItem("feedbackShown")) {
      return;
    }

    sessionStorage.setItem("feedbackShown", "true");

    setTimeout(() => {
      toaster.create({
        title: "What do you think?",
        description: (
          <>
            Let us know how you are using the Suite to help demonstrate success
            and justify future funding. Email:
            <Link
              colorPalette="teal"
              href="mailto:contactaudiouniverse@gmail.com"
              style={{ textDecoration: "underline" }}
            >
              contactaudiouniverse@gmail.com
            </Link>
            .
          </>
        ),
        type: "info",
        duration: 15000,
        closable: true,
      });
    }, 500);
  };

  const invalidLength =
    Number(length) > MAX_DURATION || length === "0" || length.includes("-");

  const summaries: LayerSummary[] = soniType === 'data_composer'
    ? layers.map((l) => ({
        layerLabel: l.label,
        description: l.styleDescription!,
        dataName: l.dataName!,
        styleName: l.styleName!,
        dataRef: l.dataRef,
        styleRef: l.styleRef,
        volume: l.volume,
      }))
    : [
        {
          description: styleDescription,
          dataName: dataName,
          styleName: styleName,
          dataRef,
          styleRef,
          volume: 1,
        },
      ];

  const COMPASS = Object.fromEntries(
    ORIENTATIONS.map(({ value, label }) => [value, label]),
  );

  // Place on dome option should only display for these sonification types
  const placeOnDomeModes = ["light_curves", "constellations"];

  // Formatted name for the master audio download
  const masterAudioName =
    soniType === "data_composer"
      ? "My Sonification"
      : `${dataName} (${styleName})`;

  return (
    <PageContainer>
      <VisuallyHidden>
        <div role="status" aria-live="polite" aria-atomic="true">
          {loading
            ? "Generating sonification"
            : soniReady
              ? "Sonification generated successfully. Audio player is now available."
              : ""}
        </div>
      </VisuallyHidden>

      <Toaster />

      <SpecHelper open={specHelperOpen} onOpenChange={setSpecHelperOpen} />

      <Heading as="h1">Sonify</Heading>
      <br />
      <Text textStyle="lg">
        Set the length of the sonification and choose the audio system you
        intend to play it on
      </Text>
      <br />
      <br />
      <Stack
        direction={{ base: "column", lg: "row" }}
        gap="4"
        align="start"
        justify="center"
        width="100%"
        minW={0}
      >
        <Box width={{ base: "100%", lg: "50%" }} minW={0}>
          <form onSubmit={handleSubmit}>
            <VStack
              align="start"
              justify="center"
              w={{ base: "100%", lg: "80%" }}
              gap={5}
              minW={0}
            >
              <HStack gap={10}>
                <Field.Root invalid={invalidLength} width="auto">
                  <HStack>
                    <Field.Label fontWeight="semibold">
                      Duration (seconds)
                    </Field.Label>
                    <InfoTip
                      content="The total length of the sonification. The sonification will compress or stretch to this length without distorting the aduio."
                      positioning={{ placement: "right" }}
                      contentProps={{ maxW: "300px" }}
                    />
                  </HStack>
                  <NumberInput.Root
                    value={length}
                    onValueChange={(e) => handleLengthChange(e.value)}
                    inputMode="decimal"
                    step={1}
                    min={1}
                    max={MAX_DURATION}
                  >
                    <NumberInput.Input aria-valuetext={`${length} seconds`} />
                  </NumberInput.Root>
                  {Number(length) > 30 && Number(length) <= MAX_DURATION && (
                    <Field.HelperText>
                      Longer sonifications take more time to generate, including
                      the spectrogram.
                    </Field.HelperText>
                  )}
                  <Field.ErrorText>
                    Please enter a number up to {MAX_DURATION} seconds.
                  </Field.ErrorText>
                </Field.Root>
                {soniType === "light_curves" && (
                  <>
                    <Text textStyle="2xl" height="0.5">
                      =
                    </Text>
                    <Field.Root width="auto">
                      <HStack>
                        <Field.Label fontWeight="semibold">
                          Days per Second
                        </Field.Label>
                        <InfoTip
                          content="Alternatively, enter how many days in the dataset you want to transpire per second. This will then calculate a new sonification duration."
                          positioning={{ placement: "right" }}
                          contentProps={{ maxW: "300px" }}
                        />
                      </HStack>

                      <NumberInput.Root
                        value={daysPerSec}
                        onValueChange={(e) => {
                          handleDaysPerSecChange(e.value);
                        }}
                        inputMode="decimal"
                        min={0}
                        max={totalDays}
                      >
                        <NumberInput.Input
                          aria-valuetext={`${daysPerSec} days per second`}
                        />
                      </NumberInput.Root>
                    </Field.Root>
                  </>
                )}
              </HStack>

              {/* Audio system options */}
              <Stack
                direction={{ base: "column", sm: "row" }}
                alignItems={{ base: "stretch", sm: "flex-end" }}
                w="100%"
                gap={3}
              >
                <Select.Root
                  collection={audioSystemOptions}
                  value={[audioSystem]}
                  onValueChange={(e) => setAudioSystem(e.value[0])}
                  minW="50%"
                >
                  <Select.HiddenSelect />
                  <HStack>
                    <Select.Label fontWeight="semibold">
                      Audio System
                    </Select.Label>
                    <InfoTip
                      content="Choose your planetarium's audio setup. Note that using Azimuth as an output parameter requires a 5.1 or 7.1 system, and using Pan requires a stereo system at minimum."
                      positioning={{ placement: "right" }}
                      contentProps={{ maxW: "300px" }}
                    />
                  </HStack>
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
                {placeOnDomeModes.includes(soniType) && ra && dec && (
                  <HStack>
                    <Tooltip
                      content="Unavailable for Mono audio systems"
                      disabled={audioSystem !== "mono"}
                      openDelay={100}
                    >
                      <Button
                        colorPalette="teal"
                        variant={observerValues ? "solid" : "subtle"}
                        disabled={audioSystem === "mono"}
                        onClick={() => setObserverOpen(true)}
                      >
                        <LuLocateFixed />
                        Place on Dome
                      </Button>
                    </Tooltip>
                    <InfoTip
                      content="Positions the audio in space to match where this object would appear in the sky from your location. Note: if your chosen style already maps data to Azimuth, Polar, or Pan, those mappings will be overridden."
                      positioning={{ placement: "right" }}
                      contentProps={{ maxW: "300px" }}
                    />
                  </HStack>
                )}
              </Stack>

              {observerValues && (
                <HStack
                  bg="teal.subtle"
                  color="teal.fg"
                  borderRadius="md"
                  px={2}
                  py={1}
                  fontSize="xs"
                  flexWrap="wrap"
                  align="center"
                >
                  <Text flex="1" whiteSpace="normal">
                    {observerValues.locationName} (
                    {formatCoord(observerValues.latitude)},{" "}
                    {formatCoord(observerValues.longitude)}), facing{" "}
                    {COMPASS[observerValues.orientation]},{" "}
                    {observerValues.dateTime}
                  </Text>
                  <CloseButton
                    size="xs"
                    variant="subtle"
                    colorPalette="teal"
                    onClick={() => setObserverValues(null)}
                  />
                </HStack>
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
                      <VStack gap={4}>
                        <Text>
                          Set your location, orientation, and the date and time
                          of your observation to position the audio at this
                          object's location.
                        </Text>
                        <Text textStyle="xs" color="fg.muted">
                          This feature will override any spatial audio mappings
                          (e.g. Azimuth, Pan) in your chosen style.
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
                size="md"
                minW="60%"
                transition="transform 0.2s"
                _hover={{
                  transform: "translateY(-2px)",
                }}
                _active={{
                  transform: "translateY(0px)",
                }}
                disabled={invalidLength || length === ""}
                loading={loading}
              >
                <Box
                  display="inline-flex"
                  animation={
                    !invalidLength && length !== ""
                      ? "audioPulse 2s ease-in-out infinite"
                      : undefined
                  }
                >
                  <LuAudioLines />
                </Box>
                Generate Sonification
              </Button>

              {/* Summary section */}
              <SummaryList
                summaries={summaries}
                altAz={altAz}
                handleEditStyle={handleEditStyle}
                soniReady={soniReady}
                audioKey={audioKey}
                audioSystem={generatedAudioSystem}
              />
            </VStack>
          </form>
          <br />
        </Box>

        {/* Right hand side of the screen */}

        <VStack width={{ base: "100%", lg: "50%" }} minW={0}>
          <Flex justify="center" mb={0}>
            <SegmentGroup.Root
              value={activePanel}
              onValueChange={(e) =>
                setActivePanel(e.value as "mixer" | "data" | "spectrogram")
              }
              size="sm"
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Item
                value={soniType === "data_composer" ? "mixer" : "data"}
                cursor="pointer"
              >
                <SegmentGroup.ItemText>
                  <HStack>
                    {soniType === "data_composer" ? (
                      <>
                        <LuSlidersVertical /> Volume
                      </>
                    ) : (
                      <>
                        <LuDatabase /> Data
                      </>
                    )}
                  </HStack>
                </SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
              <Tooltip
                content="Generate the sonification to view its spectrogram"
                disabled={specLoading || specImage !== null}
              >
                <SegmentGroup.Item
                  value="spectrogram"
                  cursor="pointer"
                  disabled={!specImage && !specLoading}
                >
                  <SegmentGroup.ItemText>
                    <HStack>
                      <LuAudioLines /> Spectrogram
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </Tooltip>
            </SegmentGroup.Root>
          </Flex>

          <Box
            borderWidth="1px"
            borderRadius="md"
            minH="400px"
            width="100%"
            minW={0}
            overflow="hidden"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg={activePanel === "mixer" ? "bg.subtle" : "bg"}
          >
            {activePanel === "mixer" && (
              <VolumeMixer
                layers={layers}
                onLayerVolumeChange={handleLayerVolumeChange}
              />
            )}
            {activePanel === "data" &&
              (imageLoading ? (
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
              ))}

            {activePanel === "spectrogram" &&
              (specLoading ? (
                <LoadingMessage msg="Generating spectrogram..." icon="pulsar" />
              ) : specImage ? (
                <Box position="relative">
                  <Image
                    src={`data:image/png;base64,${specImage}`}
                    alt="Spectrogram"
                    rounded="md"
                    animation="fade-in 300ms ease-out"
                  />
                  {specNeedsRefresh && (
                    <Tooltip content="Update spectrogram with volume changes">
                      <Button
                        colorPalette="teal"
                        position="absolute"
                        top="4"
                        right="4"
                        size="sm"
                        variant="surface"
                        onClick={() => getSpectrogram(masterAudioFileRef)}
                      >
                        <LuRotateCcw /> Refresh
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              ) : (
                <ErrorMsg message="Unable to generate spectrogram." />
              ))}
          </Box>
          {activePanel === "spectrogram" && specImage && (
            <Link
              onClick={() => setSpecHelperOpen(true)}
              color="teal.500"
              cursor="pointer"
              whiteSpace="nowrap"
            >
              <HStack gap="2">
                <LuCircleHelp />
                <Text>What am I looking at?</Text>
              </HStack>
            </Link>
          )}
        </VStack>
      </Stack>
      <ActionBar.Root open={soniClicked}>
        <ActionBar.Positioner zIndex={1400}>
          <ActionBar.Content
            w={{ base: "90%", md: loading ? "25%" : "50%" }}
            justifyContent="center"
          >
            {loading && <LoadingMessage msg="Generating Sonification..." />}
            {errorMessage && (
              <ErrorMsg
                message={errorMessage}
                onClose={() => setErrorMessage("")}
              />
            )}
            {soniReady && (
              <HStack justify="space-between" w="100%" gap={4}>
                <audio
                  ref={audioRef}
                  key={audioKey}
                  src={`${coreAPI}/audio/${masterAudioFileRef}?name=${encodeURIComponent(masterAudioName)}&audio_format=wav&v=${audioKey}`}
                  controls
                  style={{ flex: 1 }}
                />

                <AudioDownloadButton
                  audioFileRef={masterAudioFileRef}
                  fileName={masterAudioName}
                  audioKey={audioKey}
                  audioSystem={generatedAudioSystem}
                  isLayer={false}
                  soniReady={soniReady}
                  volume={1}
                  onDownload={askForFeedback}
                />
              </HStack>
            )}
          </ActionBar.Content>
        </ActionBar.Positioner>
      </ActionBar.Root>
    </PageContainer>
  );
}

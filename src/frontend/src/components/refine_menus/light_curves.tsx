import {
  Box,
  Button,
  Code,
  Image,
  Text,
  NumberInput,
  VStack,
  Stack,
  Slider,
  Skeleton,
  HStack,
} from "@chakra-ui/react";
import { RefineMenuProps } from "../../types/refine_menu";
import { useState, useEffect, useMemo, useCallback } from "react";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { lightCurvesAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { InfoTip } from "../ui/ToggleTip";
import { LuArrowRight } from "react-icons/lu";
import { plotData } from "../../utils/plot";
import { debounce, fill } from "es-toolkit";
import NaNHandler, { NanStrategy } from "../ui/NaNHandler";

export default function LightCurves({
  dataName,
  dataRef,
  onApply,
}: RefineMenuProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // fetched range from backend (x axis min/max)
  const [cropRange, setCropRange] = useState<[number, number]>([0, 0]);

  // controlled slider value
  const [cropValues, setCropValues] = useState<[number, number]>([0, 0]);

  const [startText, setStartText] = useState(String(cropValues[0]));
  const [endText, setEndText] = useState(String(cropValues[1]));

  const [slidersLoading, setSlidersLoading] = useState(true);

  // sigma value for data smoothing
  const [sigma, setSigma] = useState(0);

  const [hasNans, setHasNans] = useState(false);
  const [nanStrategy, setNanStrategy] = useState<NanStrategy>("interpolate");
  const [fillWith, setFillWith] = useState("min");
  const [nanHandled, setNanHandled] = useState(false);

  const [applyLoading, setApplyLoading] = useState(false);

  

  // fetch plot
  useEffect(() => {
    let mounted = true;
    async function fetchPlot() {
      try {
        const base64 = await plotData(dataRef, "light_curves");
        if (!mounted) return;
        setImageSrc(`data:image/svg+xml;base64,${base64}`);
      } catch (err) {
        console.error("Error generating plot:", err);
      } finally {
        if (mounted) setImageLoading(false);
      }
    }
    fetchPlot();
    return () => {
      mounted = false;
    };
  }, [dataRef]);

  // fetch cropRange and do NaN check on first load
  useEffect(() => {
    if (!dataRef) return;

    let mounted = true;
    async function fetchRangeAndNans() {
      const endpoint = `${lightCurvesAPI}/get-range-and-nans/`;
      try {
        const payload = { file_ref: dataRef };
        const result = await apiRequest(endpoint, payload, "POST");

        if (
          mounted &&
          Array.isArray(result.range) &&
          result.range.length === 2
        ) {
          const r: [number, number] = [
            Number(result.range[0].toFixed(2)),
            Number(result.range[1].toFixed(2)),
          ];
          setCropRange(r);
          setCropValues(r);
          setStartText(String(r[0]));
          setEndText(String(r[1]));

          setHasNans(result.has_nans);
          setSlidersLoading(false);

          // Make sure NaNs are handled in the plot from the start
          if (result.has_nans) {
            fetchPreviewPlot(r, sigma, nanStrategy, fillWith);
            setNanHandled(true);
          }
        }
      } catch (error) {
        console.error("Error fetching x-axis range:", error);
        setSlidersLoading(false);
      }
    }
    fetchRangeAndNans();
    return () => {
      mounted = false;
    };
  }, [dataRef]);

  // prepare marks when cropRange exists
  const sliderMarks = cropRange
    ? [
        { value: cropRange[0], label: String(cropRange[0]) },
        { value: cropRange[1], label: String(cropRange[1]) },
      ]
    : [];

  // preview function
  const fetchPreviewPlot = useCallback(
    async (
      range: [number, number] | null,
      sigmaVal: number,
      nanStrategy: NanStrategy,
      fillWith: string,
    ) => {
      if (!range) return;
      setImageLoading(true);

      const endpoint = `${lightCurvesAPI}/preview-refined/`;
      const payload = {
        data_name: dataName,
        file_ref: dataRef,
        new_range: range,
        sigma: sigmaVal,
        nan_strategy: nanStrategy,
        fill_with: fillWith,
      };

      try {
        const result = await apiRequest(endpoint, payload);
        setImageSrc(`data:image/svg+xml;base64,${result.image}`);
        setHasNans(result.nans_after_trim);
      } catch (err) {
        console.error("Error previewing plot:", err);
      } finally {
        setImageLoading(false);
      }
    },
    [dataName, dataRef],
  );

  // Wrapper which delays fetching the plot by 300ms - this prevents spamming the backend every time a slider moves
  const debouncedFetchPreviewPlot = useMemo(
    () => debounce(fetchPreviewPlot, 300),
    [fetchPreviewPlot],
  );

  useEffect(() => {
    return () => {
      debouncedFetchPreviewPlot.cancel();
    };
  }, [debouncedFetchPreviewPlot]);

  const handleClickApply = async () => {
    setApplyLoading(true);

    const endpoint = `${lightCurvesAPI}/save-refined/`;
    const payload = {
      data_name: dataName,
      file_ref: dataRef,
      new_range: cropValues,
      sigma: sigma,
      nan_strategy: nanStrategy,
      fill_with: fillWith,
    };

    const result = await apiRequest(endpoint, payload);

    if (onApply) {
      onApply({newRef: result.file_ref}); // pass new filepath up to parent Refine.tsx
    }

    setApplyLoading(false);
  };

  const handleNanStrategyChange = (strategy: NanStrategy) => {
    setNanStrategy(strategy);
    fetchPreviewPlot(cropValues, sigma, strategy, fillWith);
  };

  const handleFillWithChange = (value: string) => {
    setFillWith(value);
    fetchPreviewPlot(cropValues, sigma, nanStrategy, value);
  };

  const slidersMoved =
    cropValues && cropRange
      ? cropValues![0] == cropRange![0] &&
        cropValues![1] == cropRange![1] &&
        sigma == 0
        ? false
        : true
      : false;

  const applyButtonOn = slidersMoved || nanHandled;

  // Apply button component separate to TSX as we use it in different places depending on viewport size
  const applyButton = !slidersLoading ? (
    <HStack
      gap="5"
      justify="center"
      w="100%"
      animation="fade-in 300ms ease-out"
    >
      <Button
        onClick={handleClickApply}
        colorPalette="teal"
        loading={applyLoading}
        loadingText="Saving..."
        variant={applyButtonOn ? "solid" : "surface"}
      >
        {applyButtonOn ? "Apply & Continue" : "Skip"} <LuArrowRight />
      </Button>
    </HStack>
  ) : (
    <Box width="100%">
      <Skeleton height="4em" />
    </Box>
  );

  return (
    <Stack
      gap="10"
      align="start"
      justify="center"
      direction={{ base: "column", md: "row" }}
    >
      <Box flex="1" maxWidth={{ base: "100%", md: "50%" }}>
        <VStack justify="center" gap="8">
          {/* render slider only when we have cropRange & cropValues */}
          {!slidersLoading && cropRange && cropValues ? (
            <VStack>
              <Stack
                direction={{ base: "column", sm: "row" }}
                align={{ base: "stretch", sm: "center" }}
                gap="3"
              >
                <NumberInput.Root
                  value={startText}
                  min={cropRange[0]}
                  max={cropValues[1]}
                  onValueChange={(e) => setStartText(e.value)}
                  onBlur={() => {
                    const n = Number(startText);
                    if (!Number.isNaN(n)) {
                      const clamped = Math.min(
                        Math.max(n, cropRange[0]), // not below range min
                        cropValues[1] - 0.1, // not >= end value
                      );
                      setCropValues(([_, end]) => [clamped, end]);
                      setStartText(String(clamped));
                      fetchPreviewPlot(
                        [clamped, cropValues[1]],
                        sigma,
                        nanStrategy,
                        fillWith,
                      );
                    } else {
                      setStartText(String(cropValues[0]));
                    }
                  }}
                >
                  <HStack>
                    <NumberInput.Label whiteSpace="nowrap">
                      Trim start
                    </NumberInput.Label>
                    <NumberInput.Input aria-valuetext={startText} />
                  </HStack>
                </NumberInput.Root>
                <NumberInput.Root
                  value={endText}
                  min={cropValues[0]}
                  max={cropRange[1]}
                  onValueChange={(e) => setEndText(e.value)}
                  onBlur={() => {
                    const n = Number(endText);
                    if (!Number.isNaN(n)) {
                      const clamped = Math.max(
                        Math.min(n, cropRange[1]), // not above range max
                        cropValues[0] + 0.1, // not <= start value
                      );
                      setCropValues(([start, _]) => [start, clamped]);
                      setEndText(String(clamped));
                      fetchPreviewPlot(
                        [cropValues[0], clamped],
                        sigma,
                        nanStrategy,
                        fillWith,
                      );
                    } else {
                      setEndText(String(cropValues[1]));
                    }
                  }}
                >
                  <HStack>
                    <NumberInput.Label whiteSpace="nowrap">
                      and end
                    </NumberInput.Label>
                    <NumberInput.Input aria-valuetext={endText} />
                  </HStack>
                </NumberInput.Root>

                <Text textStyle="md">points</Text>
              </Stack>
              <Slider.Root
                w="100%"
                step={0.01}
                colorPalette="teal"
                min={cropRange[0]}
                max={cropRange[1]}
                value={cropValues}
                minStepsBetweenThumbs={0.1}
                animation="fade-in 300ms ease-out"
                onValueChange={(e) => {
                  setCropValues(e.value as [number, number]);
                  setStartText(String(e.value[0]));
                  setEndText(String(e.value[1]));
                  debouncedFetchPreviewPlot(
                    e.value as [number, number],
                    sigma,
                    nanStrategy,
                    fillWith,
                  );
                }}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                  <Slider.Marks marks={sliderMarks} />
                </Slider.Control>
              </Slider.Root>
            </VStack>
          ) : (
            <Box width="100%">
              <Skeleton height="4em" />
            </Box>
          )}
          {!slidersLoading ? (
            <Slider.Root
              w="100%"
              colorPalette="teal"
              min={0}
              max={10}
              value={[sigma]}
              animation="fade-in 300ms ease-out"
              onValueChange={(e) => {
                setSigma(e.value[0]);
                debouncedFetchPreviewPlot(
                  cropValues,
                  e.value[0],
                  nanStrategy,
                  fillWith,
                );
              }}
            >
              <HStack>
                <Slider.Label textStyle="md">Smoothing Factor</Slider.Label>
                <InfoTip
                  content="This is the standard deviation to give to a Gaussian filter, removing noise from the signal."
                  positioning={{ placement: "top" }}
                />
                <Code textStyle="md" ml="auto">
                  {sigma}
                </Code>
              </HStack>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
              </Slider.Control>
            </Slider.Root>
          ) : (
            <Box width="100%">
              <Skeleton height="4em" />
            </Box>
          )}
          {hasNans && (
            <NaNHandler
              strategy={nanStrategy}
              onStrategyChange={handleNanStrategyChange}
              fillWith={fillWith}
              onFillWithChange={handleFillWithChange}
            />
          )}
          <Box hideBelow="md" width="100%">
            {applyButton}
          </Box>
        </VStack>
      </Box>

      <Box flex="1" borderWidth="1px" borderRadius="md">
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image
            src={imageSrc}
            alt={`Plot of the ${dataName} light curve.`}
            animation="fade-in 300ms ease-out"
            rounded="md"
          />
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
      <Box hideFrom="md" width="100%">
        {applyButton}
      </Box>
    </Stack>
  );
}

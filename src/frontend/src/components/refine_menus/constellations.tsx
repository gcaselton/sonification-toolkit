import {
  Box,
  Button,
  createListCollection,
  Checkbox,
  Code,
  Collapsible,
  Field,
  Heading,
  Image,
  Input,
  Icon,
  Link,
  Text,
  Flex,
  NumberInput,
  VStack,
  Stack,
  Select,
  SegmentGroup,
  Slider,
  Skeleton,
  RadioCard,
  HStack,
} from "@chakra-ui/react";
import { RefineMenuProps } from "./RefineMenu";
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { apiUrl, constellationsAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { plotData } from "../../utils/plot";
import { InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { LuSquareDashed, LuWaypoints, LuArrowRightLeft, LuArrowRight } from "react-icons/lu";

export default function Constellations({
  dataRef,
  dataName,
  onApply,
}: RefineMenuProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // loading states for nStars and magnitude inputs
  const [nStarsLoading, setNStarsLoading] = useState(false);
  const [magLoading, setMagLoading] = useState(true);

  // number of stars
  const [nStars, setNStars] = useState("1000");

  // magnitude state
  const [magnitude, setMagnitude] = useState("");

  const [applyLoading, setApplyLoading] = useState(false);
  const [filterType, setFilterType] = useState<string | null>("shape");

  // re-plot when different RadioCard is clicked, or nStars or magnitude changes (also on initial magnitude fetch)
  useEffect(() => {
    const handler = setTimeout(() => {
      plotConstellation();
    }, 300); // wait after the last change

    // cancel the timeout if nStars or magnitude changes again
    return () => clearTimeout(handler);
  }, [nStars, magnitude, filterType]);

  // set initial magnitude based on nStars (10)
  useEffect(() => {
    const setMag = async () => {
      await handleNStarsChange(nStars);
    };

    setMag();
  }, []);

  // request plot from backend
  const plotConstellation = async () => {
    setImageLoading(true);

    const endpoint = `${constellationsAPI}/get-and-plot/`;
    const payload = {
      name: dataName,
      by_shape: filterType === 'shape',
      n_stars: nStars,
    };

    const result = await apiRequest(endpoint, payload);

    // update image state
    setImageSrc(`data:image/svg+xml;base64,${result.image}`);

    setImageLoading(false);
  };

  const handleClickApply = async () => {
    setApplyLoading(true);

    const endpoint = `${constellationsAPI}/save-refined/`;
    const payload = {
      name: dataName,
      by_shape: filterType === 'shape',
      n_stars: nStars,
    };

    const result = await apiRequest(endpoint, payload);

    if (onApply) {
      onApply(result.file_ref); // Pass the refined data file reference up to Refine.tsx
    }

    setApplyLoading(false);
  };

  const handleNStarsChange = async (value: string) => {
    setMagLoading(true);

    const intValue = Math.floor(Number(value));

    if (!isNaN(intValue)) {
      setNStars(intValue.toString());
    }

    const endpoint = `${constellationsAPI}/get-max-magnitude/`;
    const payload = {
      name: dataName,
      n_stars: intValue,
    };

    const result = await apiRequest(endpoint, payload);

    setMagnitude(result.max_magnitude);
    setMagLoading(false);
  };

  const handleMagnitudeChange = async (value: string) => {
    setNStarsLoading(true);

    setMagnitude(value);

    const endpoint = `${constellationsAPI}/get-n-stars/`;
    const payload = {
      name: dataName,
      max_magnitude: value,
    };

    const result = await apiRequest(endpoint, payload);

    setNStars(result.n_stars);
    setNStarsLoading(false);
  };

  // const invalidNStars = isNaN(Number(nStars)) || !Number.isInteger(Number(nStars)) || Number(nStars) <= 0 || Number(nStars) > 60;

  // const applyButtonOn = cropValues && cropRange ?
  //                           cropValues![0] == cropRange![0] &&
  //                           cropValues![1] == cropRange![1] &&
  //                           sigma == 0
  //                           ? false
  //                           : true
  //                         : false

  const cards = [
    {
      value: "shape",
      title: "Stick Figure",
      description:
        `Sonify the stars that make up the classic shape of ${dataName}`,
      icon: <LuWaypoints />,
    },
    {
      value: "boundaries",
      title: "Boundaries",
      description:
        (
          <>
            Sonify the brightest stars within the{" "}
            <Link
              href="https://en.wikipedia.org/wiki/IAU_designated_constellations"
              color="teal.500"
              textDecoration="underline"
            >
              constellation boundaries
            </Link>
          </>
      ),
      icon: <LuSquareDashed />,
    },
  ];

  return (
    <Stack
      gap="10"
      align="start"
      justify="center"
      direction={{ base: "column", md: "row" }}
    >
      <Box minW="50%">
        <VStack align="center" justify="center" gap={{md: "10"}} w="auto">
          <RadioCard.Root
            value={filterType}
            colorPalette="teal"
            onValueChange={(e) => setFilterType(e.value)}
          >
            <Stack align="stretch" direction={{ base: "column", md: "row" }}>
              {cards.map((card) => (
                <RadioCard.Item key={card.value} value={card.value}>
                  <RadioCard.ItemHiddenInput />
                  <RadioCard.ItemControl>
                    <RadioCard.ItemContent>
                      <Icon size="xl" color="fg.muted" mb="2">
                        {card.icon}
                      </Icon>
                      <RadioCard.ItemText textStyle="md">
                        {card.title}
                      </RadioCard.ItemText>
                      <RadioCard.ItemDescription>
                        {card.description}
                      </RadioCard.ItemDescription>
                    </RadioCard.ItemContent>
                    <RadioCard.ItemIndicator />
                  </RadioCard.ItemControl>
                </RadioCard.Item>
              ))}
            </Stack>
          </RadioCard.Root>
          <Collapsible.Root open={filterType == "boundaries"}>
            <Collapsible.Content>
              <HStack gap={10}>
                <Field.Root width="auto">
                  <Field.Label>Number of Stars</Field.Label>
                  <NumberInput.Root
                    disabled={nStarsLoading}
                    min={1}
                    max={1000}
                    value={nStars}
                    onValueChange={(e) => {
                      handleNStarsChange(e.value);
                    }}
                    inputMode="numeric"
                  >
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
                <Icon size="md">
                  <LuArrowRightLeft />
                </Icon>
                <Field.Root width="auto">
                  <Field.Label>Magnitude less than</Field.Label>
                  <NumberInput.Root
                    disabled={magLoading}
                    min={-1.5}
                    max={21}
                    value={magnitude}
                    onValueChange={(e) => {
                      handleMagnitudeChange(e.value);
                    }}
                    inputMode="decimal"
                  >
                    <NumberInput.Control />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </HStack>
            </Collapsible.Content>
          </Collapsible.Root>
          <Box display={{ base: "none", md: "flex" }}>
            <Button
              w="auto"
              onClick={handleClickApply}
              colorPalette="teal"
              loading={applyLoading}
              loadingText="Saving..."
            >
              Apply & Continue <LuArrowRight />
            </Button>
          </Box>
        </VStack>
      </Box>

      <Box minW={{base: '100%', md: "50%"}}>
        {imageLoading ? (
          <LoadingMessage msg="" icon="pulsar" />
        ) : imageSrc ? (
          <Image
            src={imageSrc}
            alt={`A plot of the ${nStars} brightest stars in ${dataName}.`}
            animation="fade-in 300ms ease-out"
          />
        ) : (
          <ErrorMsg message="Unable to plot data." />
        )}
      </Box>
      <Box w="100%" display={{ base: "block", md: "none" }}>
        <Button
          w="100%"
          onClick={handleClickApply}
          colorPalette="teal"
          loading={applyLoading}
          loadingText="Saving..."
        >
          Apply & Continue <LuArrowRight />
        </Button>
      </Box>
    </Stack>
  );
}

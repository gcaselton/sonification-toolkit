import React, { useEffect, useState, createContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LoadingMessage from "../ui/LoadingMessage";
import {
  LuX,
  LuChartSpline,
  LuAudioLines,
  LuSearch,
  LuSlidersHorizontal,
  LuTelescope,
  LuUpload,
} from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton } from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage, randomRange } from "../../utils/assets";
import { apiUrl, lightCurvesAPI, coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { plotData } from "../../utils/plot";

import {
  Box,
  Alert,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Collapsible,
  Flex,
  LinkOverlay,
  Link,
  Image,
  Field,
  Icon,
  FileUpload,
  Input,
  InputGroup,
  Dialog,
  Stack,
  Heading,
  VStack,
  Spinner,
  Table,
  Tabs,
  For,
  Text,
  IconButton,
  chakra,
  SimpleGrid,
  HStack,
  VisuallyHidden,
  useBreakpointValue,
} from "@chakra-ui/react";
import { NavigationState } from "../../types/navigation";
import { capitaliseWords } from "../../utils/formatting";

const soniType = "light_curves";

export interface Lightcurve {
  id: string;
  mission: string;
  exposure: number;
  pipeline: string;
  year: number;
  period: string;
  dataURI: string;
}

export interface SuggestedData {
  name: string;
  description: string;
  ra: number;
  dec: number;
  fileRef: string;
  category: string;
}

export default function Lightcurves() {
  // Instantiate navigation
  const navigate = useNavigate();

  // Set up states
  const [selectedStar, setSelectedStar] = useState("");
  const [lightcurves, setLightcurves] = useState([]);
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [plotOpen, setPlotOpen] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingPlot, setLoadingPlot] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingId, setLoadingId] = useState("fake ID");
  const resultsReady = lightcurves.length > 0 && !loading;

  const [showFilters, setShowFilters] = useState(false);
  const [tessChecked, setTessChecked] = useState(true);
  const [keplerChecked, setKeplerChecked] = useState(true);
  const [k2Checked, setK2Checked] = useState(true);

  const [ra, setRa] = useState(null);
  const [dec, setDec] = useState(null);

  const [loadingLong, setLoadingLong] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const searchResultsRef = useRef<HTMLHeadingElement>(null);

  const categoryNames: Record<string, string> = {
    "exoplanet": "Exoplanet Transit",
    "binary": "Binary Stars",
    "pulsating": "Pulsating Variables",
    "other": "Other"
  }

  // Focus search results for screen readers & scroll into view when ready
  useEffect(() => {
    if (resultsReady && searchResultsRef.current) {
      searchResultsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      searchResultsRef.current.focus();
    }
  }, [resultsReady]);

  const cancelSearch = () => {
    if (abortControllerRef.current) {
      console.log("Cancelling search…");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // Fetch suggested data sets on first load
  useEffect(() => {
    fetch(`${coreAPI}/suggested-data/${soniType}/`)
      .then((res) => res.json())
      .then((data) => {
        const mapped: SuggestedData[] = data.map((item: any) => ({
          name: item.name,
          description: item.description,
          ra: item.ra,
          dec: item.dec,
          fileRef: item.file_ref,
          category: item.category
        }));

        setSuggested(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch suggested data:", err);
      });
  }, []);

  // Ensure search is aborted if user navigates away
  useEffect(() => {
    return () => {
      cancelSearch();
    };
  }, []);

  // Displays extra message if search takes a while
  useEffect(() => {
    if (!loading) {
      setLoadingLong(false);
      return;
    }

    const interval = setInterval(() => {
      setLoadingLong((prev) => !prev);
    }, 5000);

    return () => clearInterval(interval);
  }, [loading]);

  const searchLightcurves = async () => {
    if (!selectedStar.trim()) {
      setErrorMessage("Please enter a star name before searching.");
      return;
    }

    // Cancel any existing search
    cancelSearch();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMessage("");

    // Clear previous results
    setLightcurves([]);

    // Dictionary of search filters
    const filters = {
      mission: {
        TESS: tessChecked,
        Kepler: keplerChecked,
        K2: k2Checked,
      },
    };

    const url_search = `${lightCurvesAPI}/search-lightcurves/`;
    const data = {
      star_name: selectedStar,
      filters: filters,
    };

    try {
      const response = await apiRequest(url_search, data, "POST", {
        signal: controller.signal,
      });

      setLightcurves(response.results);
      setRa(response.ra);
      setDec(response.dec);
    } catch (error: any) {
      console.log(error.name);

      if (error.name === "AbortError") {
        console.log("Search cancelled by user");
        setSearched(false);
        return;
      }

      if (String(error).includes("Failed to fetch")) {
        error =
          "Network error: Please check your internet connection or use a suggested dataset.";
      }

      setErrorMessage(String(error)); // Set error message to display
      setSearched(false);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const selectLightcurve = async (dataURI: string) => {
    // Call the API endpoint to select the lightcurve and get the filepath
    const url_selectlightcurve = `${lightCurvesAPI}/select-lightcurve/`;
    const data = { data_uri: dataURI };
    try {
      const result = await apiRequest(url_selectlightcurve, data);
      return result.file_ref;
    } catch (error) {
      console.error("Error fetching sonification:", error);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(capitaliseWords(selectedStar));
    setSearched(true);
    searchLightcurves();
  };

  const handleClickSonify = (dataURI: string) => {
    setLoadingId(dataURI);
    // Call the select lightcurve function with the dataURI
    selectLightcurve(dataURI).then((dataRef) => {
      if (dataRef) {
        // Navigate to the style page with the filepath and star name
        const state: NavigationState = {
          sourceDataRef: dataRef,
          dataName: searchTerm,
          soniType,
          ra,
          dec,
        };
        navigate("../refine", { state });
      }
    });
  };

  const handleClickPlot = async (item: Lightcurve | SuggestedData) => {
    let fileRef, plotTitle;

    if ("dataURI" in item) {
      fileRef = item.dataURI;
      plotTitle = `${item.period}, ${item.pipeline}, ${item.year}`;
    } else {
      fileRef = item.fileRef;
      plotTitle = item.name;
    }

    setTitle(`Light Curve for ${plotTitle}`);
    setLoadingPlot(true);
    setPlotOpen(true);

    try {
      setImage("");
      const image = await plotData(fileRef, soniType);

      if (image) {
        setImage("data:image/svg+xml;base64," + image);
        setLoadingPlot(false);
      }
    } catch (err) {
      console.error("Error plotting light curve:", err);
    } finally {
      setLoadingPlot(false);
    }
  };

  const handleClickSuggested = (star: any) => {
    const state: NavigationState = {
      sourceDataRef: star.fileRef,
      dataName: star.name,
      soniType,
      ra: star.ra,
      dec: star.dec,
    };

    navigate("../refine", { state });
  };

  const filterCount = [tessChecked, keplerChecked, k2Checked].filter(
    Boolean,
  ).length;

  return (
    <PageContainer>
      <VisuallyHidden>
        <div role="status" aria-live="polite" aria-atomic="true">
          {resultsReady ??
            `${lightcurves.length} results found for ${searchTerm}`}
        </div>
      </VisuallyHidden>
      <Heading as="h1">Light Curves</Heading>
      <br />
      <Text textStyle="lg">
        Search for a specific star or choose from the suggestions below
      </Text>
      <br />
      <br />
      <form onSubmit={handleSubmit}>
        <Box display="flex" justifyContent="center">
          <VStack gap={4} width={{ base: "100%", md: "50%" }} maxWidth="600px">
            <HStack width="100%">
              <Field.Root>
                <InputGroup
                  startElement={<LuTelescope size="1.1rem" />}
                  width="100%"
                >
                  <Input
                    placeholder="E.g. Polaris, HIP 11767, alf Psc..."
                    type="text"
                    name="star_name"
                    variant="outline"
                    value={selectedStar}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedStar(value);
                      if (value.trim() === "") {
                        setSearched(false);
                        setLightcurves([]);
                      }
                    }}
                  />
                </InputGroup>
                <Field.HelperText>
                  Search by name or any catalog identifier (resolved by{" "}
                  <Link
                    href="https://simbad.cds.unistra.fr/simbad/"
                    aria-label="Go to SIMBAD database in new tab"
                    colorPalette="teal"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    SIMBAD
                  </Link>
                  )
                </Field.HelperText>
              </Field.Root>
              <Button
                alignSelf="flex-start"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Show filters"
              >
                <LuSlidersHorizontal />
              </Button>
            </HStack>
            {/* Collapsible filters */}
            <Collapsible.Root open={showFilters}>
              <Collapsible.Content>
                <Box borderWidth="1px" padding={3} borderRadius="md">
                  <Text mb={3}>Missions</Text>
                  <HStack align="start" gap={3}>
                    {[
                      {
                        label: "TESS",
                        checked: tessChecked,
                        onChange: setTessChecked,
                      },
                      {
                        label: "Kepler",
                        checked: keplerChecked,
                        onChange: setKeplerChecked,
                      },
                      {
                        label: "K2",
                        checked: k2Checked,
                        onChange: setK2Checked,
                      },
                    ].map(({ label, checked, onChange }) => {
                      const isDisabled = checked && filterCount === 1;
                      return (
                        <Tooltip
                          key={label}
                          content="At least one mission must be selected"
                          disabled={!isDisabled}
                          openDelay={100}
                          portalled
                          positioning={{ placement: "bottom" }}
                        >
                          <Box display="inline-flex">
                            <Checkbox.Root
                              checked={checked}
                              onCheckedChange={(e) => onChange(!!e.checked)}
                              disabled={isDisabled}
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control />
                              <Checkbox.Label>{label}</Checkbox.Label>
                            </Checkbox.Root>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </HStack>
                </Box>
              </Collapsible.Content>
            </Collapsible.Root>
            {errorMessage && (
              <ErrorMsg
                message={errorMessage}
                onClose={() => setErrorMessage("")}
              />
            )}
          </VStack>
        </Box>
      </form>
      {loading && (
        <LoadingMessage
          msg={
            loadingLong
              ? "it's a big place..."
              : `Searching the Universe for ${searchTerm}...`
          }
          icon="pulsar"
          onCancel={cancelSearch}
        />
      )}
      <br />
      <PlotDialog
        open={plotOpen}
        setOpen={setPlotOpen}
        title={title}
        loadingPlot={loadingPlot}
        image={image}
      />
      {!searched && (
        <Box animation="fade-in 300ms ease-out">
          <Tabs.Root variant="outline" defaultValue="exoplanet">
            <HStack gap={5}>
              <Heading size="2xl" as="h2">
                Suggested
              </Heading>

              <Tabs.List>
                {Object.keys(categoryNames).map((category) => (
                  <Tabs.Trigger value={category} key={category} fontWeight='bold'>
                    {categoryNames[category]}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </HStack>
            {Object.keys(categoryNames).map((category) => (
              <Tabs.Content value={category} key={category}>
                <Stack
                  gap="4"
                  direction="row"
                  wrap="wrap"
                  justify={{ base: "center", md: "flex-start" }}
                >
                  {suggested.map(
                    (star) =>
                      star.category === category && (
                        <Card.Root
                          width="200px"
                          key={star.name}
                          variant="elevated"
                          _hover={{ transform: "scale(1.05)" }}
                          transition="transform 0.2s ease"
                          cursor="pointer"
                          onClick={() => handleClickSuggested(star)}
                        >
                          <Box
                            position="relative"
                            bg="black"
                            borderRadius="8px"
                          >
                            <img
                              src={getImage(category, ".svg")}
                              alt={`${star.name} star`}
                              style={{
                                width: "100%",
                                borderRadius: "8px",
                                display: "block",
                                animation: `twinkle ${randomRange(2, 3)}s infinite alternate`,
                              }}
                            />

                            <Box
                              position="absolute"
                              top="0.5rem"
                              left="0.5rem"
                              zIndex={10}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClickPlot(star);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleClickPlot(star);
                                }
                              }}
                            >
                              <Tooltip content="View plot">
                                <Button
                                  size="xs"
                                  tabIndex={0}
                                  aria-label={`View plot for ${star.name}`}
                                >
                                  <LuChartSpline />
                                </Button>
                              </Tooltip>
                            </Box>
                          </Box>

                          <Card.Body
                            tabIndex={0}
                            role="button"
                            aria-label={`Sonify ${star.name}: ${star.description}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleClickSuggested(star);
                              }
                            }}
                            mb="2"
                          >
                            <Card.Title mb="2">{star.name}</Card.Title>
                            <Card.Description>
                              {star.description}
                            </Card.Description>
                          </Card.Body>
                        </Card.Root>
                      ),
                  )}
                </Stack>
              </Tabs.Content>
            ))}
          </Tabs.Root>
          <br />
        </Box>
      )}
      {resultsReady && (
        <>
          <Heading ref={searchResultsRef}>
            Search results for {searchTerm}
          </Heading>
          <br />

          {/* Desktop/tablet: table */}
          <Box hideBelow="md" width="100%">
            <Table.Root size="md" interactive stickyHeader>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader fontWeight="bold">
                    Mission
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Exposure
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Pipeline
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Year
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Period
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Plot
                  </Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="bold">
                    Sonify
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {lightcurves.map((item: Lightcurve) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>{item.mission}</Table.Cell>
                    <Table.Cell>{item.exposure}</Table.Cell>
                    <Table.Cell>{item.pipeline}</Table.Cell>
                    <Table.Cell>{item.year}</Table.Cell>
                    <Table.Cell>{item.period}</Table.Cell>
                    <Table.Cell>
                      <PlotButton onClick={handleClickPlot} item={item} />
                    </Table.Cell>
                    <Table.Cell>
                      <SonifyButton
                        onClick={handleClickSonify}
                        dataURI={item.dataURI}
                        loading={item.dataURI === loadingId}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          {/* Mobile: stacked cards */}
          <VStack hideFrom="md" gap={3} width="100%" align="stretch">
            {lightcurves.map((item: Lightcurve) => (
              <Card.Root key={item.id} variant="outline" width="100%">
                <Card.Body>
                  <Stack gap={2}>
                    <HStack justify="space-between">
                      <Card.Title>{item.mission}</Card.Title>
                      <Text color="fg.muted" fontSize="sm">
                        {item.year}
                      </Text>
                    </HStack>

                    <SimpleGrid columns={2} gap={2} fontSize="sm">
                      <Box>
                        <Text color="fg.muted">Exposure</Text>
                        <Text>{item.exposure}</Text>
                      </Box>
                      <Box>
                        <Text color="fg.muted">Pipeline</Text>
                        <Text>{item.pipeline}</Text>
                      </Box>
                      <Box>
                        <Text color="fg.muted">Period</Text>
                        <Text>{item.period}</Text>
                      </Box>
                    </SimpleGrid>

                    <HStack gap={2} pt={2}>
                      <PlotButton onClick={handleClickPlot} item={item} />
                      <SonifyButton
                        onClick={handleClickSonify}
                        dataURI={item.dataURI}
                        loading={item.dataURI === loadingId}
                      />
                    </HStack>
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </>
      )}
    </PageContainer>
  );
}

import React, { useEffect, useState, createContext, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal, LuTelescope, LuUpload } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton } from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
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
  Text,
  IconButton,
  chakra,
  HStack
} from "@chakra-ui/react";

const soniType = 'light_curves'

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
}

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => { }
})

function capitaliseWords(str: string) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}


export default function Lightcurves() {

  // Instantiate navigation
  const navigate = useNavigate();

  // Set up states
  const [selectedStar, setSelectedStar] = useState("");
  const [lightcurves, setLightcurves] = useState([])
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [plotOpen, setPlotOpen] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false)
  const [loadingPlot, setLoadingPlot] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingId, setLoadingId] = useState("fake ID")

  const [showFilters, setShowFilters] = useState(false);
  const [tessChecked, setTessChecked] = useState(true);
  const [keplerChecked, setKeplerChecked] = useState(true);
  const [k2Checked, setK2Checked] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [dataReduced, setDataReduced] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | {
    dataRef: string;
    dataName: string;
    userUpload: boolean;
  }>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const [ra, setRa] = useState(null);
  const [dec, setDec] = useState(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelSearch = () => {
    if (abortControllerRef.current) {
      console.log("Cancelling search…")
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
  
  
  const searchLightcurves = async () => {

    if (!selectedStar.trim()) {
      setErrorMessage("Please enter a star name before searching.")
      return;
    }

    // Cancel any existing search
    cancelSearch();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMessage("");

    // Dictionary of search filters
    const filters = {
      "mission": {
        "TESS": tessChecked,
        "Kepler": keplerChecked,
        "K2": k2Checked
      }
    }

    const url_search = `${lightCurvesAPI}/search-lightcurves`
    const data = {
      "star_name": selectedStar,
      "filters": filters
    };

    try {
      const response = await apiRequest(
        url_search,
        data,
        'POST',
        { signal: controller.signal }
      );

      setLightcurves(response.results);
      setRa(response.ra);
      setDec(response.dec);
      console.log("ra: " + response.ra)
      console.log("dec: " + response.dec)

      console.log("Search results:", response.results);

    } catch (error: any) {

      console.log(error.name);

      if (error.name === 'AbortError') {
        console.log("Search cancelled by user")
        setSearched(false);
        return;
      }

      if (String(error).includes('Failed to fetch')) {
        error = 'Network error: Please check your internet connection or use a suggested dataset.'
      }

      setErrorMessage(String(error)); // Set error message to display
      setSearched(false)

    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  }


  const selectLightcurve = async (dataURI: string) => {
    // Call the API endpoint to select the lightcurve and get the filepath
    const url_selectlightcurve = `${lightCurvesAPI}/select-lightcurve/`;
    const data = { "data_uri": dataURI }
    try {
      const result = await apiRequest(url_selectlightcurve, data);
      console.log("Select Lightcurve API response:", result);
      return result.file_ref;
    } catch (error) {
      console.error("Error fetching sonification:", error);
    }
  }

  const handleFileAccept = async (files: FileList | File[]) => {

    setUploading(true);

    const file = files[0];

    if (!file) {
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${coreAPI}/upload-data/`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;

      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = errorData.detail;
        }
      } catch {
        // response was not JSON (ignore)
      }
      setUploading(false);
      throw new Error(message);
    }

    const result = await res.json()

    const navInfo = {
      dataRef: result.file_ref,
      dataName: file.name.split('.')[0],
      userUpload: true
    };

    setUploading(false);

    if (result.reduced) {
      setDataReduced(true);
      setPendingNav(navInfo);
      return
    }
    
    // Navigate to style page with data file path.
    navigate("/refine", { state: { ...navInfo, soniType } });
  };

  const handleConfirmReduced = () => {
    setDataReduced(false);

    if (pendingNav) {
      navigate("/refine", { state: { ...pendingNav, soniType } });
      setPendingNav(null);
    }
  };
  

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(capitaliseWords(selectedStar))
    setSearched(true);
    searchLightcurves();
  };

  const handleClickSonify = (dataURI: string) => {

    setLoadingId(dataURI);
    console.log("Sonify button clicked for star:", selectedStar);
    console.log("Data URI:", dataURI);
    // Call the select lightcurve function with the dataURI
    selectLightcurve(dataURI).then((dataRef) => {
      if (dataRef) {
        console.log("Lightcurve selected, file ref:", dataRef);
        // Navigate to the style page with the filepath and star name
        const dataName = searchTerm
        navigate('/refine', { state: { dataRef, dataName, soniType, ra, dec } });
      }
    });
  };

  const handleClickPlot = async (item: Lightcurve | SuggestedData) => {

    console.log("Plot button clicked for star:", selectedStar);

    let fileRef, plotTitle

    if ('dataURI' in item) {
      fileRef = item.dataURI
      plotTitle = `${item.period}, ${item.pipeline}, ${item.year}`
    }
    else {
      fileRef = item.fileRef
      plotTitle = item.name
    }

    setTitle(`Light Curve Graph for ${plotTitle}`);
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
      console.error("Error plotting light curve:", err)
    }
    finally {
      setLoadingPlot(false);
    }
  };

  const handleClickSuggested = (star: any) => {
    console.log("Star clicked:", star.name);
    const dataRef = star.fileRef;
    console.log('dataRef:' + dataRef)
    const dataName = star.name;
    const ra = star.ra;
    const dec = star.dec;

    navigate('/refine', { state: { dataRef, dataName, soniType, ra, dec } });
  };

  const handleCancelReduced = () => {
    setDataReduced(false);
    setPendingNav(null);

    // clear file upload
    setUploadKey((k) => k + 1);
  };

  const uploadDisabled = false

  return (
    <PageContainer>
      <Box as="main" role="main">
        <Dialog.Root
          open={dataReduced}
          onOpenChange={(e) => setDataReduced(e.open)}
          placement="center"
          motionPreset="slide-in-bottom"
          role="alertdialog"
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Multiple Columns Detected</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="start" gap={3}>
                  <Text>Your dataset contains more than two columns.</Text>
                  <Text>
                    This feature currently uses two columns (x and y) for
                    sonification.
                  </Text>
                  <Text>
                    Would you like to continue using the first two detected
                    columns?
                  </Text>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Flex justify="center" w="full" gap={3}>
                  <Dialog.ActionTrigger asChild>
                    <Button variant="outline" colorPalette="teal" onClick={handleCancelReduced}>
                      Cancel
                    </Button>
                  </Dialog.ActionTrigger>
                  <Button onClick={handleConfirmReduced} colorPalette="teal">
                    Continue
                  </Button>
                </Flex>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" onClick={handleCancelReduced}/>
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
        <Heading as="h1">
          Light Curves
        </Heading>
        <br />
        <Text textStyle="lg">
          Search for a specific star or choose from the suggestions below
        </Text>
        <br />
        <br />
        <form onSubmit={handleSubmit}>
          <Box display="flex" justifyContent="center">
            <VStack gap={4} width="50%">
              <HStack width="100%">
                <InputGroup
                  startElement={<LuTelescope size="1.1rem" />}
                  width="100%"
                >
                  <Input
                    placeholder="Search for a star by name, KIC or EPIC identifier"
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
                <Button
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
                      <Checkbox.Root
                        checked={tessChecked}
                        onCheckedChange={(e) => setTessChecked(!!e.checked)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>TESS</Checkbox.Label>
                      </Checkbox.Root>

                      <Checkbox.Root
                        checked={keplerChecked}
                        onCheckedChange={(e) => setKeplerChecked(!!e.checked)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>Kepler</Checkbox.Label>
                      </Checkbox.Root>

                      <Checkbox.Root
                        checked={k2Checked}
                        onCheckedChange={(e) => setK2Checked(!!e.checked)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>K2</Checkbox.Label>
                      </Checkbox.Root>
                    </HStack>
                  </Box>
                </Collapsible.Content>
              </Collapsible.Root>
              {errorMessage && <ErrorMsg message={errorMessage} />}
            </VStack>
          </Box>
        </form>
        {loading && (
          <LoadingMessage
            msg={`Searching the Universe for ${searchTerm}...`}
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
            <Heading size="2xl" as="h2">
              Suggested
            </Heading>
            <br />
            <Stack gap="4" direction="row" wrap="wrap">
              {suggested.map((star) => (
                <Card.Root
                  width="200px"
                  key={star.name}
                  variant="elevated"
                  _hover={{ transform: "scale(1.05)" }}
                  transition="transform 0.2s ease"
                  cursor="pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`Sonify ${star.name}: ${star.description}`}
                  onClick={() => handleClickSuggested(star)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClickSuggested(star);
                    }
                  }}
                >
                  <Box position="relative">
                    <img
                      src={getImage(star.name)}
                      alt={`${star.name} star`}
                      style={{ width: "100%", borderRadius: "8px" }}
                    />

                    <Box
                      position="absolute"
                      top="0.5rem"
                      left="0.5rem"
                      zIndex={10}
                      onClick={(e) => {
                        e.stopPropagation(); // prevent the card click
                        handleClickPlot(star);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation(); // prevent the card's keyboard handler
                          handleClickPlot(star);
                        }
                      }}
                    >
                      <Tooltip content="View plot">
                        <Button
                          size="xs"
                          aria-label={`View plot for ${star.name}`}
                        >
                          <LuChartSpline />
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Card.Body>
                    <Card.Title mb="2">{star.name}</Card.Title>
                    <Card.Description>{star.description}</Card.Description>
                  </Card.Body>
                </Card.Root>
              ))}
              <FileUpload.Root
                disabled={uploadDisabled}
                accept={{
                  "text/csv": [".csv"],
                  "application/fits": [".fits"],
                  "image/fits": [".fits"],
                }}
                key={uploadKey}
                maxFiles={1}
                maxFileSize={1e+7}
                w="200px"
                onFileAccept={({ files }) => handleFileAccept(files)}
                _hover={{ transform: "scale(1.05)" }}
                transition="transform 0.2s ease"
                cursor={uploadDisabled ? 'disabled' : 'pointer'}
                role="button"
                aria-label="Upload your data"
              >
                <FileUpload.HiddenInput />
                <FileUpload.Dropzone>
                  <Icon size="lg" color="fg.muted">
                    {uploading ?
                    <Spinner/> :
                    <LuUpload />
                    }
                  </Icon>
                  <FileUpload.DropzoneContent>
                    <Box textStyle="md">Upload your own</Box>
                    <Box color="fg.muted">.csv, .fits up to 10MB</Box>
                  </FileUpload.DropzoneContent>
                </FileUpload.Dropzone>
              </FileUpload.Root>
            </Stack>
            <br />
          </Box>
        )}
        {lightcurves.length > 0 && !loading && (
          <>
            <Heading>Search results for {searchTerm}:</Heading>
            <br />
            <Table.Root size="sm" interactive>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Mission</Table.ColumnHeader>
                  <Table.ColumnHeader>Exposure</Table.ColumnHeader>
                  <Table.ColumnHeader>Pipeline</Table.ColumnHeader>
                  <Table.ColumnHeader>Year</Table.ColumnHeader>
                  <Table.ColumnHeader>Period</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
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
          </>
        )}
      </Box>
    </PageContainer>
  );
}

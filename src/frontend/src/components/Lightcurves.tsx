import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import { FaEye } from "react-icons/fa";
import { HiSpeakerWave } from "react-icons/hi2";
import LoadingMessage from './LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines } from "react-icons/lu";

import {
  Box,
  Alert,
  Button,
  Card,
  LinkOverlay,
  Link,
  Image, 
  Input,
  Dialog,
  Stack,
  Heading,
  VStack,
  Table,
  Text,
  IconButton,
  chakra,
} from "@chakra-ui/react";

import { CloseIcon } from "@chakra-ui/icons";

interface Lightcurve {
  id: string;
  mission: string;
  exposure: number;
  pipeline: string;
  year: number;
  period: string;
  dataURI: string;
}

interface Variant {
  name: string;
  description: string;
  filepath: string;
}

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => {}
})


export default function Lightcurves() {
  const navigate = useNavigate();
  const [selectedStar, setSelectedStar] = useState("");
  const [lightcurves, setLightcurves] = useState([])
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false)
  const [loadingPlot, setLoadingPlot] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  useEffect(() => {
        fetch("http://localhost:8000/suggested-stars/")
            .then((res) => res.json())
            .then((data) => {
                setVariants(data);
                console.log(variants)
            })
            .catch((err) => {
                console.error("Failed to fetch presets:", err);
            });
    }, []);

  const searchLightcurves = async () => {

    if(!selectedStar.trim()) {
      setErrorMessage("Please enter a star name before searching.")
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const url_search = "http://localhost:8000/search-lightcurves"
    const data = {
      "star_name": selectedStar
    };
    const config = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };
    try {
      const response = await fetch(url_search, config);
      if (!response.ok) {
        //setErrorMessage("Error fetching lightcurves: " + response.formData);
        console.error(`Error ${response.status}: ${response.statusText}`);
        let errorDetail;
        try {
          const contentType = response.headers.get("Content-Type");

          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            console.error("Error details:", errorJson);
            errorDetail = errorJson;
          } else {
            const errorText = await response.text();
            console.error("Error details:", errorText);
            errorDetail = errorText;
          }
        } catch (e) {
          console.error("Failed to read error body:", e);
        }
        throw new Error(errorDetail.detail || "Unknown error");
      }
      const result = await response.json();
      setLightcurves(result.results);
      console.log("Search results:", result.results);
      setErrorMessage(result.details); // Clear any previous error messages
    } catch (error) {
      console.error("Error: " + error);
      setErrorMessage(String(error)); // Set error message to display
    } finally {
      setLoading(false)
    }
  }

  const plotLightcurve = async (dataURI: string) => {

    const url_plot = "http://localhost:8000/plot-lightcurve"
    const response = await fetch(url_plot, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 'data_uri': dataURI })
    });
    const plotData = await response.json();
    const image = plotData.image; // Assuming the response contains an image in base64 format
    // Handle the plot data as needed
    console.log("Data URI:", dataURI);
    console.log("Image:", image);
    console.log("src:", "data:image/png;base64,"+ image);
    return image; // Assuming the response contains an image in base64 format
  }

  const selectLightcurve = async (dataURI: string) => {
    // Call the API endpoint to select the lightcurve and get the filepath
    const url_selectlightcurve = "http://localhost:8000/select-lightcurve";
    const data = {
      "data_uri": dataURI
    }
    const config = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    }
    try {
      const response = await fetch(url_selectlightcurve, config);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const result = await response.json();
      console.log("Select Lightcurve API response:", result);
      return result.filepath;
    } catch (error) {
      console.error("Error fetching sonification:", error);
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(selectedStar)
    setSearched(true);
    searchLightcurves();
  };

  const handleClickSonify = (dataURI: string) => {
    // Handle the sonification logic here
    // For example, you can navigate to a sonification page or trigger a sonification function
    console.log("Sonify button clicked for star:", selectedStar);
    console.log("Data URI:", dataURI);
    // Call the select lightcurve function with the dataURI
    selectLightcurve(dataURI).then((filepath) => {
      if (filepath) {
        console.log("Lightcurve selected, filepath:", filepath);
        // Navigate to the sound page with the filepath
        navigate('/style', { state: filepath });
      }
    });
  };

  const handleClickPlot = async (item: Lightcurve) => {
  
    console.log("Plot button clicked for star:", selectedStar);
    console.log("Data URI:", item.dataURI);
    setLoadingPlot(true);
    try {
      setImage("");
      const image = await plotLightcurve(item.dataURI);

      if (image) {
        setImage("data:image/png;base64," + image);
        setTitle(`Lightcurve Graph for ${item.period}, ${item.pipeline}, ${item.year}`);
        setOpen(true);
        setLoadingPlot(false);
      }
    } catch (err) {
      console.error("Error plotting light curve:", err)
    }
  };

  const handleClickStar = (variant) => {
    console.log("Star clicked:", variant.name);
    const filepath = variant.filepath;
    navigate('/style', { state: filepath });
  };

  return (
    <Box width='80%' mx='auto'>
      <Heading size="4xl">Light Curves</Heading>
      <br />
      <Text textStyle="lg">Search for a specific star or choose from the suggestions below.</Text>
      <br />
      <br />
      <form onSubmit={handleSubmit}>
        <Box display="flex" justifyContent="center">
          <VStack gap={4} width="50%">
            <Input
              placeholder="Search for a star by name, KIC or EPIC identifier"
              type="text"
              name="star_name"
              value={selectedStar}
              onChange={ (e) => {
                const value = e.target.value;
                setSelectedStar(value);
                if (value.trim() === "") {
                  setSearched(false); 
                  setLightcurves([]);
                }
              }}
            />
            <Button type="submit" colorPalette="teal" width="100%">
              Search
            </Button>
            {errorMessage && (
              <Alert.Root status='error' animation="fade-in 300ms ease-out">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{errorMessage}</Alert.Title>
                </Alert.Content>
              </Alert.Root>
            )}
          </VStack>
        </Box>
      </form>
      {loading && <LoadingMessage msg={`Searching the Universe for ${searchTerm}...`} icon='pulsar'/>}
      <br />
      {!searched && (
        <Box animation="fade-in 300ms ease-out">
          <Heading size="2xl">Suggested</Heading>
          <br />
          <br />
          <Stack gap="4" direction="row" wrap="wrap">
            {variants.map((variant) => (
              <Card.Root width="200px" key={variant.name}>
                <LinkOverlay as={Link} onClick={() => {handleClickStar(variant)}}>
                  <img src={`/assets/${variant.name}.jpg`} alt={variant.name} style={{ width: "100%", borderRadius: "8px" }} />
                </LinkOverlay>
                <Card.Body gap="2">
                  <Card.Title mb="2">{variant.name}</Card.Title>
                  <Card.Description>{variant.description}</Card.Description>
                </Card.Body>
              </Card.Root>
            ))}
          </Stack>
          <br />
        </Box>
      )}
      {lightcurves.length > 0 && (
        <>
        <Heading>Search results for {searchTerm}:</Heading>
        <br />
        <Table.Root size="sm">
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
                  <Dialog.Root lazyMount open={open} onOpenChange={(details) => setOpen(details.open)}>
                    <Dialog.Trigger asChild>
                      <Button colorPalette="teal" onClick={() => handleClickPlot(item)}>
                        <LuChartSpline /> View Plot
                      </Button>
                    </Dialog.Trigger>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                      <Dialog.Content>
                        <Dialog.CloseTrigger asChild>
                          <IconButton size="sm"
                            variant="ghost"
                            position="absolute"
                            top="0.5rem"
                            right="0.5rem"
                            aria-label="Close">
                            <LuX />
                          </IconButton>
                        </Dialog.CloseTrigger>
                        <Dialog.Header>
                          <Dialog.Title>{title}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                          {loadingPlot ? (<LoadingMessage msg="" icon="pulsar"/>) : (<Image src={image} />)}
                        </Dialog.Body>                    
                      </Dialog.Content>
                    </Dialog.Positioner>
                  </Dialog.Root>
                </Table.Cell>
                <Table.Cell>
                  <Button colorPalette="teal" onClick={() => handleClickSonify(item.dataURI)}>
                    <LuAudioLines /> Sonify
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        </>
      )}
    </Box>
  )
}
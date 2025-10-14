import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton} from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
import { apiUrl } from "../../apiConfig";

import {
  Box,
  Alert,
  Button,
  Card,
  Checkbox,
  Collapsible,
  LinkOverlay,
  Link,
  Image,
  Field, 
  Input,
  InputGroup,
  Dialog,
  Stack,
  Heading,
  VStack,
  Table,
  Text,
  IconButton,
  chakra,
  HStack
} from "@chakra-ui/react";

 export interface Lightcurve {
  id: string;
  mission: string;
  exposure: number;
  pipeline: string;
  year: number;
  period: string;
  dataURI: string;
}

export interface Variant {
  name: string;
  description: string;
  filepath: string;
}

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => {}
})

function capitaliseWords(str: string) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

export const plotLightcurve = async (filepath: string) => {

  const url_plot = `${apiUrl}/plot-lightcurve`
  const response = await fetch(url_plot, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 'data_uri': filepath })
  });
  const plotData = await response.json();
  const image = plotData.image; 
  
  console.log("Data URI:", filepath);
  console.log("Image:", image);
  console.log("src:", "data:image/png;base64,"+ image);
  return image;
}



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
  const [loadingId, setLoadingId] = useState("fake ID")
  const [showFilters, setShowFilters] = useState(false);
  const [tessChecked, setTessChecked] = useState(true);
  const [keplerChecked, setKeplerChecked] = useState(true);
  const [k2Checked, setK2Checked] = useState(true);
  
  useEffect(() => {
        fetch(`${apiUrl}/suggested-stars/`)
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

    // Dictionary of search filters
    const filters = {
      "mission": {
        "TESS": tessChecked,
        "Kepler": keplerChecked,
        "K2": k2Checked
      }
    }

    const url_search = `${apiUrl}/search-lightcurves`
    const data = {
      "star_name": selectedStar,
      "filters": filters
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
      if (String(error).includes('Failed to fetch')) {
        error = 'Network error: Please check your internet connection or use a suggested dataset.'
      }
      setErrorMessage(String(error)); // Set error message to display
      setSearched(false)
    } finally {
      setLoading(false)
    }
  }

  

  const selectLightcurve = async (dataURI: string) => {
    // Call the API endpoint to select the lightcurve and get the filepath
    const url_selectlightcurve = `${apiUrl}/select-lightcurve`;
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
    setSearchTerm(capitaliseWords(selectedStar))
    setSearched(true);
    searchLightcurves();
  };

  const handleClickSonify = (dataURI: string) => {

    setLoadingId(dataURI);
    console.log("Sonify button clicked for star:", selectedStar);
    console.log("Data URI:", dataURI);
    // Call the select lightcurve function with the dataURI
    selectLightcurve(dataURI).then((filepath) => {
      if (filepath) {
        console.log("Lightcurve selected, filepath:", filepath);
        // Navigate to the style page with the filepath
        navigate('/style', { state: filepath });
      }
    });
  };

  const handleClickPlot = async (item: Lightcurve | Variant) => {

    console.log("Plot button clicked for star:", selectedStar);

    let filepath, plotTitle

    if ('dataURI' in item) {
      filepath = item.dataURI
      plotTitle = `${item.period}, ${item.pipeline}, ${item.year}`
    }
    else {
      filepath = item.filepath
      plotTitle = item.name
    }
    
    setTitle(`Light Curve Graph for ${plotTitle}`);
    setLoadingPlot(true);
    setOpen(true);
    
    try {
      setImage("");
      const image = await plotLightcurve(filepath);

      if (image) {
        setImage("data:image/png;base64," + image);
        setLoadingPlot(false);
      }
    } catch (err) {
      console.error("Error plotting light curve:", err)
    }
    finally{
      setLoadingPlot(false); 
    }
  };

  const handleClickStar = (variant: any) => {
    console.log("Star clicked:", variant.name);
    const filepath = variant.filepath;
    navigate('/style', { state: filepath });
  };

  return (
    <PageContainer>
      <Box as='main' role="main">
        <Heading size="4xl">Light Curves</Heading>
        <br />
        <Text textStyle="lg">Search for a specific star or choose from the suggestions below.</Text>
        <br />
        <br />
        <form onSubmit={handleSubmit}>
          <Box display="flex" justifyContent="center">
            <VStack gap={4} width="50%">
              <HStack width='100%'>
                <InputGroup startElement={<LuSearch />} width='100%'>
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
                </InputGroup>
                <Button
                  variant='outline' 
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="Show filters"
                  >
                    <LuSlidersHorizontal/>
                </Button>
              </HStack>
              {/* Collapsible filters */}
              <Collapsible.Root open={showFilters}>
                <Collapsible.Content>
                  <Box borderWidth='1px' padding={3} borderRadius="md">
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
              {errorMessage && <ErrorMsg message={errorMessage}/>}
            </VStack>
          </Box>
        </form>
        {loading && <LoadingMessage msg={`Searching the Universe for ${searchTerm}...`} icon='pulsar'/>}
        <br />
        <PlotDialog 
                      open={open}
                      setOpen={setOpen}
                      title={title}
                      loadingPlot={loadingPlot}
                      image={image}
        />
        {!searched && (
          <Box animation="fade-in 300ms ease-out">
            <Heading size="2xl">Suggested</Heading>
            <br />
            <br />
            <Stack gap="4" direction="row" wrap="wrap">
              {variants.map((variant) => (
                <Card.Root
                width="200px" 
                key={variant.name} 
                variant='elevated' 
                _hover={{transform: "scale(1.05)"}} 
                transition="transform 0.2s ease"
                cursor='pointer'
                tabIndex={0}
                role="button"
                aria-label={`Sonify ${variant.name}: ${variant.description}`}
                onClick={() => handleClickStar(variant)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClickStar(variant);
                  }
                }}>
                  <Box position="relative">
                      <img
                        src={getImage(variant.name)}
                        alt={`${variant.name} star`}
                        style={{ width: "100%", borderRadius: "8px" }}
                      />
                  
                    <Box
                      position="absolute"
                      top="0.5rem"
                      left="0.5rem"
                      zIndex={10}
                      onClick={(e) => {
                        e.stopPropagation() // prevent the card click
                        handleClickPlot(variant)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation(); // prevent the card's keyboard handler
                          handleClickPlot(variant);
                        }
                      }}
                    >
                      <Tooltip content='View plot'>
                        <Button 
                          colorPalette='gray' 
                          variant='solid' 
                          size='xs'
                          aria-label={`View plot for ${variant.name}`}
                        >
                          <LuChartSpline/>
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Card.Body>
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
                    <PlotButton onClick={handleClickPlot} item={item}/>
                  </Table.Cell>
                  <Table.Cell>
                    <SonifyButton onClick={handleClickSonify} dataURI={item.dataURI} loading={item.dataURI === loadingId}/>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          </>
        )}
      </Box>
    </PageContainer>
  )
}
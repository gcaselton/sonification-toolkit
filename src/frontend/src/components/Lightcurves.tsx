import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import { FaEye } from "react-icons/fa";
import { HiSpeakerWave } from "react-icons/hi2";
import {
  Box,
  Button,
  Card,
  LinkOverlay,
  Link,
  Image, 
  Input,
  Dialog,
  Stack,
  VStack,
  Table,
  IconButton,
} from "@chakra-ui/react";

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

//const variants = ["Pleonie", "Merope", "Beta Persei", "Sirius"] as const;


//var selected_star = "HD 12345"; // This can be dynamic based on user selection

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => {}
})

//const { openSidebar, openModal } = useAppContext();

export default function Lightcurves() {
  const navigate = useNavigate();
  const [selectedStar, setSelectedStar] = useState("HD 12345");
  const [lightcurves, setLightcurves] = useState([])
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
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
        throw new Error("Network response was not ok");
      }
      const result = await response.json();
      setLightcurves(result.results);
      console.log("Search results:", result.results);
    } catch (error) {
      console.error("Error fetching lightcurves:", error);
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
        navigate('/sound', { state: filepath });
      }
    });
  };

  const handleClickPlot = (item: Lightcurve) => {
    // Handle the plot logic here
    console.log("Plot button clicked for star:", selectedStar);
    console.log("Data URI:", item.dataURI);
    plotLightcurve(item.dataURI).then((image) => {
      if (image) {
        console.log("Lightcurve plotted, image:", image);
        // You can display the image in a modal or a new page
        setImage("data:image/png;base64," + image);
        setTitle(`Lightcurve Graph for ${item.period}, ${item.pipeline}, ${item.year}`);
        // Open the dialog/modal to show the image
        setOpen(true);
      }
    });
  };

  const handleClickStar = (variant) => {
    console.log("Star clicked:", variant.name);
    const filepath = variant.filepath;
    navigate('/sound', { state: filepath });
  };

  return (
    <Box>
      <h1>Lightcurves</h1>
      <br />
      <h4>Search for a specific star or choose from the suggestions below</h4>
      <br />
      <br />
      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input
            placeholder="Search for a star"
            type="text"
            name="star_name"
            defaultValue={selectedStar}
            onChange={(e) => setSelectedStar(e.target.value)}
          />
          <Button type="submit" colorScheme="blue" width="100%">
            Submit
          </Button>
        </VStack>
      </form>
      <br />
      <h2>Suggested</h2>
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
      <h2>Selected Star: {selectedStar}</h2>
      <br />
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Mission</Table.ColumnHeader>
            <Table.ColumnHeader>Exposure</Table.ColumnHeader>
            <Table.ColumnHeader>Pipeline</Table.ColumnHeader>
            <Table.ColumnHeader>Year</Table.ColumnHeader>
            <Table.ColumnHeader>Period</Table.ColumnHeader>
            <Table.ColumnHeader>Graph</Table.ColumnHeader>
            <Table.ColumnHeader>Sonify</Table.ColumnHeader>
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
                    <IconButton aria-label="eye" icon={<FaEye />} colorScheme="blue" onClick={() => handleClickPlot(item)} />
                  </Dialog.Trigger>
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content>
                      <Dialog.CloseTrigger />
                      <Dialog.Header>
                        <Dialog.Title />
                        {title}
                      </Dialog.Header>
                      <Dialog.Body>
                        <Image src={image} />
                      </Dialog.Body>                    
                      <Dialog.Footer />
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Root>
              </Table.Cell>
              <Table.Cell><IconButton aria-label="speaker" icon={<HiSpeakerWave />} colorScheme="blue" onClick={() => handleClickSonify(item.dataURI)} /></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Image, 
  Input,
  Dialog,
  Stack,
  VStack,
  Table,
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

const variants = ["Pleonie", "Merope", "Beta Persei", "Sirius"] as const;

//var selected_star = "HD 12345"; // This can be dynamic based on user selection

const LightcurvesContext = createContext({
  lightcurves: [], fetchLightcurves: () => {}
})

//const { openSidebar, openModal } = useAppContext();

export default function Lightcurves() {
  const navigate = useNavigate();
  const [selectedStar, setSelectedStar] = useState("HD 12345");
  const [lightcurves, setLightcurves] = useState([])
  const [plots, setPlots] = useState([])
  const url_search = "http://localhost:8000/search-lightcurves"
  const url_plot = "http://localhost:8000/plot-lightcurve"
  const data = {
    "star_name": selectedStar
  }
  const config = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }
  const fetchLightcurves = async () => {
    const response = await fetch(url_search, config)
    const lc = await response.json()
    setLightcurves(lc.results)
  }
  useEffect(() => {
    fetchLightcurves()
  }, [])

  /*const fetchPlots = async () => {
    for (const lightcurve of lightcurves) {
      const image = await plotLightcurve(lightcurve.dataURI);
      lightcurve.image = image; // Add the image to the lightcurve object
    }
    const response = await fetch(url_plot, config)
    const plots = await response.json()
    setPlots(plots.results)
  }*/

  const plotLightcurve = async (dataURI: string) => {

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchLightcurves();
  };

  const handleClick = (dataURI: string) => {
    // Handle the sonification logic here
    // For example, you can navigate to a sonification page or trigger a sonification function
    console.log("Sonify button clicked for star:", selectedStar);
    navigate('/sonification', { state: dataURI });
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
          <Card.Root width="200px" key={variant}>
            <img src={`/assets/${variant}.jpg`} alt={variant} style={{ width: "100%", borderRadius: "8px" }} />
            <Card.Body gap="2">
              <Card.Title mb="2">{variant}</Card.Title>
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
                <Dialog.Root>
                  <Dialog.Trigger />
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content>
                      <Dialog.CloseTrigger />
                      <Dialog.Header>
                        <Dialog.Title />
                        Lightcurve Graph for {item.period}, {item.pipeline}, {item.year}
                      </Dialog.Header>
                      <Dialog.Body />
                      <Image src={`data:image/png;base64,${plotLightcurve(item.dataURI)}`} />                      
                      <Dialog.Footer />
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Root>
              </Table.Cell>
              <Table.Cell><Button onClick={() => handleClick(item.dataURI)}>Sonify</Button></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
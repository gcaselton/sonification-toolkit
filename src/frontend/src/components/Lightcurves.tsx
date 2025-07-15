import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Input,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Stack,
  VStack,
  Table,
  Text,
  DialogActionTrigger,
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
  const [selectedStar, setSelectedStar] = useState("HD 12345");
  const [lightcurves, setLightcurves] = useState([])
  const url = "http://localhost:8000/search-lightcurves"
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
    const response = await fetch(url, config)
    const lc = await response.json()
    setLightcurves(lc.results)
  }
  useEffect(() => {
    fetchLightcurves()
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchLightcurves();
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
              <Table.Cell><Button>Graph</Button></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
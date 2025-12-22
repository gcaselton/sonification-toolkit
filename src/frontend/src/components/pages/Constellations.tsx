import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal, LuTelescope } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton} from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
import { apiUrl, coreAPI, constellationsAPI } from "../../apiConfig";
import { SuggestedData } from "./Lightcurves";

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
  HStack,
  Combobox,
  useListCollection,
  useFilter,
  Portal
} from "@chakra-ui/react";


function capitaliseWords(str: string) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

export const constellations = [
  { label: "Pisces", value: "Pisces" },
  { label: "Cetus", value: "Cetus" },
  { label: "Andromeda", value: "Andromeda" },
  { label: "Phoenix", value: "Phoenix" },
  { label: "Pegasus", value: "Pegasus" },
  { label: "Sculptor", value: "Sculptor" },
  { label: "Cassiopeia", value: "Cassiopeia" },
  { label: "Octans", value: "Octans" },
  { label: "Cepheus", value: "Cepheus" },
  { label: "Tucana", value: "Tucana" },
  { label: "Hydrus", value: "Hydrus" },
  { label: "Ursa Minor", value: "Ursa Minor" },
  { label: "Eridanus", value: "Eridanus" },
  { label: "Perseus", value: "Perseus" },
  { label: "Triangulum", value: "Triangulum" },
  { label: "Fornax", value: "Fornax" },
  { label: "Aries", value: "Aries" },
  { label: "Horologium", value: "Horologium" },
  { label: "Reticulum", value: "Reticulum" },
  { label: "Camelopardalis", value: "Camelopardalis" },
  { label: "Mensa", value: "Mensa" },
  { label: "Taurus", value: "Taurus" },
  { label: "Dorado", value: "Dorado" },
  { label: "Caelum", value: "Caelum" },
  { label: "Pictor", value: "Pictor" },
  { label: "Auriga", value: "Auriga" },
  { label: "Orion", value: "Orion" },
  { label: "Lepus", value: "Lepus" },
  { label: "Columba", value: "Columba" },
  { label: "Monoceros", value: "Monoceros" },
  { label: "Gemini", value: "Gemini" },
  { label: "Carina", value: "Carina" },
  { label: "Puppis", value: "Puppis" },
  { label: "Canis Major", value: "Canis Major" },
  { label: "Lynx", value: "Lynx" },
  { label: "Volans", value: "Volans" },
  { label: "Canis Minor", value: "Canis Minor" },
  { label: "Chamaeleon", value: "Chamaeleon" },
  { label: "Cancer", value: "Cancer" },
  { label: "Vela", value: "Vela" },
  { label: "Ursa Major", value: "Ursa Major" },
  { label: "Hydra", value: "Hydra" },
  { label: "Pyxis", value: "Pyxis" },
  { label: "Leo", value: "Leo" },
  { label: "Leo Minor", value: "Leo Minor" },
  { label: "Draco", value: "Draco" },
  { label: "Antlia", value: "Antlia" },
  { label: "Sextans", value: "Sextans" },
  { label: "Crater", value: "Crater" },
  { label: "Centaurus", value: "Centaurus" },
  { label: "Musca", value: "Musca" },
  { label: "Virgo", value: "Virgo" },
  { label: "Crux", value: "Crux" },
  { label: "Corvus", value: "Corvus" },
  { label: "Coma Berenices", value: "Coma Berenices" },
  { label: "Canes Venatici", value: "Canes Venatici" },
  { label: "Boötes", value: "Boötes" },
  { label: "Circinus", value: "Circinus" },
  { label: "Apus", value: "Apus" },
  { label: "Lupus", value: "Lupus" },
  { label: "Libra", value: "Libra" },
  { label: "Triangulum Australe", value: "Triangulum Australe" },
  { label: "Serpens", value: "Serpens" },
  { label: "Norma", value: "Norma" },
  { label: "Corona Borealis", value: "Corona Borealis" },
  { label: "Scorpius", value: "Scorpius" },
  { label: "Hercules", value: "Hercules" },
  { label: "Ophiuchus", value: "Ophiuchus" },
  { label: "Ara", value: "Ara" },
  { label: "Pavo", value: "Pavo" },
  { label: "Sagittarius", value: "Sagittarius" },
  { label: "Corona Australis", value: "Corona Australis" },
  { label: "Telescopium", value: "Telescopium" },
  { label: "Lyra", value: "Lyra" },
  { label: "Scutum", value: "Scutum" },
  { label: "Aquila", value: "Aquila" },
  { label: "Sagitta", value: "Sagitta" },
  { label: "Vulpecula", value: "Vulpecula" },
  { label: "Cygnus", value: "Cygnus" },
  { label: "Capricornus", value: "Capricornus" },
  { label: "Delphinus", value: "Delphinus" },
  { label: "Microscopium", value: "Microscopium" },
  { label: "Indus", value: "Indus" },
  { label: "Aquarius", value: "Aquarius" },
  { label: "Equuleus", value: "Equuleus" },
  { label: "Piscis Austrinus", value: "Piscis Austrinus" },
  { label: "Grus", value: "Grus" },
  { label: "Lacerta", value: "Lacerta" }
];

export default function Constellations() {

  const soniType = 'constellations'
  
  const navigate = useNavigate();
  
  const [suggested, setSuggested] = useState<SuggestedData[]>([])
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingId, setLoadingId] = useState("fake ID")

  
  useEffect(() => {
        fetch(`${coreAPI}/suggested-data/${soniType}/`)
            .then((res) => res.json())
            .then((data) => {
                setSuggested(data);
                console.log(suggested)
            })
            .catch((err) => {
                console.error("Failed to fetch suggested data:", err);
            });
    }, []
  );

  const handleSelectConstellation = (constellationName: string) => {
    if (!constellationName) return;

    console.log("Constellation clicked:", constellationName);
    const dataName = constellationName
    const dataFilepath = ""
    
    navigate('/refine', { 
      state: { dataName, soniType, dataFilepath } // Navigate to step 2
    });
  };

  // Generate a random time for each twinkle animation to make each unique
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
  
  // Needed to use ComboBox search/filter
  const { contains } = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({
    initialItems: constellations,
    filter: contains,
  })


  return (
    <PageContainer>
      <Box as='main' role="main">
        <Heading size="4xl" as='h1'>Constellations</Heading>
        <br />
        <Text textStyle="lg">Search for a specific constellation or choose from the suggestions below.</Text>
        <br />
        <br />
        <Box display="flex" justifyContent="center">
          <Combobox.Root
            collection={collection}
            onInputValueChange={(e) => filter(e.inputValue)}
            onValueChange={(details) => {
              if (details.value.length > 0) {
                setTimeout(() => { // short delay
                  handleSelectConstellation(details.value[0]);
                }, 300); 
              }
            }}
            width="50%"
          >
            <Combobox.Control>
              <InputGroup startElement={<LuTelescope size="1.1rem"/>}>
                <Combobox.Input placeholder="Search for a constellation" />
              </InputGroup>
              <Combobox.IndicatorGroup>
                <Combobox.ClearTrigger />
                <Combobox.Trigger />
              </Combobox.IndicatorGroup>
            </Combobox.Control>
            <Portal>
              <Combobox.Positioner>
                <Combobox.Content>
                  <Combobox.Empty>No items found</Combobox.Empty>
                  {collection.items.map((item) => (
                    <Combobox.Item item={item} key={item.value}>
                      {item.label}
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))}
                </Combobox.Content>
              </Combobox.Positioner>
            </Portal>
          </Combobox.Root>
        </Box>
        <br />
        <br />
        <Box animation="fade-in 300ms ease-out">
        <Heading size="2xl" as='h2'>Suggested</Heading>
        <br />
        <Stack gap="4" direction="row" wrap="wrap">
                      {suggested.map((suggestion) => (
                        <Card.Root
                        width="200px" 
                        key={suggestion.name} 
                        variant='elevated' 
                        _hover={{transform: "scale(1.05)"}} 
                        transition="transform 0.2s ease"
                        cursor='pointer'
                        tabIndex={0}
                        role="button"
                        aria-label={`Sonify ${suggestion.name}: ${suggestion.description}`}
                        onClick={() => handleSelectConstellation(suggestion.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectConstellation(suggestion.name);
                          }
                        }}>
                          <Box position="relative" bg="black" borderRadius="8px" overflow="hidden">
                              <img
                                src={getImage(suggestion.name, '.png')}
                                alt={`${suggestion.name} constellation`}
                                style={{ 
                                  width: "100%", 
                                  display: "block",
                                  animation: `twinkle ${randomRange(2, 3)}s infinite alternate`,
                                  }}
                              />
                          
                          </Box>
                          <Card.Body>
                            <Card.Title mb="2">{suggestion.name}</Card.Title>
                            <Card.Description>{suggestion.description}</Card.Description>
                          </Card.Body>
                        </Card.Root>
                      ))}
                    </Stack>
                    <br />
                  </Box>           
        
      </Box>
    </PageContainer>
  )
}
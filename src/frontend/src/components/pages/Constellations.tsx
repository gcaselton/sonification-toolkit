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
  { label: "Pisces", value: "Psc" },
  { label: "Cetus", value: "Cet" },
  { label: "Andromeda", value: "And" },
  { label: "Phoenix", value: "Phe" },
  { label: "Pegasus", value: "Peg" },
  { label: "Sculptor", value: "Scl" },
  { label: "Cassiopeia", value: "Cas" },
  { label: "Octans", value: "Oct" },
  { label: "Cepheus", value: "Cep" },
  { label: "Tucana", value: "Tuc" },
  { label: "Hydrus", value: "Hyi" },
  { label: "Ursa Minor", value: "UMi" },
  { label: "Eridanus", value: "Eri" },
  { label: "Perseus", value: "Per" },
  { label: "Triangulum", value: "Tri" },
  { label: "Fornax", value: "For" },
  { label: "Aries", value: "Ari" },
  { label: "Horologium", value: "Hor" },
  { label: "Reticulum", value: "Ret" },
  { label: "Camelopardalis", value: "Cam" },
  { label: "Mensa", value: "Men" },
  { label: "Taurus", value: "Tau" },
  { label: "Dorado", value: "Dor" },
  { label: "Caelum", value: "Cae" },
  { label: "Pictor", value: "Pic" },
  { label: "Auriga", value: "Aur" },
  { label: "Orion", value: "Ori" },
  { label: "Lepus", value: "Lep" },
  { label: "Columba", value: "Col" },
  { label: "Monoceros", value: "Mon" },
  { label: "Gemini", value: "Gem" },
  { label: "Carina", value: "Car" },
  { label: "Puppis", value: "Pup" },
  { label: "Canis Major", value: "CMa" },
  { label: "Lynx", value: "Lyn" },
  { label: "Volans", value: "Vol" },
  { label: "Canis Minor", value: "CMi" },
  { label: "Chamaeleon", value: "Cha" },
  { label: "Cancer", value: "Cnc" },
  { label: "Vela", value: "Vel" },
  { label: "Ursa Major", value: "UMa" },
  { label: "Hydra", value: "Hya" },
  { label: "Pyxis", value: "Pyx" },
  { label: "Leo", value: "Leo" },
  { label: "Leo Minor", value: "LMi" },
  { label: "Draco", value: "Dra" },
  { label: "Antlia", value: "Ant" },
  { label: "Sextans", value: "Sex" },
  { label: "Crater", value: "Crt" },
  { label: "Centaurus", value: "Cen" },
  { label: "Musca", value: "Mus" },
  { label: "Virgo", value: "Vir" },
  { label: "Crux", value: "Cru" },
  { label: "Corvus", value: "Crv" },
  { label: "Coma Berenices", value: "Com" },
  { label: "Canes Venatici", value: "CVn" },
  { label: "Boötes", value: "Boo" },
  { label: "Circinus", value: "Cir" },
  { label: "Apus", value: "Aps" },
  { label: "Lupus", value: "Lup" },
  { label: "Libra", value: "Lib" },
  { label: "Triangulum Australe", value: "TrA" },
  { label: "Serpens", value: "Ser" },
  { label: "Norma", value: "Nor" },
  { label: "Corona Borealis", value: "CrB" },
  { label: "Scorpius", value: "Sco" },
  { label: "Hercules", value: "Her" },
  { label: "Ophiuchus", value: "Oph" },
  { label: "Ara", value: "Ara" },
  { label: "Pavo", value: "Pav" },
  { label: "Sagittarius", value: "Sgr" },
  { label: "Corona Australis", value: "CrA" },
  { label: "Telescopium", value: "Tel" },
  { label: "Lyra", value: "Lyr" },
  { label: "Scutum", value: "Sct" },
  { label: "Aquila", value: "Aql" },
  { label: "Sagitta", value: "Sge" },
  { label: "Vulpecula", value: "Vul" },
  { label: "Cygnus", value: "Cyg" },
  { label: "Capricornus", value: "Cap" },
  { label: "Delphinus", value: "Del" },
  { label: "Microscopium", value: "Mic" },
  { label: "Indus", value: "Ind" },
  { label: "Aquarius", value: "Aqr" },
  { label: "Equuleus", value: "Equ" },
  { label: "Piscis Austrinus", value: "PsA" },
  { label: "Grus", value: "Gru" },
  { label: "Lacerta", value: "Lac" }
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
        <Heading size="4xl">Constellations</Heading>
        <br />
        <Text textStyle="lg">Search for a specific constellation or choose from the suggestions below.</Text>
        <br />
        <br />
        <Box display="flex" justifyContent="center">
          <Combobox.Root
            collection={collection}
            onInputValueChange={(e) => filter(e.inputValue)}
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
        <Heading size="2xl">Suggested</Heading>
        <br />
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
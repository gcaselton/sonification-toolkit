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
  HStack
} from "@chakra-ui/react";


function capitaliseWords(str: string) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

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
    }, []);

  
  const handleClickSuggested = (suggestion: any) => {
    console.log("Suggestion clicked:", suggestion.name);
    const dataName = suggestion.name
    navigate('/refine', { state: { dataName, soniType }});
  };

  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;


  return (
    <PageContainer>
      <Box as='main' role="main">
        <Heading size="4xl">Constellations</Heading>
        <br />
        <Text textStyle="lg">Search for a specific constellation or choose from the suggestions below.</Text>
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
                        onClick={() => handleClickSuggested(suggestion)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickSuggested(suggestion);
                          }
                        }}>
                          <Box position="relative" bg="black" borderRadius="8px" overflow="hidden">
                              <img
                                src={getImage(suggestion.name, '.png')}
                                alt={`${suggestion.name} constellation`}
                                style={{ 
                                  width: "100%", 
                                  display: "block",
                                  animation: `twinkle ${randomRange(1.5, 3)}s infinite alternate`,
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
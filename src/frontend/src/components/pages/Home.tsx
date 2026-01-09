import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { Upload } from "lucide-react";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton } from "../ui/Buttons";
import { getImage } from "../../utils/assets";
import { Tooltip } from "../ui/Tooltip";

import {
  Box,
  Alert,
  Button,
  Card,
  FileUpload,
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
  HStack,
} from "@chakra-ui/react";
import { apiUrl } from "../../apiConfig";


interface AstroType {
  name: string;
  description: string;
  page: string
}

const astroTypes: AstroType[] = [
    {
        name: 'Light Curves',
        description: "Listen to fluctuations in a star's light.",
        page: '/light-curves'
    },
    {
        name: 'Constellations',
        description: 'Hear the brightest stars in the night sky appearing.',
        page: '/constellations'
    },
    {
        name: 'Planets',
        description: 'Hear a planetary system orbit around you.',
        page: '/'
    },
    {
        name: 'Black Holes',
        description: 'Experience the intangible.',
        page: '/'
    },
    {
        name: 'Gravity',
        description: 'Listen to gravitational wave events.',
        page: '/'
    }
]


export default function Lightcurves() {
  const navigate = useNavigate();

  const handleFileAccept = async (files: FileList | File[]) => {
    
    const file = files[0]
    if (!file) return;

    console.log("Uploading:", file.name);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiUrl}/upload-data/`, {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    console.log(result);

    // Naviagate to style page with data file path.
    navigate('/style', { state: result.filepath });
  }

  return (
    <PageContainer hideBackButton>
      <Box as='main' role="main">
        <Heading size="4xl" as='h1'>Step 1: Data</Heading>
        <br />
        <HStack flexWrap="nowrap">
            <Text textStyle="lg" flexShrink={1}>Select a data source to sonify, or </Text>
            
            <FileUpload.Root disabled accept=".csv, .fits" w="auto" onFileAccept={({ files }) => handleFileAccept(files)}>
              <FileUpload.HiddenInput />
              <Tooltip content='Coming soon!' openDelay={300}>
              <FileUpload.Trigger asChild>
                <Tooltip content="Coming soon!" openDelay={300}>
                  <Button colorPalette='teal' disabled>
                      <Upload />Upload your own
                  </Button>
                </Tooltip>
              </FileUpload.Trigger>
              </Tooltip>
              <FileUpload.List />
            </FileUpload.Root>
        </HStack>
        <br />
        <br />
        <Stack gap="4" direction="row" wrap="wrap" animation="fade-in 300ms ease-out">
              {astroTypes.map((astroType) => (
                <Tooltip content='Coming soon!' openDelay={300} disabled={astroType.page !== '/'}>
                <Card.Root 
                  width="200px" 
                  key={astroType.name} 
                  variant='elevated'
                  _hover={{transform: "scale(1.05)"}} 
                  transition="transform 0.2s ease"
                  >
                  <LinkOverlay 
                    as={Link} 
                    onClick={() => navigate(astroType.page)} 
                    cursor={astroType.page === '/' ? 'disabled' : 'pointer'}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(astroType.page);
                      }
                    }}
                    >
                    <img 
                    src={getImage(astroType.name)} 
                    alt={astroType.name} 
                    style={{ width: "100%", height: '200px', objectFit: 'cover', borderRadius: "8px" }} />
                  </LinkOverlay>
                  <Card.Body>
                    <Card.Title mb="2">{astroType.name}</Card.Title>
                    <Card.Description>{astroType.description}</Card.Description>
                  </Card.Body>
                </Card.Root>
                </Tooltip>
              ))}
        </Stack>
      </Box>
    </PageContainer>
  )
}
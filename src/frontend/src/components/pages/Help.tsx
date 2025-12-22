import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton } from "../ui/Buttons";

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
  List,
  Highlight,
  Heading,
  VStack,
  Table,
  Text,
  IconButton,
  chakra,
} from "@chakra-ui/react";






export default function Help() {
  const navigate = useNavigate();
 

  return (
    <PageContainer hideBackButton showHome>
      <Box as="main" role="main">
        <Heading size="4xl" as='h1'>Help</Heading>
        <br />
        <Text textStyle='lg'>
            Welcome to the Sonification Toolkit! Here you’ll find help and guidance for using the app.
        </Text>
        <br />

        <Heading size="2xl" mb={3} as='h2'>Step 1: Data</Heading>
        <List.Root as='ol' mb={6} textStyle='lg' gap={2}>
            <List.Item>Use the search bar to enter the name, KIC or EPIC identifier of a star. Alternatively, select a suggested light curve.</List.Item>
            <List.Item>If the star you searched for was captured in the TESS or Kepler/K2 missions, a list of light curves will display.</List.Item>
            <List.Item>
                Click the <PlotButton dummy/> button on a row to see a light curve as a graph.
            </List.Item>
            <List.Item>
                When you have found a light curve you wish to sonify, click the <SonifyButton dummy/> button on that row.
            </List.Item>
        </List.Root>

        <Heading size="2xl" mb={3} as='h2'>Step 2: Style</Heading>
        <Text textStyle='lg' mb={2}>The <b>Style</b> of a sonification is a combination of 3 elements: </Text>
        <List.Root mb={4} textStyle='lg' gap={1}>
            <List.Item>The base sound (or instrument) that is played.</List.Item>
            <List.Item>The characteristics of the sound (parameters) that are controlled by the data.</List.Item>
            <List.Item>Any musical elements, such as chords or scales.</List.Item>
        </List.Root>
        <Text textStyle='lg' mb={2}>Some preset styles have been provided for you to get started quickly, or you can click <b>Custom</b> to configure your own.</Text>
        <Text textStyle='lg' mb={6}>When configuring a custom style, you'll notice some of the base sounds have a 🎹 icon next to them. This indicates they are 'composable', which means they can be used with musical chords and scales.</Text>

        <Heading size="2xl" mb={3} as='h2'>Step 3: Sonify</Heading>
        <List.Root as='ol' mb={6} textStyle='lg' gap={2}>
            <List.Item>Enter how long you want the sonification to last for (in seconds).</List.Item>
            <List.Item>Choose the sound system which you intend to play the sonification on. This will render the audio with the right number of channels.</List.Item>
            <List.Item>Click <Button 
                              size='xs'
                              colorPalette='teal'
                              pointerEvents='none'
                              cursor='auto'>Generate</Button> to create the audio file.</List.Item>
            <List.Item>Once generated, a media player will appear. Click the play button to hear the sonification, or click the 3 dots on the right of the media player to download as a WAV file.</List.Item>
        </List.Root>
      </Box>
    </PageContainer>
  )
}
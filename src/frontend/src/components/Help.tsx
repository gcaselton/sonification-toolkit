import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from './LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines } from "react-icons/lu";
import PageContainer from "./PageContainer";
import { SonifyButton, PlotButton } from "./Buttons";

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
    <PageContainer>
      <Box>
        <Heading size="4xl">Help</Heading>
        <br />
        <Text textStyle='lg'>
            Welcome to the Sonification Toolkit! Here you’ll find answers, tips, and guidance for using the app.
        </Text>
        <br />

        <Heading size="2xl" mb={2}>Step 1: Data</Heading>
      
        <List.Root mb={6} textStyle='lg' gap={2}>
            <List.Item>Use the search bar to enter the name, KIC or EPIC identifier of a star. Alternatively, select a suggested light curve.</List.Item>
            <List.Item>If the star you searched for was captured in the TESS or Kepler/K2 missions, a list of light curves will display in a table.</List.Item>
            <List.Item>
                Click the <PlotButton dummy/> button on a row to see a light curve as a graph.
            </List.Item>
            <List.Item>
                When you have found a light curve you wish to sonify, click the <SonifyButton dummy/> button.
            </List.Item>
            <List.Item>Go to <b>Sonify</b> to generate and listen.</List.Item>
            <List.Item>Save or export your results.</List.Item>
        </List.Root>
      </Box>
    </PageContainer>
  )
}
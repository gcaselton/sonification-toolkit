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
      <Box>
        <Heading size="4xl">Settings</Heading>
        <br />
        
      </Box>
    </PageContainer>
  )
}
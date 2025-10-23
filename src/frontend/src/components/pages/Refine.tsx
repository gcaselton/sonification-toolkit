import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton} from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
import { apiUrl as baseAPI} from "../../apiConfig";

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


export default function Refine() {

    const navigate = useNavigate();
    const location = useLocation();
    const dataName = location.state.dataName
    const dataFilepath = location.state.dataFilepath

    // To Do: Create RefineMenus.tsx which will return different options depending on sonification type.


    return(
        <PageContainer>
            <Box position='relative' as='main' role='main'>
                <Heading size="4xl">{dataName}</Heading>
                        <br />
            </Box>
        </PageContainer>
    )
}
import React, { useEffect, useState, createContext, ChangeEvent, lazy, Suspense } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton} from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
import { apiUrl} from "../../apiConfig";

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
  Skeleton,
  IconButton,
  chakra,
  HStack
} from "@chakra-ui/react";



export default function Refine() {

    const navigate = useNavigate();
    const location = useLocation();
    const dataName = location.state.dataName
    var dataFilepath = location.state.dataFilepath
    const soniType = location.state.soniType

    // Dynamically import the menu component
    const Menu = lazy(() => import(`../refine_menus/${soniType}.tsx`));


    return(
        <PageContainer>
            <Box position='relative' as='main' role='main'>
                <Heading size="4xl">Step 2: Refine</Heading>
                <br />
                <Text textStyle='lg'>Optionally, edit the {dataName} dataset.</Text>
                <br />
                <br />
                <Suspense>
                    <Menu 
                        dataFilepath={dataFilepath} 
                        onApply={(newFilepath: string) => {
                            // Navigate with refined data
                            dataFilepath = newFilepath;
                            navigate('/style', { state: { dataFilepath, dataName, soniType } });
                            }}/>
                </Suspense>
            </Box>
        </PageContainer>
    )
}
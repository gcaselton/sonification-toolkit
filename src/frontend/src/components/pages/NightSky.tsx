import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal, LuTelescope } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { SonifyButton, PlotButton } from "../ui/Buttons";
import { PlotDialog } from "../ui/PlotDialog";
import { Tooltip } from "../ui/Tooltip";
import ErrorMsg from "../ui/ErrorMsg";
import { getImage } from "../../utils/assets";
import { apiUrl, coreAPI, nightSkyAPI } from "../../apiConfig";
import { SuggestedData } from "./Lightcurves";
import { apiRequest } from "../../utils/requests";

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
    NativeSelect,
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


export default function NightSky() {

    const soniType = 'night_sky';

    const navigate = useNavigate();


    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [orientation, setOrientation] = useState("");
    const [dateTime, setDateTime] = useState("");
    const [loading, setLoading] = useState(false);

    const orientations = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE",
        "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ];


    // const [suggested, setSuggested] = useState<SuggestedData[]>([])

    // useEffect(() => {
    //     fetch(`${coreAPI}/suggested-data/${soniType}/`)
    //         .then((res) => res.json())
    //         .then((data) => {
    //             setSuggested(data);
    //             console.log(suggested)
    //         })
    //         .catch((err) => {
    //             console.error("Failed to fetch suggested data:", err);
    //         });
    // }, []
    // );

    const handleClickApply = async () => {

        setLoading(true);

        // Format dateTime into what backend is expecting
        const formatted = dateTime.replace("T", " ") + ":00";

        console.log(latitude)
        console.log(longitude)
        console.log(orientation)
        console.log(formatted)

        const data = {
            "latitude": latitude,
            "longitude": longitude,
            "facing": orientation,
            "date_time": formatted
        };

        const endpoint = `${nightSkyAPI}/get-stars/`

        try {
            const response = await apiRequest(
                endpoint,
                data,
                'POST'
            );

            const dataName = 'My Location';
            const dataRef = response.file_ref;

            // Navigate to refine page
            navigate('/refine', {
                state: { dataName, dataRef, soniType }
            });

        } catch (error: any) {

            console.error("Error: " + error);

        } finally {

            setLoading(false);
        }
        
    };


    return (
        <PageContainer>
            <Box as='main' role="main">
                <Heading size="4xl" as='h1'>Night Sky</Heading>
                <br />
                <Text textStyle="lg">Select a location and time to get local stars.</Text>
                <br />
                <br />
                <Box display="flex" justifyContent="center">
                    <VStack gap={5} width="300px">

                        {/* Latitude */}
                        <Field.Root>
                            <Field.Label>Latitude</Field.Label>
                            <Input
                                type="number"
                                placeholder="e.g. 50.8198"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                min={-90}
                                max={90}
                            />
                        </Field.Root>

                        {/* Longitude */}
                        <Field.Root>
                            <Field.Label>Longitude</Field.Label>
                            <Input
                                type="number"
                                placeholder="e.g. -1.0880"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                min={-180}
                                max={180}
                            />
                        </Field.Root>

                        {/* Orientation */}
                        <Field.Root>
                            <Field.Label>Orientation</Field.Label>

                            <NativeSelect.Root size="sm" width="240px">
                                <NativeSelect.Field
                                    placeholder="Select orientation"
                                    value={orientation}
                                    onChange={(e) => setOrientation(e.target.value)}
                                >   
                                    <option value="">Select orientation</option>
                                    <option value="N">North</option>
                                    <option value="NNE">North-Northeast</option>
                                    <option value="NE">Northeast</option>
                                    <option value="ENE">East-Northeast</option>
                                    <option value="E">East</option>
                                    <option value="ESE">East-Southeast</option>
                                    <option value="SE">Southeast</option>
                                    <option value="SSE">South-Southeast</option>
                                    <option value="S">South</option>
                                    <option value="SSW">South-Southwest</option>
                                    <option value="SW">Southwest</option>
                                    <option value="WSW">West-Southwest</option>
                                    <option value="W">West</option>
                                    <option value="WNW">West-Northwest</option>
                                    <option value="NW">Northwest</option>
                                    <option value="NNW">North-Northwest</option>
                                </NativeSelect.Field>

                                <NativeSelect.Indicator />
                            </NativeSelect.Root>
                        </Field.Root>


                        {/* Date & Time */}
                        <Field.Root>
                            <Field.Label>Date & Time</Field.Label>
                            <Input
                                type="datetime-local"
                                value={dateTime}
                                onChange={(e) => setDateTime(e.target.value)}
                            />
                        </Field.Root>

                        <Button onClick={handleClickApply} loading={loading} loadingText='Orienting you...'>Apply</Button>

                    </VStack>
                </Box>

            </Box>
        </PageContainer>
    )
}
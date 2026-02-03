import React, { useEffect, useState, createContext, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import { LuX, LuChartSpline, LuAudioLines, LuSearch, LuSlidersHorizontal, LuTelescope, LuMapPin } from "react-icons/lu";
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
    Portal,
    Spinner,
    Span,
    HStack,
    Combobox,
    useListCollection,
    useFilter
} from "@chakra-ui/react";
import { SearchCheck } from "lucide-react";

interface GeoPlace {
  geonameId: number
  name: string
  adminName1?: string
  countryName: string
  lat: string
  lng: string
}


export default function NightSky() {

    const soniType = 'night_sky';

    const navigate = useNavigate();

    // Username for the GeoNames service
    const GEO_NAMES_USER = 'audiouniverse'


    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [orientation, setOrientation] = useState("");
    const [dateTime, setDateTime] = useState("");
    const [searchingLoc, setSearchingLoc] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [locationName, setLocationName] = useState('');
    const [inputValue, setInputValue] = useState("")
    const [error, setError] = useState<string | null>(null)


    const orientations = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE",
        "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ];

    const { collection, set } = useListCollection<GeoPlace>({
        initialItems: [],
        itemToString: (item) =>
        [item.name, item.adminName1, item.countryName]
            .filter(Boolean)
            .join(", "),
        itemToValue: (item) => String(item.geonameId),
    })

    useEffect(() => {
        if (!navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords

            try {
            setSearchingLoc(true)
            const params = new URLSearchParams({
                lat: latitude.toString(),
                lng: longitude.toString(),
                username: GEO_NAMES_USER,
                type: "json",
            })

            const res = await fetch(
                `https://secure.geonames.org/findNearbyPlaceNameJSON?${params.toString()}`
            )
            const data = await res.json()
            if (data.status) throw new Error(data.status.message)

            const place = data.geonames?.[0]
            if (!place) return

            console.log(place)

            const label = [place.name, place.adminName1, place.countryName]
                .filter(Boolean)
                .join(", ")

            // Auto-fill input and Combobox collection
            setInputValue(label)
            set([place])

            } catch (err) {
            console.error("Geolocation lookup failed", err)
            } finally {
            setSearchingLoc(false)
            }
        },
        (err) => console.error("Geolocation denied or unavailable", err)
        )
    }, [set])

    useEffect(() => {

        if (inputValue.length < 3) {
        set([])
        return
        }

        const controller = new AbortController()
        const timeout = setTimeout(async () => {
        try {
            setSearchingLoc(true)
            setError(null)

            const params = new URLSearchParams({
            name_startsWith: inputValue,
            featureClass: "P",
            maxRows: "5",
            username: GEO_NAMES_USER,
            })

            const res = await fetch(
            `https://secure.geonames.org/searchJSON?${params.toString()}`,
            { signal: controller.signal }
            )

            const data = await res.json()

            if (data.status) {
            throw new Error(data.status.message)
            }

            set(data.geonames ?? [])
        } catch (err: any) {
            if (err.name !== "AbortError") {
            setError(err.message ?? "Fetch failed")
            }
        } finally {
            setSearchingLoc(false)
        }
        }, 300)

        return () => {
        controller.abort()
        clearTimeout(timeout)
        }
    }, [inputValue, set, GEO_NAMES_USER])


    const handleClickApply = async () => {

        setSubmitting(true);

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

            const dataName = locationName;
            const dataRef = response.file_ref;

            // Navigate to refine page
            navigate('/refine', {
                state: { dataName, dataRef, soniType }
            });

        } catch (error: any) {

            console.error("Error: " + error);

        } finally {
            setSearchingLoc(false);
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

                        {/* Location */}
                        <Combobox.Root
                            collection={collection}
                            onInputValueChange={(e) => setInputValue(e.inputValue)}
                            onValueChange={(e) => {
                                const item = e.items[0]
                                if (!item) return

                                const label = [
                                item.name,
                                item.adminName1,
                                item.countryName,
                                ].filter(Boolean).join(", ")

                                setLongitude(item.lng);
                                setLatitude(item.lat);
                                setLocationName(item.name);
                            }}
                            >
                            <Combobox.Label>Location</Combobox.Label>

                            <Combobox.Control>
                                <Combobox.Input placeholder="Type a city..." />
                                <Combobox.IndicatorGroup>
                                <Combobox.ClearTrigger />
                                <Combobox.Trigger />
                                </Combobox.IndicatorGroup>
                            </Combobox.Control>

                            <Portal>
                                <Combobox.Positioner>
                                <Combobox.Content minW="sm">
                                    {searchingLoc ? (
                                    <HStack p="2">
                                        <Spinner size="xs" />
                                        <Span>Searching…</Span>
                                    </HStack>
                                    ) : error ? (
                                    <Span p="2" color="fg.error">
                                        {error}
                                    </Span>
                                    ) : (
                                    collection.items.map((place) => {
                                        const label = [
                                        place.name,
                                        place.adminName1,
                                        place.countryName,
                                        ].filter(Boolean).join(", ")

                                        return (
                                        <Combobox.Item key={place.geonameId} item={place}>
                                            <Span truncate>{label}</Span>
                                            <Combobox.ItemIndicator />
                                        </Combobox.Item>
                                        )
                                    })
                                    )}
                                </Combobox.Content>
                                </Combobox.Positioner>
                            </Portal>
                            </Combobox.Root>

                        {/* Orientation */}
                        <Field.Root>
                            <Field.Label>Orientation</Field.Label>

                            <NativeSelect.Root>
                                <NativeSelect.Field
                                    placeholder="Select orientation"
                                    value={orientation}
                                    onChange={(e) => setOrientation(e.target.value)}
                                >   
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

                        <Button 
                        onClick={handleClickApply}
                        colorPalette='teal' 
                        loading={submitting} 
                        loadingText='Orienting you...'>
                            Apply
                        </Button>

                    </VStack>
                </Box>

            </Box>
        </PageContainer>
    )
}
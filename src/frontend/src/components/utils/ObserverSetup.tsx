import { useEffect, useState } from "react";
import {
  VStack,
  Field,
  Flex,
  Combobox,
  HStack,
  Spinner,
  Span,
  Portal,
  Stack,
  NativeSelect,
  Input,
  Button,
  useListCollection,
} from "@chakra-ui/react";
import { LuTelescope } from "react-icons/lu";

interface GeoPlace {
  geonameId: number;
  name: string;
  adminName1?: string;
  countryName: string;
  lat: string;
  lng: string;
}

export interface ObserverValues {
  latitude: string;
  longitude: string;
  locationName: string;
  orientation: string;
  dateTime: string;
}

export interface ObserverSetupProps {
  onSubmit: (values: ObserverValues) => Promise<void>;
  onCancel?: () => void;
}

export const ORIENTATIONS: { value: string; label: string }[] = [
  { value: "N", label: "North" },
  { value: "NNE", label: "North-Northeast" },
  { value: "NE", label: "Northeast" },
  { value: "ENE", label: "East-Northeast" },
  { value: "E", label: "East" },
  { value: "ESE", label: "East-Southeast" },
  { value: "SE", label: "Southeast" },
  { value: "SSE", label: "South-Southeast" },
  { value: "S", label: "South" },
  { value: "SSW", label: "South-Southwest" },
  { value: "SW", label: "Southwest" },
  { value: "WSW", label: "West-Southwest" },
  { value: "W", label: "West" },
  { value: "WNW", label: "West-Northwest" },
  { value: "NW", label: "Northwest" },
  { value: "NNW", label: "North-Northwest" },
];

export default function ObserverSetup({
  onSubmit,
  onCancel,
}: ObserverSetupProps) {
  // Username for the GeoNames service
  const GEO_NAMES_USER = "audiouniverse";

  // States
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationName, setLocationName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [selectedLoc, setSelectedLoc] = useState<string[]>([]);
  const [autoLocated, setAutoLocated] = useState(false);
  const [searchingLoc, setSearchingLoc] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { collection, set } = useListCollection<GeoPlace>({
    initialItems: [],
    itemToString: (item) =>
      [item.name, item.adminName1, item.countryName].filter(Boolean).join(", "),
    itemToValue: (item) => String(item.geonameId),
  });

  const formComplete =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    orientation.trim() !== "" &&
    dateTime.trim() !== "";

  const handleSelectLoc = (item: GeoPlace) => {
    setSelectedLoc([String(item.geonameId)]);
    setLatitude(item.lat);
    setLongitude(item.lng);
    setLocationName(item.name);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        latitude,
        longitude,
        locationName,
        orientation,
        dateTime,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-detect location on mount

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          setSearchingLoc(true);
          const params = new URLSearchParams({
            lat: latitude.toString(),
            lng: longitude.toString(),
            username: GEO_NAMES_USER,
            type: "json",
          });
          const res = await fetch(
            `https://secure.geonames.org/findNearbyPlaceNameJSON?${params}`,
          );
          const data = await res.json();
          if (data.status) throw new Error(data.status.message);

          const place = data.geonames?.[0];
          if (!place) return;

          const label = [place.name, place.adminName1, place.countryName]
            .filter(Boolean)
            .join(", ");

          setInputValue(label);
          set([place]);
          handleSelectLoc(place);
          setAutoLocated(true);
        } catch (err) {
          console.error("Geolocation lookup failed", err);
        } finally {
          setSearchingLoc(false);
        }
      },
      (err) => console.error("Geolocation denied or unavailable", err),
    );
  }, []);

  // Search locations as user types
  useEffect(() => {
    if (inputValue.length < 3) {
      set([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setSearchingLoc(true);
        setLocationError(null);

        const params = new URLSearchParams({
          name_startsWith: inputValue,
          featureClass: "P",
          maxRows: "5",
          username: GEO_NAMES_USER,
        });
        const res = await fetch(
          `https://secure.geonames.org/searchJSON?${params}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (data.status) throw new Error(data.status.message);
        set(data.geonames ?? []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setLocationError(err.message ?? "Unable to search locations");
        }
      } finally {
        setSearchingLoc(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [inputValue, GEO_NAMES_USER]);

  return (
    <VStack gap={5} width="300px">
      {/* Location */}
      <Field.Root>
        <Combobox.Root
          collection={collection}
          value={selectedLoc}
          onInputValueChange={(e) => setInputValue(e.inputValue)}
          onValueChange={(e) => {
            const item = e.items[0];
            if (!item) return;
            handleSelectLoc(item);
          }}
          openOnChange={(e) => e.inputValue.length > 2}
        >
          <Combobox.Label>Location</Combobox.Label>
          <Combobox.Control>
            <Combobox.Input placeholder="Enter a location..." />
            <Combobox.IndicatorGroup>
              <Combobox.ClearTrigger />
              <Combobox.Trigger />
            </Combobox.IndicatorGroup>
          </Combobox.Control>
          {autoLocated && (
            <Field.HelperText>Auto-detected location</Field.HelperText>
          )}
            <Combobox.Positioner zIndex="popover">
              <Combobox.Content>
                {searchingLoc ? (
                  <HStack>
                    <Spinner />
                    <Span>Searching…</Span>
                  </HStack>
                ) : locationError ? (
                  <Span color="fg.error">{locationError}</Span>
                ) : (
                  collection.items.map((place) => (
                    <Combobox.Item key={place.geonameId} item={place}>
                      <Stack gap={0}>
                        <Span truncate fontWeight="medium">
                          {place.name}
                        </Span>
                        <Span textStyle="xs" color="fg.muted">
                          {[place.adminName1, place.countryName]
                            .filter(Boolean)
                            .join(", ")}
                        </Span>
                      </Stack>
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))
                )}
              </Combobox.Content>
            </Combobox.Positioner>
        </Combobox.Root>
      </Field.Root>

      {/* Orientation */}
      <Field.Root>
        <Field.Label>Orientation</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder="Select orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            {ORIENTATIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
          onChange={(e) =>
            setDateTime(e.target.value.replace("T", " ") + ":00")
          }
        />
      </Field.Root>
      <Flex justify="center" w="full" gap={3}>
        {onCancel && (
          <Button variant="outline" colorPalette="teal" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          disabled={!formComplete}
          onClick={handleSubmit}
          colorPalette="teal"
          loading={submitting}
          loadingText="Orienting you..."
        >
          <LuTelescope />
          Observe
        </Button>
      </Flex>
    </VStack>
  );
}

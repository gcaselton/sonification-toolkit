import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuTelescope } from "react-icons/lu";
import PageContainer from "../ui/PageContainer";
import { getImage, randomRange } from "../../utils/assets";
import { coreAPI, constellationsAPI } from "../../apiConfig";
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
  HStack,
  Combobox,
  createListCollection,
  useFilter,
  Portal,
} from "@chakra-ui/react";
import { NavigationState } from "../../types/navigation";

interface PatternListResponse {
  constellations: string[];
  asterisms: string[];
}

interface PatternItem {
  label: string;
  value: string;
  category: "Constellations" | "Asterisms";
}

interface SuggestedPattern extends SuggestedData {
  category: "Constellations" | "Asterisms";
}

export default function Constellations() {
  const soniType = "constellations";

  const navigate = useNavigate();

  const [suggested, setSuggested] = useState<SuggestedPattern[]>([]);

  // Fetch suggested constellations on load
  useEffect(() => {
    fetch(`${coreAPI}/suggested-data/${soniType}/`)
      .then((res) => res.json())
      .then((data) => {
        setSuggested(data);
      })
      .catch((err) => {
        console.error("Failed to fetch suggested data:", err);
      });
  }, []);

  const [patternItems, setPatternItems] = useState<PatternItem[]>([]);

  // Fetch the full list of constellations + asterisms on load
  useEffect(() => {
    fetch(`${constellationsAPI}/list/`)
      .then((res) => res.json())
      .then((list: PatternListResponse) => {
        setPatternItems([
          ...list.constellations.map((name) => ({
            label: name,
            value: name,
            category: "Constellations" as const,
          })),
          ...list.asterisms.map((name) => ({
            label: name,
            value: name,
            category: "Asterisms" as const,
          })),
        ]);
      })
      .catch((err) => {
        console.error("Failed to fetch constellation/asterism list:", err);
      });
  }, []);

  const handleSelectPattern = (item: PatternItem) => {
    if (!item.value) return;

    const state: NavigationState = {
      dataName: item.value,
      soniType,
      isAsterism: item.category === 'Asterisms',
    };

    navigate("../refine", { state });
  };

  // Needed to use ComboBox search/filter
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");

  const filteredItems = useMemo(
    () => patternItems.filter((item) => contains(item.label, searchValue)),
    [patternItems, searchValue, contains],
  );

  const collection = useMemo(
    () => createListCollection({ items: filteredItems }),
    [filteredItems],
  );

  return (
    <PageContainer>
      <Heading as="h1" wordBreak="normal" overflowWrap="normal">
        Constellations
      </Heading>
      <br />
      <Text textStyle="lg">
        Search for a specific constellation or asterism, or choose from the
        suggestions below
      </Text>
      <br />
      <br />
      <Box display="flex" justifyContent="center">
        <Combobox.Root
          aria-label="Search constellations and asterisms"
          collection={collection}
          onInputValueChange={(e) => setSearchValue(e.inputValue)}
          onValueChange={(details) => {
            if (details.value.length > 0) {
              const selectedItem = patternItems.find(
                (item) => item.value === details.value[0],
              );

              if (selectedItem) {
                setTimeout(() => {
                  handleSelectPattern(selectedItem);
                }, 20);
              }
            }
          }}
          width={{ base: "100%", md: "50%" }}
          maxWidth="600px"
        >
          <Combobox.Control>
            <InputGroup startElement={<LuTelescope size="1.1rem" />}>
              <Combobox.Input placeholder="Search for a constellation or asterism" />
            </InputGroup>
            <Combobox.IndicatorGroup>
              <Combobox.ClearTrigger />
              <Combobox.Trigger />
            </Combobox.IndicatorGroup>
          </Combobox.Control>
          <Portal>
            <Combobox.Positioner>
              <Combobox.Content>
                <Combobox.Empty>No items found</Combobox.Empty>
                {(["Constellations", "Asterisms"] as const).map((category) => {
                  const itemsInCategory = collection.items.filter(
                    (item) => item.category === category,
                  );
                  if (itemsInCategory.length === 0) return null;
                  return (
                    <Combobox.ItemGroup key={category}>
                      <Combobox.ItemGroupLabel
                        fontWeight="bold"
                        fontSize="xs"
                        color="teal.500"
                        textTransform="uppercase"
                        letterSpacing="widest"
                        pt={2}
                        pb={1}
                      >
                        {category}
                      </Combobox.ItemGroupLabel>
                      {itemsInCategory.map((item) => (
                        <Combobox.Item item={item} key={item.value}>
                          {item.label}
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      ))}
                    </Combobox.ItemGroup>
                  );
                })}
              </Combobox.Content>
            </Combobox.Positioner>
          </Portal>
        </Combobox.Root>
      </Box>
      <br />
      <br />
      <Box animation="fade-in 300ms ease-out">
        <Heading size="2xl" as="h2">
          Suggested
        </Heading>
        <br />
        <Stack
          gap="4"
          direction="row"
          wrap="wrap"
          justify={{ base: "center", md: "flex-start" }}
          animation="fade-in 300ms ease-out"
        >
          {suggested.map((suggestion) => (
            <Card.Root
              width="200px"
              key={suggestion.name}
              variant="elevated"
              _hover={{ transform: "scale(1.05)" }}
              transition="transform 0.2s ease"
              cursor="pointer"
              as="button"
              aria-label={`Sonify ${suggestion.name}`}
              onClick={() => handleSelectPattern({label: suggestion.name, value: suggestion.name, category: suggestion.category})}
            >
              <Box
                position="relative"
                bg="black"
                borderRadius="8px"
                overflow="hidden"
              >
                <img
                  src={getImage(suggestion.name, ".svg")}
                  alt={`Outline of the ${suggestion.name} constellation, overlaid with its associated mythological figure.`}
                  style={{
                    width: "100%",
                    display: "block",
                    borderRadius: "8px",
                    animation: `twinkle ${randomRange(2, 3)}s infinite alternate`,
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
      <Text textAlign="center" fontSize="sm" color="fg.muted" mt={4}>
        Image credit:{" "}
        <Link
          href="https://noirlab.edu"
          color="gray.400"
          target="_blank"
          rel="noopener noreferrer"
        >
          NSF NOIRLab
        </Link>{" "}
        (CC BY 4.0)
      </Text>
    </PageContainer>
  );
}

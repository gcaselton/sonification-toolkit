import { useNavigate } from "react-router-dom";
import PageContainer from "../ui/PageContainer";
import { getImage } from "../../utils/assets";
import { Tooltip } from "../ui/Tooltip";
import { LuFilm } from "react-icons/lu";

import {
  Box,
  Alert,
  Button,
  Card,
  FileUpload,
  LinkOverlay,
  Link,
  Image,
  Icon,
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
  page: string;
}

const astroTypes: AstroType[] = [
  {
    name: "Light Curves",
    description: "Listen to fluctuations in a star's light.",
    page: "/light-curves",
  },
  {
    name: "Constellations",
    description: "Hear the unique qualities of the 88 constellations.",
    page: "/constellations",
  },
  {
    name: "Night Sky",
    description: "Hear the stars at your location appear.",
    page: "/night-sky",
  },
];

export default function Planetaria() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <Box as="main" role="main">
        <Heading as="h1">Step 1: Data</Heading>
        <br />
        <HStack flexWrap="nowrap">
          <Text textStyle="lg" flexShrink={1}>
            Select a data source to sonify
          </Text>
        </HStack>
        <br />
        <br />
        <Stack
          gap="4"
          direction="row"
          wrap="wrap"
          animation="fade-in 300ms ease-out"
        >
          {astroTypes.map((astroType) => (
            <Tooltip
              key={astroType.name}
              content="Coming soon!"
              openDelay={300}
              disabled={astroType.page !== "/"}
            >
              <Card.Root
                width="200px"
                key={astroType.name}
                variant="elevated"
                _hover={{ transform: "scale(1.05)" }}
                transition="transform 0.2s ease"
              >
                <LinkOverlay
                  as={Link}
                  onClick={() => navigate(astroType.page)}
                  cursor={astroType.page === "/" ? "disabled" : "pointer"}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(astroType.page);
                    }
                  }}
                >
                  <img
                    src={getImage(astroType.name)}
                    alt={astroType.name}
                    style={{
                      width: "100%",
                      height: "200px",
                      objectFit: "cover",
                      borderRadius: "8px",
                    }}
                  />
                </LinkOverlay>
                <Card.Body>
                  <Card.Title mb="2">{astroType.name}</Card.Title>
                  <Card.Description>{astroType.description}</Card.Description>
                </Card.Body>
              </Card.Root>
            </Tooltip>
          ))}
          <Card.Root
            width="200px"
            key="examples"
            variant="subtle"
            _hover={{ transform: "scale(1.05)" }}
            transition="transform 0.2s ease"
          >
            <LinkOverlay
              as={Link}
              role="button"
              tabIndex={0}
              href="https://www.audiouniverse.org/sonification-suite/planetaria/example-bank"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Box
                height="200px"
                width="100%"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="8px"
              >
                <Icon boxSize="64px" color="gray.400">
                  <LuFilm />
                </Icon>
              </Box>
            </LinkOverlay>
            <Card.Body>
              <Card.Title mb="2">Example Bank</Card.Title>
              <Card.Description>
                Use some of our pre-made examples in your shows.
              </Card.Description>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Box>
    </PageContainer>
  );
}

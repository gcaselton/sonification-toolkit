import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { LuTelescope } from "react-icons/lu";
import { IconType } from "react-icons/lib";
import PageContainer from "../ui/PageContainer";


interface Domain {
  id: string;
  label: string;
  description: string;
  href?: string;
  Icon: IconType;
}

const DOMAINS: Domain[] = [
  {
    id: "planetaria",
    label: "for Planetaria",
    description:
      "Sonify constellations, stellar light curves, and entire night skies for your planetarium shows.",
    href: "/planetaria",
    Icon: LuTelescope,
  }
];

// ─── Waveform SVG ─────────────────────────────────────────────────────────────

function WaveformDecoration() {
  const points = Array.from({ length: 300 }, (_, i) => {
    const t = i / 299; // 0 → 1
    const phase = (1 - t) * (1 - t) * 10 * Math.PI * 2;
    const amplitude = 50 * (1 - t * 0.85);
    const y = 50 + Math.sin(phase) * amplitude;
    const x = t * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <Box w="100%" h="48px" opacity={0.3} my={4}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <polyline
          points={points}
          fill="none"
          stroke="teal"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Box>
  );
}

function DomainCard({ domain }: { domain: Domain }) {
  const navigate = useNavigate();

  return (
    <Card.Root
      variant="elevated"
      cursor="pointer"
      _hover={{ transform: "scale(1.05)" }}
      transition="transform 0.2s ease"
      onClick={() => domain.href && navigate(domain.href)}
      tabIndex={0}
      role="button"
      aria-label={`Open ${domain.label}`}
      onKeyDown={(e) => {
        if (domain.href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          navigate(domain.href);
        }
      }}
    >
      <Card.Body>
        <VStack align="flex-start" gap={3}>
          <HStack justify="space-between" w="100%">
            <domain.Icon size="1.4rem" />
          </HStack>
          <Card.Title>{domain.label}</Card.Title>
          <Card.Description>{domain.description}</Card.Description>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <PageContainer nav={false}>
      {/* Hero */}
      <Flex
        as="header"
        direction="column"
        align="flex-start"
        pt={12}
        pb={12}
        gap={2}
      >
        <Link
          fontSize="sm"
          color="teal.600"
          letterSpacing="0.2em"
          textTransform="uppercase"
          href="https://www.audiouniverse.org/"
        >
          Audio Universe
        </Link>

        <Heading as="h1" size="5xl" fontWeight="300" lineHeight="1.1">
          Sonification{" "}
          <Box as="span" color="teal.500">
            Suite
          </Box>
        </Heading>

        <WaveformDecoration />

        <Text fontSize="lg" maxW="540px" opacity={0.7}>
          An accessible platform for transforming scientific datasets into tangible
          audio representations. Choose a domain below to begin.
        </Text>
      </Flex>

      {/* Domain cards */}
      <Box>
        <HStack gap={4} mb={5} align="center">
          <Heading as="h2" size="lg" fontWeight="400">
            Domains
          </Heading>
          <Box flex={1} h="1px" bg="border" />
        </HStack>

        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
          {DOMAINS.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </Grid>
      </Box>

    </PageContainer>
  );
}

import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { LuTelescope } from "react-icons/lu";
import { IconType } from "react-icons/lib";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Domain {
  id: string;
  label: string;
  description: string;
  status: "live" | "coming-soon";
  href?: string;
  Icon: IconType;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const DOMAINS: Domain[] = [
  {
    id: "planetaria",
    label: "for Planetaria",
    description:
      "Translate constellations, stellar light curves, and cosmic-scale datasets into structured audio. Navigate the universe by ear.",
    status: "live",
    href: "/planetaria",
    Icon: LuTelescope, // swap for a more fitting icon if available
  }
];

// ─── Waveform SVG ─────────────────────────────────────────────────────────────
// Decorative only — mirrors the sonification concept visually.

function WaveformDecoration() {
  const points = Array.from({ length: 300 }, (_, i) => {
    const t = i / 299; // 0 → 1
    const phase = (1 - t) * (1 - t) * 10 * Math.PI * 2; // integrated chirp: fast → slow
    const amplitude = 50 * (1 - t * 0.85); // high → low amplitude
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
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Box>
  );
}

// ─── Domain Card ──────────────────────────────────────────────────────────────

function DomainCard({ domain }: { domain: Domain }) {
  const navigate = useNavigate();
  const isLive = domain.status === "live";

  return (
    <Card.Root
      variant="elevated"
      cursor={isLive ? "pointer" : "default"}
      opacity={isLive ? 1 : 0.5}
      _hover={isLive ? { transform: "scale(1.03)" } : undefined}
      transition="transform 0.2s ease"
      onClick={() => isLive && domain.href && navigate(domain.href)}
      tabIndex={isLive ? 0 : undefined}
      role={isLive ? "button" : undefined}
      aria-label={
        isLive ? `Open ${domain.label}` : `${domain.label} — coming soon`
      }
      onKeyDown={(e) => {
        if (isLive && domain.href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          navigate(domain.href);
        }
      }}
    >
      <Card.Body>
        <VStack align="flex-start" gap={3}>
          <HStack justify="space-between" w="100%">
            <domain.Icon size="1.4rem" />
            {!isLive && (
              <Badge variant="outline" size="sm">
                Coming soon
              </Badge>
            )}
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
    <Box maxW="1200px" mx="auto" px={6} py={4} width="100%">
      {/* Hero */}
      <Flex
        as="header"
        direction="column"
        align="flex-start"
        pt={16}
        pb={12}
        gap={2}
      >
        <Text
          fontSize="sm"
          color="teal.600"
          letterSpacing="0.15em"
          textTransform="uppercase"
        >
          Audio Universe
        </Text>

        <Heading as="h1" size="5xl" fontWeight="300" lineHeight="1.1">
          Sonification{" "}
          <Box as="span" color="teal.500">
            Suite
          </Box>
        </Heading>

        <WaveformDecoration />

        <Text fontSize="lg" maxW="540px" opacity={0.7}>
          A unified platform for transforming scientific datasets into
          tangible audio representations. Choose a domain below to begin.
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

      {/* Footer */}
      <Flex
        as="footer"
        mt={20}
        pt={6}
        borderTop="1px solid"
        borderColor="border"
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={4}
        opacity={0.4}
      >
        <Text fontSize="xs">Sonification Suite</Text>
        <Text fontSize="xs">v0.1 Alpha</Text>
      </Flex>
    </Box>
  );
}

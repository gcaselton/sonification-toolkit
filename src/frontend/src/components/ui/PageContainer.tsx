import { Box, Flex, Text, Link, Button, Icon, HStack } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { LucideCircleQuestionMark } from "lucide-react";

export default function PageContainer({
  children,
  nav = true,
}: {
  children: React.ReactNode;
  nav?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Box maxW="1200px" mx="auto" px={6} py={4} width="100%">
      {nav && (
        <Flex as="header" justify="space-between" align="center" mb={6}>
          <Flex align="center" gap={2} wrap="wrap">
            <Text
              fontSize="lg"
              cursor="pointer"
              onClick={() => navigate("/")}
              _hover={{ opacity: 0.8 }}
              transition="opacity 0.15s ease"
            >
              Sonification{" "}
              <Box as="span" color="teal.500">
                Suite
              </Box>
            </Text>

            <Text opacity={0.35}>/</Text>
            <Text
              fontSize="lg"
              opacity={0.6}
              cursor="pointer"
              onClick={() => navigate("/planetaria")}
              _hover={{ opacity: 1 }}
              transition="opacity 0.15s ease"
            >
              Planetaria
            </Text>
          </Flex>
          <HStack
            opacity={0.5}
            _hover={{ opacity: 1 }}
            transition="opacity 0.15s ease"
            cursor="pointer"    
            onClick={() => navigate("/help")}
            role="button"
          >
            <Icon size="md">
              <LucideCircleQuestionMark />
            </Icon>
            <Text fontSize="md">Help</Text>
          </HStack>
        </Flex>
      )}

      {children}

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
        opacity={0.5}
      >
        <Text fontSize="xs">Sonification Suite</Text>
        <Text fontSize="xs">
          Powered by{" "}
          <Link
            href="https://github.com/james-trayford/strauss"
            colorPalette="teal"
          >
            STRAUSS
          </Link>
        </Text>
        <Text fontSize="xs">v0.1 (Pre-Alpha)</Text>
      </Flex>
    </Box>
  );
}

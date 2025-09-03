import { Box, Flex, Heading } from "@chakra-ui/react";
import { NavDrawer } from "./NavDrawer";

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      maxW="1200px"   // keeps content the same width
      mx="auto"       // centers horizontally
      px={6}          // consistent side padding
      py={4}          // top/bottom spacing
      width='100%'
    >
      <Flex as="header" justify="space-between" align="center" mb={6}>
        <NavDrawer />
      </Flex>
      {children}
    </Box>
  );
}

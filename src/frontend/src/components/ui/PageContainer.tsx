import { Box, Flex, Heading } from "@chakra-ui/react";
import { NavDrawer } from "./NavDrawer";
import { BackButton } from "./Buttons";

export default function PageContainer({ children, hideBackButton = false }: { children: React.ReactNode , hideBackButton?: boolean}) {
  return (
    <Box
      maxW="1200px"   // keeps content the same width
      mx="auto"       // centers horizontally
      px={6}          // consistent side padding
      py={4}          // top/bottom spacing
      width='100%'
    >
      <Flex as="header" justify="space-between" align="center" mb={6}>
        {!hideBackButton && <BackButton fallbackPath="/" />}
        {hideBackButton && <Box/>}
        <NavDrawer />
      </Flex>
      {children}
    </Box>
  );
}

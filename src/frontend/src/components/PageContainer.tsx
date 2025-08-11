// PageContainer.tsx
import { Box } from "@chakra-ui/react";

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      maxW="1200px"   // keeps content the same width
      mx="auto"       // centers horizontally
      px={6}          // consistent side padding
      py={4}          // top/bottom spacing
      width='100%'
    >
      {children}
    </Box>
  );
}

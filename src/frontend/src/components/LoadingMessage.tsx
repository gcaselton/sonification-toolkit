import { Box, Spinner, Text } from "@chakra-ui/react";

const LoadingMessage = ({ msg }: { msg: string }) => (
  <Box textAlign="center" mt={4}>
    <Spinner size="xl" color="blue.500" />
    <Text mt={2}>{msg}</Text>
  </Box>
);

export default LoadingMessage;
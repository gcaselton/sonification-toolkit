import { Box, Spinner, Text } from "@chakra-ui/react";
import { Waveform } from 'ldrs/react'
import 'ldrs/react/Waveform.css'

const LoadingMessage = ({ msg }: { msg: string }) => (
  <Box textAlign="center" mt={4} animation="fade-in" animationDuration="0.3s">
    <br />
    <Waveform size="35" stroke="3.5" speed="1" color="#646cff" />
    {msg && (<Text mt={2}>{msg}</Text>)}
    <br />
  </Box>
);

export default LoadingMessage;
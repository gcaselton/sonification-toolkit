import { Box, Text } from "@chakra-ui/react";
import { Waveform, Pulsar } from 'ldrs/react';
import 'ldrs/react/Waveform.css';
import 'ldrs/react/Pulsar.css';

interface LoadingMessageProps {
  msg: string;
  icon?: 'waveform' | 'pulsar';
}

const LoadingMessage = ({ msg, icon = 'waveform' }: LoadingMessageProps) => (
  <Box textAlign="center" mt={4} animation="fade-in" animationDuration="0.3s">
    <br />
    {icon === 'waveform' ? (
      <Waveform size="35" stroke="3.5" speed="1" color='#14b8a6' />
    ) : (
      <Pulsar size="35" color='#14b8a6' />
    )}
    {msg && (<Text mt={2}>{msg}</Text>)}
    <br />
  </Box>
);

export default LoadingMessage;

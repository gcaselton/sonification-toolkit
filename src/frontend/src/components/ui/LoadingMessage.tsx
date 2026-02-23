import { Box, Text } from "@chakra-ui/react";
import { Waveform, Pulsar } from 'ldrs/react';
import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "./Tooltip";
import { LuX } from "react-icons/lu";
import 'ldrs/react/Waveform.css';
import 'ldrs/react/Pulsar.css';

interface LoadingMessageProps {
  msg: string;
  icon?: 'waveform' | 'pulsar';
  onCancel?: () => void;
}

const LoadingMessage = ({
  msg,
  icon = "waveform",
  onCancel,
}: LoadingMessageProps) => (
  <Box
    textAlign="center"
    maxWidth="50%"
    mx="auto"
    position="relative"
    mt={4}
    animation="fade-in 300ms ease-out"
    role="status"
    aria-live="polite"
  >
    {onCancel && (
      <Tooltip content="Cancel search" openDelay={100}>
        <IconButton
          aria-label="Cancel search"
          size="sm"
          variant="ghost"
          position="absolute"
          top="0"
          right="0"
          onClick={onCancel}
        >
          <LuX />
        </IconButton>
      </Tooltip>
    )}
    <br />
    {icon === "waveform" ? (
      <Waveform size="35" stroke="3.5" speed="1" color="#14b8a6" />
    ) : (
      <Pulsar size="35" color="#14b8a6" />
    )}
    {msg && <Text mt={2}>{msg}</Text>}
    <br />
  </Box>
);

export default LoadingMessage;

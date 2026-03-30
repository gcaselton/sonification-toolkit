import React, { useState, useEffect } from "react";
import "./StyleCard.css";
import { Text, IconButton, Box, VStack, Dialog, CloseButton } from "@chakra-ui/react";
import { Volume2, VolumeOff, Upload, Settings, Info } from "lucide-react";
import { getAudio } from "../../utils/assets";

interface StyleCardProps {
  title: string;
  description: string;
  gradientClass: string;
  isCustom?: boolean;
}

// Shared state for all cards
let currentAudio: HTMLAudioElement | null = null;
let currentSetIsPlaying: ((playing: boolean) => void) | null = null;

export default function StyleCard({
  title,
  description,
  gradientClass,
  isCustom = false,
}: StyleCardProps) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const toggleInfo = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setInfoOpen(true);
  }

  const togglePreview = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();

    // If this card is already playing, stop
    if (isPlaying) {
      currentAudio?.pause();
      currentAudio = null;
      setIsPlaying(false);
      return;
    }

    // Stop the previously playing card (if any)
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      if (currentSetIsPlaying) {
        currentSetIsPlaying(false); // reset the other card’s icon
      }
    }

    // Start this one
    const audio = new Audio(getAudio(title));
    audio.play().catch((err) => console.error("Error playing preview:", err));

    currentAudio = audio;
    currentSetIsPlaying = setIsPlaying;
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
      if (currentAudio === audio) {
        currentAudio = null;
        currentSetIsPlaying = null;
      }
    };
  };

  // Force stop audio when component unmounts
  useEffect(() => {
    return () => {
      currentAudio?.pause();
      currentAudio = null;
      setIsPlaying(false);
    };
  }, []);

  return (
    <>
      <div className={`style-card ${gradientClass}`}>
        {!isCustom && (
          <VStack>
            <Box position="absolute" top="0.5rem" left="0.5rem" zIndex={10}>
              <IconButton
                tabIndex={0}
                aria-label={
                  isPlaying ? "Stop Preview" : `Preview ${title} Style`
                }
                variant="plain"
                color="white"
                role="button"
                onClick={togglePreview}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePreview(e);
                  }
                }}
              >
                {!isPlaying ? <VolumeOff /> : <Volume2 />}
              </IconButton>
            </Box>
            <Box position="absolute" top="0.5rem" left="2.5rem" zIndex={10}>
              <IconButton
                tabIndex={0}
                aria-label="info"
                variant="plain"
                color="white"
                role="button"
                onClick={toggleInfo}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleInfo(e);
                  }
                }}
              >
                <Info />
              </IconButton>
            </Box>
          </VStack>
        )}
        {isCustom && <Settings className="icon" size={48} />}
        <Text className="style-title">{title}</Text>
      </div>
      <Dialog.Root
        open={infoOpen}
        onOpenChange={(e) => setInfoOpen(e.open)}
        closeOnInteractOutside={false}
        placement="center"
        size="md"
      >
        <Dialog.Backdrop onClick={(e) => e.stopPropagation()} />
        <Dialog.Positioner onClick={(e) => e.stopPropagation()}>
          <Dialog.Content maxH="80vh">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body overflowY="auto">
              <Text>{description}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton />
              </Dialog.CloseTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

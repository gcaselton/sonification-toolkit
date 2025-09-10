import React, { useState } from 'react';
import './StyleCard.css';
import { Text, IconButton, Box } from "@chakra-ui/react";
import { Volume2, VolumeOff } from 'lucide-react';

interface StyleCardProps {
  title: string;
  gradientClass: string;
  isCustom?: boolean;
}

// Shared state for all cards
let currentAudio: HTMLAudioElement | null = null;
let currentSetIsPlaying: ((playing: boolean) => void) | null = null;

export default function StyleCard({ title, gradientClass, isCustom = false }: StyleCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePreview = (e: React.MouseEvent) => {
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
    const audio = new Audio(`/previews/${title}.mp3`);
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

  return (
    <div className={`style-card ${gradientClass}`}>
      {!isCustom &&
        <Box position="absolute" top="0.5rem" left="0.5rem" zIndex={10}>
          <IconButton
            aria-label={isPlaying ? 'Stop Preview' : 'Preview Style'}
            variant="plain"
            color="white"
            onClick={togglePreview}
          >
            {isPlaying ? <VolumeOff /> : <Volume2 />}
          </IconButton>
        </Box>
      }
      {isCustom && <span className="gear-icon">⚙️</span>}
      <Text className="style-title">{title}</Text>
    </div>
  );
}

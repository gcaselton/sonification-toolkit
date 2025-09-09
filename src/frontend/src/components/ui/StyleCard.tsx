import React from 'react';
import './StyleCard.css';
import { Text, IconButton, Box } from "@chakra-ui/react";
import { Volume2 } from 'lucide-react';

interface StyleCardProps {
  title: string;
  gradientClass: string;
  isCustom?: boolean
}

export default function StyleCard({ title, gradientClass, isCustom = false }: StyleCardProps) {
  return (
    <div className={`style-card ${gradientClass}`}>
      <Box
        position="absolute"
        top="0.5rem"
        left="0.5rem"
        zIndex={10}
        >              
        <IconButton aria-label='Preview Sound' variant='plain' color='white'>
          <Volume2/>
        </IconButton>
      </Box>
      {isCustom && <span className="gear-icon">⚙️</span>}
      <Text className="style-title">{title}</Text>
    </div>
  );
}
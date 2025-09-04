import React from 'react';
import './StyleCard.css';
import { Text } from "@chakra-ui/react";

interface StyleCardProps {
  title: string;
  gradientClass: string;
  isCustom?: boolean
}

export default function StyleCard({ title, gradientClass, isCustom = false }: StyleCardProps) {
  return (
    <div className={`style-card ${gradientClass}`}>
      {isCustom && <span className="gear-icon">⚙️</span>}
      <Text className="style-title">{title}</Text>
    </div>
  );
}
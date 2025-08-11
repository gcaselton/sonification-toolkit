import { IconButton } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";

interface BackButtonProps {
  fallbackPath?: string;
}

export default function BackButton({ fallbackPath }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (fallbackPath) {
      navigate(fallbackPath);
    }
  };

  return (
    <IconButton
      size="xl"
      variant="ghost"
      onClick={handleBack}
      rounded="full"
      colorPalette='teal'
      aria-label="Go back"
    >
      <LuArrowLeft strokeWidth={2.5}/>
    </IconButton>
  );
}

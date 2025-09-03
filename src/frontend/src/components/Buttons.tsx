import { IconButton, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { LuArrowLeft, LuAudioLines, LuChartSpline } from "react-icons/lu";
import { Lightcurve } from "./Lightcurves";

interface BackButtonProps {
  fallbackPath?: string;
}

export function BackButton({ fallbackPath }: BackButtonProps) {
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

interface SonifyButtonProps {
  onClick?: (dataURI: string) => void
  dataURI?: string
  dummy?: boolean
}

export function SonifyButton({ onClick, dataURI, dummy = false }: SonifyButtonProps) {
  return (
    <Button
      colorPalette="teal"
      onClick={() => !dummy && onClick?.(dataURI ?? "")}
      pointerEvents={dummy ? "none" : "auto"}           
      cursor={dummy ? "default" : "pointer"}
      size={dummy ? 'xs' : 'md'}           
    >
        <LuAudioLines /> Sonify
    </Button>
  )
}

interface PlotButtonProps {
    onClick?: (item: Lightcurve) => void
    item?: Lightcurve
    dummy?: boolean
}

export function PlotButton({ onClick, item, dummy = false }: PlotButtonProps) {
  return (
    <Button
      colorPalette="teal"
      onClick={() => {
        if (!dummy && onClick && item) {
          onClick(item)
        }
      }}
      pointerEvents={dummy ? "none" : "auto"}
      cursor={dummy ? "default" : "pointer"}
      size={dummy ? 'xs' : 'md'}
    >
      <LuChartSpline /> View Plot
    </Button>
  )
}


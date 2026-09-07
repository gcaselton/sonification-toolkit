import {
  Button,
  ButtonProps,
  IconButton,
  Menu,
  Portal,
  Toast,
} from "@chakra-ui/react";
import { LuDownload } from "react-icons/lu";
import { coreAPI } from "../../apiConfig";
import { Tooltip } from "./Tooltip";
import { useState } from "react";

interface AudioDownloadButtonProps {
  audioFileRef: string;
  fileName: string;
  audioKey: string | number;
  audioSystem: string;
  layer: boolean;
  soniReady: boolean;
  onDownload?: () => void;
}

const downloadFormats = ["wav", "mp3"] as const;

export default function AudioDownloadButton({
  audioFileRef,
  fileName,
  audioKey,
  audioSystem,
  layer,
  soniReady,
  onDownload,
}: AudioDownloadButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Menu.Root
      open={menuOpen}
      onOpenChange={(details) => setMenuOpen(details.open)}
    >
      <Tooltip
        content={
          soniReady
            ? "Download layer audio"
            : "Generate the sonification to download this layer's audio."
        }
        disabled={!layer || menuOpen}
      >
        <Menu.Trigger asChild>
          <Button
            colorPalette="teal"
            variant={layer ? "subtle" : "solid"}
            size={layer ? "sm" : "md"}
            disabled={layer && !soniReady}
          >
            <LuDownload /> {layer ? "Layer audio" : "Download"}
          </Button>
        </Menu.Trigger>
      </Tooltip>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {downloadFormats.map((format) => {
              const mp3Disabled =
                format === "mp3" && !["stereo", "mono"].includes(audioSystem);

              return (
                <Tooltip
                  disabled={!mp3Disabled}
                  content="MP3 is only available for Mono or Stereo audio."
                >
                  <Menu.Item
                    value={format}
                    asChild
                    disabled={mp3Disabled}
                    onClick={onDownload}
                  >
                    <a
                      href={`${coreAPI}/audio/${audioFileRef}?name=${encodeURIComponent(fileName)}&audio_format=${format}&v=${audioKey}`}
                    >
                      Download {format.toUpperCase()}
                    </a>
                  </Menu.Item>
                </Tooltip>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

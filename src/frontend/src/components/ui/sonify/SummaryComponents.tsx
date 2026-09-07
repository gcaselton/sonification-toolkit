import {
  Accordion,
  Button,
  DataList,
  HStack,
  Heading,
  Menu,
  Portal,
  Separator,
  Stat,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuDownload, LuSettings } from "react-icons/lu";
import { Tooltip } from "../Tooltip";
import { coreAPI } from "../../../apiConfig";
import { formatCoord } from "../../../utils/formatting";
import { useState } from "react";
import AudioDownloadButton from "../AudioDownloadButton";

export interface LayerSummary {
  layerLabel?: string;
  description: string;
  dataName: string;
  styleName: string;
  dataRef: string | null;
  styleRef: string | null;
}

interface LayerContentProps {
  summary: LayerSummary;
  altAz: string[] | null;
  handleEditStyle: (fileRef: string) => void;
}

interface LayerDownloadsProps {
  summary: LayerSummary;
  layerIndex?: number;
  layerLabel?: string
  soniReady: boolean;
  audioKey: string | number;
  audioSystem: string;
}

interface SummaryListProps {
  summaries: LayerSummary[];
  altAz: string[] | null;
  handleEditStyle: (fileRef: string) => void;
  soniReady: boolean;
  audioKey: string | number;
  audioSystem: string;
}

const DownloadButton = ({
  label,
  fileRef,
  fileName,
  tooltip,
}: {
  label: string;
  fileRef: string | null;
  fileName: string;
  tooltip: string;
}) => {
  if (!fileRef) return null;

  return (
    <Tooltip content={tooltip}>
      <Button asChild size="sm" colorPalette="teal" variant="subtle">
        <a
          href={`${coreAPI}/download/${encodeURIComponent(fileRef)}?name=${encodeURIComponent(fileName)}`}
        >
          <LuDownload />
          {label}
        </a>
      </Button>
    </Tooltip>
  );
};

export const LayerDownloads = ({
  summary,
  layerIndex,
  layerLabel,
  soniReady,
  audioKey,
  audioSystem,
}: LayerDownloadsProps) => {
  const i = layerIndex === undefined ? 0 : layerIndex;
  const mappingTableButton = (
    <Button
      asChild={soniReady}
      size="sm"
      colorPalette="teal"
      variant="subtle"
      disabled={!soniReady}
    >
      {soniReady ? (
        <a
          href={`${coreAPI}/download/${encodeURIComponent(
            `session:mapping_table_${String(i + 1)}.csv`,
          )}?name=${encodeURIComponent(`Mapping Table${layerLabel ? ` (${layerLabel})` : ""}.csv`)}`}
        >
          <LuDownload />
          Mapping table
        </a>
      ) : (
        <>
          <LuDownload />
          Mapping table
        </>
      )}
    </Button>
  );

  return (
    <VStack w="100%" align="stretch" gap={2}>
      <Text fontWeight="bold" fontSize="sm">
        Downloads
      </Text>

      <HStack gap={2} wrap="wrap">
        <DownloadButton
          label="Data"
          fileRef={summary.dataRef}
          fileName={`${summary.dataName}.csv`}
          tooltip="Download data"
        />

        <DownloadButton
          label="Style"
          fileRef={summary.styleRef}
          fileName={`${summary.styleName}.yml`}
          tooltip="Download style file"
        />

        <Tooltip
          content={
            soniReady
              ? "Download a table showing the timing and sound parameters for each data point."
              : "Generate the sonification to download the mapping table."
          }
        >
          {mappingTableButton}
        </Tooltip>
        {layerIndex !== undefined && (
          <AudioDownloadButton
            audioFileRef={`session:layer_${layerIndex + 1}.wav`}
            fileName={layerLabel ?? `Layer ${layerIndex + 1}`}
            audioKey={audioKey}
            audioSystem={audioSystem}
            layer
            soniReady={soniReady}
          />
        )}
      </HStack>
    </VStack>
  );
};

export const LayerContent = ({
  summary,
  altAz,
  handleEditStyle,
}: LayerContentProps) => (
  <VStack w="100%" align="stretch" gap={5}>
    {summary.description.length > 0 && (
      <Text fontSize="sm" lineHeight="tall">
        {summary.description}
      </Text>
    )}
    <HStack
      w="100%"
      gap={0}
      divideX="1px"
      borderTopWidth="1px"
      borderBottomWidth="1px"
      py={3}
    >
      <Stat.Root flex="1" px={4}>
        <Stat.Label>Data</Stat.Label>
        <Stat.ValueText textStyle="md">{summary.dataName}</Stat.ValueText>
      </Stat.Root>

      <Stat.Root flex="1" px={4}>
        <Stat.Label>Style</Stat.Label>

        <HStack justify="space-between">
          <Stat.ValueText textStyle="md">{summary.styleName}</Stat.ValueText>

          {summary.styleName === "Custom" && summary.styleRef && (
            <Tooltip content="Open in the custom style menu">
              <Button
                size="xs"
                colorPalette="teal"
                variant="subtle"
                onClick={() => handleEditStyle(summary.styleRef!)}
              >
                <LuSettings />
                Edit
              </Button>
            </Tooltip>
          )}
        </HStack>
      </Stat.Root>
    </HStack>

    {altAz && (
      <HStack
        w="100%"
        gap={0}
        divideX="1px"
        borderTopWidth="1px"
        borderBottomWidth="1px"
        py={3}
      >
        <Stat.Root flex="1" px={4}>
          <Stat.Label>Altitude</Stat.Label>
          <Stat.ValueText textStyle="md">
            {formatCoord(altAz[0])}°
          </Stat.ValueText>
        </Stat.Root>

        <Stat.Root flex="1" px={4}>
          <Stat.Label>Azimuth</Stat.Label>
          <Stat.ValueText textStyle="md">
            {formatCoord(altAz[1])}°
          </Stat.ValueText>
        </Stat.Root>
      </HStack>
    )}
  </VStack>
);

export const SummaryList = ({
  summaries,
  altAz,
  handleEditStyle,
  soniReady,
  audioKey,
  audioSystem,
}: SummaryListProps) => {
  return (
    <VStack w="100%" align="stretch" gap={4}>
      <HStack w="100%">
        <Separator w="100%" size="lg" />
        <Text flexShrink="0" textStyle="lg">
          Summary
        </Text>
        <Separator w="100%" size="lg" />
      </HStack>

      {summaries.length > 1 ? (
        <Accordion.Root
          multiple
          collapsible
          defaultValue={
            summaries[0]?.layerLabel ? [summaries[0].layerLabel] : []
          }
          w="100%"
        >
          {summaries.map((summary, i) => {
            const value = summary.layerLabel ?? String(i);

            return (
              <Accordion.Item key={value} value={value}>
                <Accordion.ItemTrigger>
                  <Heading size="lg" color="teal">
                    {summary.layerLabel}
                  </Heading>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent pb={5} pt={2}>
                  <VStack w="100%" align="stretch" gap={5}>
                    <LayerContent
                      summary={summary}
                      altAz={altAz}
                      handleEditStyle={handleEditStyle}
                    />

                    <LayerDownloads
                      summary={summary}
                      layerIndex={i}
                      layerLabel={summary.layerLabel}
                      soniReady={soniReady}
                      audioKey={audioKey}
                      audioSystem={audioSystem}
                    />
                  </VStack>
                </Accordion.ItemContent>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      ) : (
        summaries.map((summary, i) => (
          <VStack
            key={summary.layerLabel ?? i}
            w="100%"
            align="stretch"
            gap={5}
          >
            <LayerContent
              summary={summary}
              altAz={altAz}
              handleEditStyle={handleEditStyle}
            />

            <LayerDownloads
              summary={summary}
              soniReady={soniReady}
              audioKey={audioKey}
              audioSystem={audioSystem}
            />
          </VStack>
        ))
      )}
    </VStack>
  );
};

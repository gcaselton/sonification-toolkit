import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  ActionBar,
  Box,
  Button,
  Card,
  Badge,
  Dialog,
  Editable,
  Stack,
  FileUpload,
  Heading,
  VStack,
  HStack,
  Text,
  IconButton,
  Select,
  createListCollection,
  CloseButton,
  Separator,
  Portal,
  Link,
  Input,
  Field,
  Checkbox,
  Spinner,
  useLocaleContext,
} from "@chakra-ui/react";
import PageContainer from "../ui/PageContainer";
import { Tooltip } from "../ui/Tooltip";
import { composerAPI, coreAPI } from "../../apiConfig";
import { useComposer } from "../../context/ComposerContext";
import { Layer } from "../../types/layers";
import {
  LuPlus,
  LuCheck,
  LuX,
  LuCopy,
  LuTrash2,
  LuTriangleAlert,
  LuArrowRight,
  LuUpload,
  LuSlidersHorizontal,
  LuPalette,
  LuCircleHelp,
  LuSettings2,
  LuSettings,
} from "react-icons/lu";
import ErrorMsg from "../ui/ErrorMsg";
import HelperDialog from "../ui/data_composer/HelperDialog";
import { apiRequest } from "../../utils/requests";
import UploadDialog from "../ui/data_composer/UploadDialog";
import DeleteDialog from "../ui/data_composer/DeleteDialog";
import ValidationBadges from "../ui/data_composer/ValidationBadges";
import { NavigationState } from "../../types/navigation";

function makeLayerId() {
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeEmptyLayer(index: number): Layer {
  return {
    id: makeLayerId(),
    label: `Layer ${index}`,
    dataName: null,
    dataRef: null,
    reusedFromLayerId: null,
    refined: false,
    idColumn: null,
    styleRef: null,
    styleName: null,
    styleDescription: null,
    missingColumns: [],
    nonNumericColumns: [],
    insufficientColumns: null,
    volume: 1
  };
}

const MAX_LAYERS = 8;

export default function DataComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const soniType = "data_composer";

  const { layers, setLayers, updateLayer } = useComposer();

  // Tracks each layer's current dropdown choice ("new" or another layer's id)
  const [dataSourceChoice, setDataSourceChoice] = useState<
    Record<string, string>
  >({});

  // Which layers currently have their Data slot open for editing
  // (either because they have no data yet, or the user clicked "Change").
  const [editingLayerIds, setEditingLayerIds] = useState<Set<string>>(
    new Set(),
  );

  // Which layers are currently validating the style/data combination
  const [validatingLayerIds, setValidatingLayerIds] = useState<Set<string>>(
    new Set(),
  );

  const lastValidatedRef = useRef<
    Record<string, { dataRef: string | null; styleRef: string | null }>
  >({});

  const isEditingData = (layer: Layer) =>
    !layer.dataName || editingLayerIds.has(layer.id);

  // track which layer is uploading data/needs the UploadDialog open
  const [uploadLayerId, setUploadLayerId] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const dependentsOf = (layerId: string) =>
    layers.filter((l) => l.reusedFromLayerId === layerId);

  // ---- Add layer ----
  const handleAddLayer = () => {
    if (layers.length >= MAX_LAYERS) return;
    const newLayer = makeEmptyLayer(layers.length + 1);
    setLayers((prev) => [...prev, newLayer]);
  };

  // ---- Data slot: choose source (reuse vs upload) ----

  const reuseOptionsForLayer = (layerId: string) =>
    createListCollection({
      items: [
        { label: "Upload new data", value: "new" },
        ...layers
          .filter((l) => l.id !== layerId && l.dataName)
          .map((l) => ({
            label: `${l.label} (${l.dataName})`,
            value: l.id,
          })),
      ],
    });

  const handleDataSourceChange = (layerId: string, value: string) => {
    setDataSourceChoice((prev) => ({ ...prev, [layerId]: value }));

    if (value === "new") return; // still editing — reveal the upload button

    const layer = layers.find((l) => l.id === layerId);
    const source = layers.find((l) => l.id === value);
    if (!layer || !source) return;

    updateLayer(layerId, {
      reusedFromLayerId: source.id,
      dataName: source.dataName,
      dataRef: source.dataRef,
      refined: source.refined,
      idColumn: source.idColumn,
      styleRef: null,
      styleName: null,
      styleDescription: null,
      missingColumns: [],
      nonNumericColumns: [],
      insufficientColumns: null,
    });

    // Reuse selected successfully — close edit mode for this layer.
    setEditingLayerIds((prev) => {
      const next = new Set(prev);
      next.delete(layerId);
      return next;
    });
  };

  // ---- Duplicate / delete ----

  const handleDuplicateLayer = (id: string) => {
    if (layers.length >= MAX_LAYERS) return;

    const source = layers.find((l) => l.id === id);
    if (!source) return;

    // Remove any existing "(Copy)" or "(Copy N)" suffix.
    const baseLabel = source.label.replace(/ \(Copy(?: \d+)?\)$/, "");

    // Count existing copies of this base label.
    const copyCount =
      layers.filter(
        (l) =>
          l.label === baseLabel ||
          l.label.match(
            new RegExp(
              `^${baseLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(Copy(?: \\d+)?\\)$`,
            ),
          ),
      ).length - 1;

    const label =
      copyCount === 0
        ? `${baseLabel} (Copy)`
        : `${baseLabel} (Copy ${copyCount + 1})`;

    const copy: Layer = {
      ...source,
      id: makeLayerId(),
      label,
      reusedFromLayerId:
        source.dataRef == null ? null : (source.reusedFromLayerId ?? source.id),
    };

    setLayers((prev) => [...prev, copy]);
  };

  const handleRequestDelete = (id: string) => {
    if (dependentsOf(id).length > 0) {
      // Open the DeleteDialog if there are dependent layers
      setPendingDeleteId(id);
    } else {
      deleteLayer(id);
    }
  };

  const deleteLayer = (id: string) => {
    setLayers((prev) => {
      const remaining = prev.filter((l) => l.id !== id);
      return remaining.map((l) =>
        l.reusedFromLayerId === id
          ? {
              ...l,
              reusedFromLayerId: null,
              dataName: null,
              dataRef: null,
              refined: false,
              idColumn: null,
              styleRef: null,
              styleName: null,
              styleDescription: null,
              missingColumns: [],
              nonNumericColumns: [],
              insufficientColumns: null,
            }
          : l,
      );
    });
    setPendingDeleteId(null);
  };

  // Trigger layer validation if dataRef or styleRef changes
  useEffect(() => {
    layers.forEach((layer) => {
      // Need both before validation can run
      if (!layer.dataRef || !layer.styleRef) {
        return;
      }

      const previous = lastValidatedRef.current[layer.id];

      const changed =
        !previous ||
        previous.dataRef !== layer.dataRef ||
        previous.styleRef !== layer.styleRef;

      if (!changed) {
        return;
      }

      lastValidatedRef.current[layer.id] = {
        dataRef: layer.dataRef,
        styleRef: layer.styleRef,
      };

      validateLayer(layer);
    });
  }, [layers]);

  // Ensure the dataset and style are compatible
  // That is, ensure the mapped columns in Style exist in the data and they don't contain non-numeric data
  const validateLayer = async (layer: Layer) => {
    setValidatingLayerIds((prev) => new Set(prev).add(layer.id));

    const endpoint = `${composerAPI}/validate-layer/`;
    const payload = {
      data_ref: layer.dataRef,
      style_ref: layer.styleRef,
    };

    try {
      const result = await apiRequest(endpoint, payload);

      // Add any missing/invalid columns to the layer (this renders a warning badge on that layer)
      updateLayer(layer.id, {
        missingColumns: result.missing_columns,
        nonNumericColumns: result.non_numeric_columns,
        insufficientColumns: result.insufficient_columns,
      });
    } finally {
      // remove layer from the validating list
      setValidatingLayerIds((prev) => {
        const next = new Set(prev);
        next.delete(layer.id);
        return next;
      });
    }
  };

  const allLayersReady =
    layers.length > 0 &&
    validatingLayerIds.size === 0 &&
    layers.every(
      (l) =>
        l.dataName &&
        l.styleName &&
        !isEditingData(l) &&
        l.missingColumns.length === 0 &&
        l.nonNumericColumns.length === 0 &&
        !l.insufficientColumns,
    );

  const handleRefine = (layer: Layer) => {
    const state: NavigationState = {
      dataName: layer.dataName,
      sourceDataRef: layer.dataRef,
      layerID: layer.id,
      idColumn: layer.idColumn,
      soniType,
    };
    navigate("refine", { state });
  };

  const handleChooseStyle = (layer: Layer, editStyleRef?: string) => {
    const state: NavigationState = {
      dataName: layer.dataName,
      dataRef: layer.dataRef,
      layerID: layer.id,
      soniType,
      userUpload: true, // tell custom style menu we are using user data
      ...(editStyleRef !== undefined && { editStyle: editStyleRef }), // Only pass edit style if provided (e.g. user has clicked the edit button)
    };
    navigate("style", { state });
  };

  const handleContinueToSonify = () => {
    const state: NavigationState = { ...location.state, layers, soniType }
    navigate("sonify", { state });
  };

  const pendingDeleteLayer = layers.find((l) => l.id === pendingDeleteId);
  const pendingDeleteDependents = pendingDeleteId
    ? dependentsOf(pendingDeleteId)
    : [];

  return (
    <PageContainer>
      <Heading as="h1">Data Composer</Heading>
      <br />
      <Stack direction={{ base: "column", md: "row" }} gap="4">
        <Text textStyle="lg">
          Build a layered sonification from your own data.
        </Text>
        <Link
          onClick={() => setHowItWorksOpen(true)}
          color="teal.500"
          fontSize="sm"
          cursor="pointer"
          whiteSpace="nowrap"
        >
          <HStack gap="2">
            <LuCircleHelp />
            <Text>How does this work?</Text>
          </HStack>
        </Link>
      </Stack>
      <br />
      <br />

      {layers.length === 0 ? (
        <Box
          borderWidth="1px"
          borderStyle="dashed"
          borderRadius="lg"
          py="12"
          px="6"
          textAlign="center"
        >
          <Text color="fg.muted" mb="4">
            You haven't added any layers yet.
          </Text>
          <Button colorPalette="teal" onClick={handleAddLayer}>
            <LuPlus /> Add your first layer
          </Button>
        </Box>
      ) : (
        <Stack gap="4" animation="fade-in 300ms ease-out">
          {layers.map((layer) => {
            const canChooseStyle = !!layer.dataName;
            const hasReusableData = layers.some(
              (l) => l.id !== layer.id && l.dataName,
            );

            return (
              <Card.Root
                key={layer.id}
                variant="outline"
                width="100%"
                animation="fade-in 300ms ease-out"
              >
                <Card.Body>
                  <Stack
                    direction={{ base: "column", md: "row" }}
                    justify="space-between"
                    align={{ base: "stretch", md: "center" }}
                    gap="3"
                    mb="4"
                  >
                    <HStack>
                      <Card.Title>
                        <Editable.Root
                          value={layer.label}
                          onValueChange={(e) =>
                            updateLayer(layer.id, { label: e.value })
                          }
                        >
                          <Editable.Preview
                            textStyle="lg"
                            fontWeight="semibold"
                          />
                          <Editable.Input
                            textStyle="lg"
                            fontWeight="semibold"
                          />
                          <Editable.Control>
                            <Editable.CancelTrigger asChild>
                              <IconButton variant="outline" size="xs">
                                <LuX />
                              </IconButton>
                            </Editable.CancelTrigger>
                            <Editable.SubmitTrigger asChild>
                              <IconButton variant="outline" size="xs">
                                <LuCheck />
                              </IconButton>
                            </Editable.SubmitTrigger>
                          </Editable.Control>
                        </Editable.Root>
                      </Card.Title>
                      <ValidationBadges
                        layer={layer}
                        validating={validatingLayerIds.has(layer.id)}
                      />
                    </HStack>
                    <HStack
                      gap="1"
                      justify={{ base: "flex-end", md: "flex-start" }}
                    >
                      <Tooltip content="Duplicate layer">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          aria-label={`Duplicate ${layer.label}`}
                          disabled={layers.length >= MAX_LAYERS}
                          onClick={() => handleDuplicateLayer(layer.id)}
                        >
                          <LuCopy />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="Delete layer">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          colorPalette="red"
                          aria-label={`Delete ${layer.label}`}
                          onClick={() => handleRequestDelete(layer.id)}
                        >
                          <LuTrash2 />
                        </IconButton>
                      </Tooltip>
                    </HStack>
                  </Stack>

                  <Stack direction={{ base: "column", sm: "row" }} gap="3">
                    {/* Data slot */}
                    <Box flex="1" borderWidth="1px" borderRadius="md" p="3">
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        color="fg.muted"
                        mb="2"
                      >
                        DATA
                      </Text>
                      {!isEditingData(layer) ? (
                        <VStack align="start" gap="2">
                          <Box>
                            <Text fontWeight="medium">{layer.dataName}</Text>
                            {layer.reusedFromLayerId && (
                              <Text fontSize="xs" color="fg.muted">
                                Same as{" "}
                                {
                                  layers.find(
                                    (l) => l.id === layer.reusedFromLayerId,
                                  )?.label
                                }
                              </Text>
                            )}
                          </Box>
                          <HStack gap="2" flexWrap="wrap">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                setEditingLayerIds((prev) =>
                                  new Set(prev).add(layer.id),
                                )
                              }
                            >
                              Change
                            </Button>
                            <Button
                              size="xs"
                              variant={layer.refined ? "outline" : "solid"}
                              colorPalette="teal"
                              onClick={() => handleRefine(layer)}
                            >
                              <LuSlidersHorizontal />
                              {layer.refined ? "Refine" : "Refine data"}
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <HStack align="start" gap="2">
                          {isEditingData(layer) && hasReusableData && (
                            <Select.Root
                              collection={reuseOptionsForLayer(layer.id)}
                              value={[dataSourceChoice[layer.id] ?? "new"]}
                              onValueChange={(e) =>
                                handleDataSourceChange(layer.id, e.value[0])
                              }
                              width="100%"
                              size="sm"
                            >
                              <Select.Control>
                                <Select.Trigger>
                                  <Select.ValueText />
                                </Select.Trigger>
                                <Select.IndicatorGroup>
                                  <Select.Indicator />
                                </Select.IndicatorGroup>
                              </Select.Control>
                              <Portal>
                                <Select.Positioner>
                                  <Select.Content>
                                    {reuseOptionsForLayer(layer.id).items.map(
                                      (option) => (
                                        <Select.Item
                                          item={option}
                                          key={option.value}
                                        >
                                          {option.label}
                                          <Select.ItemIndicator />
                                        </Select.Item>
                                      ),
                                    )}
                                  </Select.Content>
                                </Select.Positioner>
                              </Portal>
                            </Select.Root>
                          )}
                          {isEditingData(layer) &&
                            (!hasReusableData ||
                              (dataSourceChoice[layer.id] ?? "new") ===
                                "new") && (
                              <Button
                                colorPalette="teal"
                                size="sm"
                                onClick={() => setUploadLayerId(layer.id)}
                              >
                                <LuUpload />
                                Upload data
                              </Button>
                            )}
                        </HStack>
                      )}
                    </Box>

                    {/* Style slot */}
                    <Box flex="1" borderWidth="1px" borderRadius="md" p="3">
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        color="fg.muted"
                        mb="2"
                      >
                        STYLE
                      </Text>
                      {layer.styleName ? (
                        <VStack align="start" gap="2">
                          <Text fontWeight="medium">{layer.styleName}</Text>
                          <HStack>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleChooseStyle(layer)}
                            >
                              Change
                            </Button>
                            {layer.styleName === "Custom" && (
                              <Tooltip content="Open in the custom style menu">
                                <Button
                                  size="xs"
                                  colorPalette="teal"
                                  variant="outline"
                                  onClick={() =>
                                    handleChooseStyle(layer, layer.styleRef!)
                                  }
                                >
                                  <LuSettings /> Edit
                                </Button>
                              </Tooltip>
                            )}
                          </HStack>
                        </VStack>
                      ) : (
                        <Tooltip
                          content="Add data to this layer first"
                          disabled={canChooseStyle}
                        >
                          <Button
                            size="sm"
                            colorPalette="teal"
                            disabled={!canChooseStyle}
                            onClick={() => handleChooseStyle(layer)}
                          >
                            <LuPalette /> Choose style
                          </Button>
                        </Tooltip>
                      )}
                    </Box>
                  </Stack>
                </Card.Body>
              </Card.Root>
            );
          })}

          <UploadDialog
            open={uploadLayerId !== null}
            onOpenChange={(open) => {
              if (!open) setUploadLayerId(null);
            }}
            onUploadComplete={(fileName, fileRef) => {
              if (!uploadLayerId) return;

              updateLayer(uploadLayerId, {
                dataName: fileName,
                dataRef: fileRef,
                reusedFromLayerId: null,
                refined: false,
                styleRef: null,
                styleName: null,
                styleDescription: null,
                missingColumns: [],
                nonNumericColumns: [],
                insufficientColumns: null,
              });

              setEditingLayerIds((prev) => {
                const next = new Set(prev);
                next.delete(uploadLayerId);
                return next;
              });

              setUploadLayerId(null);
            }}
          />

          <Box>
            <Button
              variant="outline"
              onClick={handleAddLayer}
              disabled={layers.length >= MAX_LAYERS}
            >
              <LuPlus /> Add layer
            </Button>
            {layers.length >= MAX_LAYERS && (
              <Text fontSize="xs" color="fg.muted" mt="1">
                Maximum of {MAX_LAYERS} layers reached.
              </Text>
            )}
          </Box>
        </Stack>
      )}

      {layers.length > 0 && (
        <>
          <br />
          <HStack justify="flex-end">
            <Tooltip
              content="Every layer needs valid data and style selected before you can continue."
              disabled={allLayersReady}
            >
              <Button
                colorPalette="teal"
                size="lg"
                disabled={!allLayersReady}
                onClick={handleContinueToSonify}
              >
                Continue to Sonify <LuArrowRight />
              </Button>
            </Tooltip>
          </HStack>
        </>
      )}

      {/* Delete confirmation: warn about dependent layers */}
      <DeleteDialog
        open={pendingDeleteId !== null}
        layerLabel={pendingDeleteLayer?.label ?? null}
        dependentLabels={pendingDeleteDependents.map((l) => l.label)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteLayer(pendingDeleteId);
          }
        }}
      />

      {/* How does this work? */}
      <HelperDialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
    </PageContainer>
  );
}

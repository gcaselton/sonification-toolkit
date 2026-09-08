import {
  Box,
  Button,
  Badge,
  Checkbox,
  Field,
  RadioCard,
  Slider,
  Skeleton,
  Stack,
  Table,
  Text,
  VStack,
  HStack,
  Input,
  Select,
  Portal,
  createListCollection,
} from "@chakra-ui/react";
import { RefineMenuProps } from "../../types/refine_menu";
import { useState, useEffect, useMemo, useCallback } from "react";
import LoadingMessage from "../ui/LoadingMessage";
import ErrorMsg from "../ui/ErrorMsg";
import { composerAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import { InfoTip } from "../ui/ToggleTip";
import { LuArrowRight, LuTriangleAlert } from "react-icons/lu";
import { debounce } from "es-toolkit";
import NaNHandler, { NanStrategy } from "../ui/NaNHandler";
import { DiscAlbum } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";

interface ColumnInfo {
  name: string;
  NaNs: number;
  unique: boolean;
}

export default function DataComposer({
  dataName,
  dataRef,
  idColumn: prevIdColumn,
  onApply,
}: RefineMenuProps) {
  // Column metadata, fetched once on mount
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(),
  );
  const [totalRows, setTotalRows] = useState(0);
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [columnsError, setColumnsError] = useState("");

  const [idColumn, setIdColumn] = useState(prevIdColumn ?? "none");

  // Missing-value handling
  const [nanStrategy, setNanStrategy] = useState<NanStrategy>("silence");
  const [fillWith, setFillWith] = useState("mean");

  // Row range
  const [rowRange, setRowRange] = useState<[number, number]>([0, 0]);

  // Preview (re-fetched whenever the above change)
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");

  const [applyLoading, setApplyLoading] = useState(false);

  const hasNanColumns = columns.some(
    (c) => selectedColumns.has(c.name) && c.NaNs > 0,
  );

  // How many rows to preview in the table
  const N_PREVIEW_ROWS = 15;

  // ---- Fetch column metadata on mount ----
  useEffect(() => {
    if (!dataRef) return;

    let mounted = true;
    async function fetchColumns() {
      setColumnsLoading(true);
      setColumnsError("");

      const endpoint = `${composerAPI}/get-columns/`;
      try {
        const result = await apiRequest(
          endpoint,
          { file_ref: dataRef },
          "POST",
        );
        if (!mounted) return;

        setColumns(result.columns);
        setSelectedColumns(
          new Set(result.columns.map((c: ColumnInfo) => c.name)),
        );
        setTotalRows(result.total_rows);
        setRowRange([0, result.total_rows]);
      } catch (err) {
        if (!mounted) return;
        console.error("Error fetching column info:", err);
        setColumnsError("Unable to read columns from this file.");
      } finally {
        if (mounted) setColumnsLoading(false);
      }
    }
    fetchColumns();
    return () => {
      mounted = false;
    };
  }, [dataRef]);

  // create the options for the Identifier column select
  const idColumnOptions = useMemo(
    () =>
      createListCollection({
        items: [
          ...columns
            .filter((col) => selectedColumns.has(col.name))
            .map((col) => ({
              label: col.name,
              value: col.name,
              unique: col.unique,
            })),
          { label: "None", value: "none", unique: true },
        ],
      }),
    [columns, selectedColumns],
  );

  // Clear the Identifier column select if the chosen column gets deselected
  useEffect(() => {
    if (
      !columnsLoading &&
      idColumn !== "none" &&
      !selectedColumns.has(idColumn)
    ) {
      setIdColumn("none");
    }
  }, [columnsLoading, selectedColumns, idColumn]);

  // ---- Fetch preview whenever refine settings change ----
  const fetchPreview = useCallback(
    async (
      cols: string[],
      strategy: NanStrategy,
      fillWith: string,
      range: [number, number],
    ) => {
      if (!dataRef || cols.length === 0) return;
      setPreviewLoading(true);
      setPreviewError("");

      const endpoint = `${composerAPI}/preview-refined/`;
      const payload = {
        file_ref: dataRef,
        columns: cols,
        nan_strategy: strategy,
        fill_with: strategy === "fill" ? fillWith : undefined,
        row_range: range,
        n_preview_rows: N_PREVIEW_ROWS,
      };

      try {
        const result = await apiRequest(endpoint, payload, "POST");
        setPreviewRows(result.rows);
      } catch (err) {
        console.error("Error previewing data:", err);
        setPreviewError("Unable to generate a preview.");
      } finally {
        setPreviewLoading(false);
      }
    },
    [dataRef],
  );

  const debouncedFetchPreview = useMemo(
    () => debounce(fetchPreview, 300),
    [fetchPreview],
  );

  useEffect(() => {
    return () => {
      debouncedFetchPreview.cancel();
    };
  }, [debouncedFetchPreview]);

  useEffect(() => {
    if (columnsLoading) return;
    debouncedFetchPreview(
      Array.from(selectedColumns),
      nanStrategy,
      fillWith,
      rowRange,
    );
  }, [selectedColumns, nanStrategy, fillWith, rowRange, columnsLoading]);

  // ---- Handlers ----

  const handleToggleColumn = (name: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  };

  const handleApply = async () => {
    setApplyLoading(true);

    const endpoint = `${composerAPI}/save-refined/`;
    const payload = {
      file_ref: dataRef,
      columns: Array.from(selectedColumns),
      nan_strategy: nanStrategy,
      fill_with: nanStrategy === "fill" ? fillWith : undefined,
      row_range: rowRange,
    };

    try {
      const result = await apiRequest(endpoint, payload, "POST");
      if (onApply) {
        onApply({
          newRef: result.file_ref,
          idColumn: idColumn === "none" ? null : idColumn,
        });
      }
    } catch (err) {
      console.error("Error saving refined data:", err);
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <Stack
      gap="10"
      align="start"
      justify="center"
      direction={{ base: "column", md: "row" }}
    >
      <Box flex="1" maxWidth={{ base: "100%", md: "50%" }}>
        <VStack align="stretch" gap="8">
          {/* Columns */}
          <Box>
            <HStack mb="2">
              <Text fontWeight="bold">Columns</Text>
              <InfoTip
                content="Choose which columns to keep. If using a suggested style, columns will be mapped in the order they appear here."
                positioning={{ placement: "right" }}
                contentProps={{ maxW: "300px" }}
              />
            </HStack>
            {columnsLoading ? (
              <Skeleton height="8em" />
            ) : columnsError ? (
              <ErrorMsg message={columnsError} />
            ) : (
              <VStack
                align="stretch"
                gap="1"
                borderWidth="1px"
                borderRadius="md"
                p="3"
              >
                {columns.map((col) => (
                  <HStack key={col.name} justify="space-between">
                    <Checkbox.Root
                      checked={selectedColumns.has(col.name)}
                      onCheckedChange={(e) =>
                        handleToggleColumn(col.name, !!e.checked)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>{col.name}</Checkbox.Label>
                    </Checkbox.Root>
                    {col.NaNs > 0 && (
                      <Badge colorPalette="orange" size="sm" gap="1">
                        <LuTriangleAlert />
                        {col.NaNs} missing value{col.NaNs > 1 && "s"}
                      </Badge>
                    )}
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          <Field.Root width="fit-content">
            <Select.Root
              collection={idColumnOptions}
              value={idColumn ? [idColumn] : []}
              onValueChange={(e) => {
                setIdColumn(e.value[0] ?? null);
              }}
            >
              <Select.HiddenSelect />
              <HStack>
                <Text fontWeight="bold">Identifier column</Text>
                <InfoTip
                  content="Choose a column that identifies each row in your data. After sonifying, this column will be included in the downloadable Mapping Table, helping you identify which data point is being mapped to each event. This is useful when each row represents a discrete object, such as a star. The column is not used for sonification."
                  positioning={{ placement: "right" }}
                  contentProps={{ maxW: "400px" }}
                />
              </HStack>

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
                    {idColumnOptions.items.map((item, i) => {
                      return (
                        <Tooltip
                          openDelay={200}
                          key={item.value}
                          disabled={item.unique}
                          content="Only columns with unique values can be used as the identifier"
                        >
                          <Select.Item
                            item={{ ...item, disabled: !item.unique }}
                            key={i}
                            _disabled={{
                              opacity: 0.4,
                              cursor: "not-allowed",
                              pointerEvents: "auto",
                            }}
                          >
                            {item.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        </Tooltip>
                      );
                    })}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
            <Field.HelperText>
              Optionally choose a column to identify each row in the Mapping
              Table.
            </Field.HelperText>
          </Field.Root>

          {/* Missing values */}
          {!columnsLoading && hasNanColumns && (
            <NaNHandler
              strategy={nanStrategy}
              onStrategyChange={setNanStrategy}
              fillWith={fillWith}
              onFillWithChange={setFillWith}
            />
          )}

          {/* Row range */}
          {!columnsLoading && (
            <Box>
              <HStack mb="2">
                <Text fontWeight="bold">Row range</Text>
                <InfoTip
                  content="Limit the sonification to a subset of rows"
                  positioning={{ placement: "right" }}
                />
              </HStack>
              <Slider.Root
                w="100%"
                step={1}
                colorPalette="teal"
                min={0}
                max={totalRows}
                value={rowRange}
                minStepsBetweenThumbs={1}
                onValueChange={(e) => setRowRange(e.value as [number, number])}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumbs />
                </Slider.Control>
              </Slider.Root>
              <Text fontSize="sm" color="fg.muted" mt="1">
                Rows {rowRange[0] + 1}–{rowRange[1]} of {totalRows}
              </Text>
            </Box>
          )}

          <Button
            onClick={handleApply}
            colorPalette="teal"
            loading={applyLoading}
            loadingText="Saving..."
            disabled={columnsLoading || selectedColumns.size === 0}
          >
            Apply & Continue <LuArrowRight />
          </Button>
        </VStack>
      </Box>

      <Box flex="1" width="100%" maxWidth={{ base: "100%", md: "50%" }}>
        <VStack align="stretch" gap="3">
          {!columnsLoading && (
            <Text fontSize="sm" color="fg.muted">
              {totalRows} rows
              {totalRows > N_PREVIEW_ROWS &&
                ` (previewing first ${N_PREVIEW_ROWS})`}{" "}
              · {columns.length} columns
              {hasNanColumns &&
                ` · ${columns.filter((c) => selectedColumns.has(c.name) && c.NaNs > 0).length} with missing values`}
            </Text>
          )}

          {previewLoading ? (
            <LoadingMessage msg="Generating preview..." icon="pulsar" />
          ) : previewError ? (
            <ErrorMsg message={previewError} />
          ) : previewRows.length > 0 ? (
            <Box overflowX="auto" animation="fade-in 300ms ease-out">
              <Table.Root size="sm" interactive>
                <Table.Header>
                  <Table.Row>
                    {Array.from(selectedColumns).map((col) => (
                      <Table.ColumnHeader key={col} fontWeight="bold">
                        {col}
                      </Table.ColumnHeader>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {previewRows.map((row, i) => (
                    <Table.Row key={i}>
                      {Array.from(selectedColumns).map((col) => (
                        <Table.Cell key={col}>
                          {String(row[col] ?? "")}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          ) : (
            <ErrorMsg message="No preview available." />
          )}
        </VStack>
      </Box>
    </Stack>
  );
}

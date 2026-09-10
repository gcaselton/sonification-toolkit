export interface Layer {
  id: string;
  label: string;

  // Data info
  dataName: string | null;
  dataRef: string | null;
  reusedFromLayerId: string | null;
  refined: boolean;
  idColumn: string | null;

  // Style info
  styleRef: string | null;
  styleName: string | null;
  styleDescription: string | null;

  // Validation
  missingColumns: string[]; // columns mapped in Style but not present in data
  nonNumericColumns: string[]; // columns mapped in Style but contain non-numeric data
  insufficientColumns: InsufficientColumns | null;

  // Volume level for the mixer on Sonify page
  volume: number;
}

// Used if there are more (unnnamed) columns in the Style than there are in the data
interface InsufficientColumns {
  style: number,
  data: number
}
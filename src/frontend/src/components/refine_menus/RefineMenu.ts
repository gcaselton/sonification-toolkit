
export interface RefineMenuProps {
  dataRef: string;
  dataName?: string;
  onApply?: (newRef: string, newRa?: number, newDec?: number) => void;
}

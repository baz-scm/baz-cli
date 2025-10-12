export interface SelectionLines {
  start?: number;
  end?: number;
  side?: "left" | "right";
}

export type FileSelectionLines = Map<string, SelectionLines>;

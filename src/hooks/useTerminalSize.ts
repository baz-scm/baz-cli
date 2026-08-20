import { useEffect, useState } from "react";
import { useStdout } from "ink";

export interface TerminalSize {
  columns: number;
  rows: number;
}

const DEFAULT_SIZE: TerminalSize = { columns: 80, rows: 24 };

/** Terminal dimensions, kept in sync with window resizes. */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => ({
    columns: stdout?.columns ?? DEFAULT_SIZE.columns,
    rows: stdout?.rows ?? DEFAULT_SIZE.rows,
  }));

  useEffect(() => {
    if (!stdout) return;

    const onResize = () => {
      setSize((previous) => {
        const columns = stdout.columns ?? DEFAULT_SIZE.columns;
        const rows = stdout.rows ?? DEFAULT_SIZE.rows;
        if (previous.columns === columns && previous.rows === rows) {
          return previous;
        }
        return { columns, rows };
      });
    };

    onResize();
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}

/** Rows below which the UI trims its chrome to leave room for content. */
export const COMPACT_ROWS = 24;

/** True when the window is too short for the roomy banner and hint block. */
export function useCompactChrome(threshold = COMPACT_ROWS): boolean {
  return useTerminalSize().rows < threshold;
}

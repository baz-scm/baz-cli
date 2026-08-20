import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, DOMElement, measureElement } from "ink";

interface ScreenLayoutValue {
  /** Rows taken by chrome that must always stay on screen. */
  reservedRows: number;
  reserve: (id: string, rows: number) => void;
  release: (id: string) => void;
}

const ScreenLayoutContext = createContext<ScreenLayoutValue>({
  reservedRows: 0,
  reserve: () => {},
  release: () => {},
});

/**
 * Tracks how many terminal rows are used by things that are never scrolled -
 * the banner, the selected-PR line, the chat input - so a scrollable viewport
 * can size itself to whatever is left.
 */
export const ScreenLayoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [rowsById, setRowsById] = useState<Record<string, number>>({});

  const reserve = useCallback((id: string, rows: number) => {
    setRowsById((previous) =>
      previous[id] === rows ? previous : { ...previous, [id]: rows },
    );
  }, []);

  const release = useCallback((id: string) => {
    setRowsById((previous) => {
      if (!(id in previous)) return previous;
      return Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== id),
      );
    });
  }, []);

  const reservedRows = useMemo(
    () => Object.values(rowsById).reduce((total, rows) => total + rows, 0),
    [rowsById],
  );

  const value = useMemo(
    () => ({ reservedRows, reserve, release }),
    [reservedRows, reserve, release],
  );

  return (
    <ScreenLayoutContext.Provider value={value}>
      {children}
    </ScreenLayoutContext.Provider>
  );
};

export function useReservedRows(): number {
  return useContext(ScreenLayoutContext).reservedRows;
}

interface ReservedRowsProps {
  /** Stable identifier for this piece of chrome. */
  id: string;
  children: React.ReactNode;
}

/**
 * Measures its children and reports their height as reserved. Wrap anything
 * that sits outside a scrollable viewport but shares the same screen.
 */
export const ReservedRows: React.FC<ReservedRowsProps> = ({ id, children }) => {
  const ref = useRef<DOMElement | null>(null);
  const { reserve, release } = useContext(ScreenLayoutContext);

  // Height changes as the content does (the input grows when help is shown).
  useEffect(() => {
    if (!ref.current) return;
    reserve(id, measureElement(ref.current).height);
  });

  useEffect(() => () => release(id), [id, release]);

  return (
    <Box ref={ref} flexDirection="column" flexShrink={0}>
      {children}
    </Box>
  );
};

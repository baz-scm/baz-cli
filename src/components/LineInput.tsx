import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "ink";
import { useKeySequences } from "../hooks/useKeySequences.js";
import {
  applyEditorAction,
  parseKeySequence,
  type EditorAction,
} from "../lib/input/line-editor.js";

interface LineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  isActive?: boolean;
  /**
   * Sees every key sequence before the editor does, for keys the host needs
   * (arrow navigation, chords). Return `true` to stop the editor handling it.
   */
  onKey?: (
    sequence: string,
    action: EditorAction | null,
  ) => boolean | undefined;
}

/**
 * A single line text input with full command line editing: Home/End, Ctrl+A /
 * Ctrl+E, Alt+Arrow and Cmd+Arrow, and the readline deletion chords. Replaces
 * `ink-text-input`, which only understands the plain arrow keys.
 */
const LineInput: React.FC<LineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "",
  isActive = true,
  onKey,
}) => {
  const [cursor, setCursor] = useState(value.length);
  const position = Math.min(cursor, value.length);

  const handleSequence = useCallback(
    (sequence: string) => {
      const action = parseKeySequence(sequence);
      if (onKey?.(sequence, action)) return;
      if (!action) return;

      if (action.type === "submit") {
        onSubmit?.(value);
        return;
      }

      if (
        action.type === "escape" ||
        action.type === "tab" ||
        action.type === "up" ||
        action.type === "down"
      ) {
        return;
      }

      const previous = { text: value, cursor: position };
      const next = applyEditorAction(previous, action);
      if (next === previous) return;

      setCursor(next.cursor);
      if (next.text !== previous.text) onChange(next.text);
    },
    [onChange, onKey, onSubmit, position, value],
  );

  // Keep the stdin subscription stable while still calling the latest handler
  const handlerRef = useRef(handleSequence);
  useEffect(() => {
    handlerRef.current = handleSequence;
  }, [handleSequence]);

  const onSequence = useCallback((sequence: string) => {
    handlerRef.current(sequence);
  }, []);

  useKeySequences(onSequence, { isActive });

  if (!value) {
    if (!placeholder) {
      return isActive ? <Text inverse> </Text> : <Text> </Text>;
    }
    return isActive ? (
      <Text dimColor>
        <Text inverse>{placeholder.slice(0, 1)}</Text>
        {placeholder.slice(1)}
      </Text>
    ) : (
      <Text dimColor>{placeholder}</Text>
    );
  }

  if (!isActive) return <Text>{value}</Text>;

  return (
    <Text>
      {value.slice(0, position)}
      <Text inverse>{value[position] ?? " "}</Text>
      {value.slice(position + 1)}
    </Text>
  );
};

export default LineInput;

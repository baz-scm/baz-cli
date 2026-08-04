import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "ink";
import { useKeySequences } from "../hooks/useKeySequences.js";
import {
  applyEditorAction,
  charAt,
  parseKeySequence,
  type EditorAction,
  type EditorState,
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
  // Only a redraw trigger: the buffer below is the source of truth
  const [, redraw] = useState(0);

  // A single stdin chunk can carry several keys, and they are handled in one
  // synchronous burst — before the parent has re-rendered with the new `value`.
  // The buffer therefore lives in a ref, so each key sees the one before it.
  const editorRef = useRef<EditorState>({ text: value, cursor: value.length });
  const emittedRef = useRef(value);

  // The parent changed the value itself (cleared it, picked a mention, …)
  if (value !== emittedRef.current) {
    emittedRef.current = value;
    editorRef.current = { text: value, cursor: value.length };
  }

  const position = Math.min(editorRef.current.cursor, value.length);

  const handleSequence = useCallback(
    (sequence: string) => {
      const action = parseKeySequence(sequence);
      if (onKey?.(sequence, action)) return;
      if (!action) return;

      if (action.type === "submit") {
        onSubmit?.(editorRef.current.text);
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

      const previous = editorRef.current;
      const next = applyEditorAction(previous, action);
      if (next === previous) return;

      editorRef.current = next;
      redraw((tick) => tick + 1);
      if (next.text !== previous.text) {
        emittedRef.current = next.text;
        onChange(next.text);
      }
    },
    [onChange, onKey, onSubmit],
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

  // The cursor sits on a whole grapheme, which can be several code units
  const cursorChar = charAt(value, position) || " ";

  return (
    <Text>
      {value.slice(0, position)}
      <Text inverse>{cursorChar}</Text>
      {value.slice(position + cursorChar.length)}
    </Text>
  );
};

export default LineInput;

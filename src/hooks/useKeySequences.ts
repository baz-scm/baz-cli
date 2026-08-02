import { useEffect } from "react";
import { useStdin } from "ink";
import { tokenizeKeySequences } from "../lib/input/line-editor.js";

/**
 * Calls `onSequence` with every raw key sequence read from stdin.
 *
 * Ink's own `useInput` cannot be used for line editing: it throws away the
 * sequence and reports Home/End as an empty input with no key flags, and it
 * collapses Alt and Cmd into a single `meta` flag. Ink already reads stdin and
 * re-emits each chunk untouched, so subscribe to that instead. Raw mode is
 * enabled here exactly as `useInput` would do it, so the terminal delivers keys
 * as they are pressed.
 */
export const useKeySequences = (
  onSequence: (sequence: string) => void,
  options: { isActive?: boolean } = {},
): void => {
  const isActive = options.isActive ?? true;
  const {
    setRawMode,
    isRawModeSupported,
    internal_eventEmitter: inputEmitter,
  } = useStdin();
  const canReadKeys = isActive && isRawModeSupported;

  useEffect(() => {
    if (!canReadKeys) return;

    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [canReadKeys, setRawMode]);

  useEffect(() => {
    if (!canReadKeys) return;

    const onData = (chunk: string | Buffer) => {
      // One chunk can hold several keypresses, or none of a whole one
      for (const sequence of tokenizeKeySequences(chunk.toString())) {
        onSequence(sequence);
      }
    };

    inputEmitter?.on("input", onData);
    return () => {
      inputEmitter?.removeListener("input", onData);
    };
  }, [canReadKeys, inputEmitter, onSequence]);
};

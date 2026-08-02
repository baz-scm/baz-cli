import { useEffect } from "react";
import { useStdin } from "ink";

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
  const { setRawMode, internal_eventEmitter: inputEmitter } = useStdin();

  useEffect(() => {
    if (!isActive) return;

    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [isActive, setRawMode]);

  useEffect(() => {
    if (!isActive) return;

    const onData = (chunk: string | Buffer) => {
      onSequence(chunk.toString());
    };

    inputEmitter?.on("input", onData);
    return () => {
      inputEmitter?.removeListener("input", onData);
    };
  }, [isActive, inputEmitter, onSequence]);
};

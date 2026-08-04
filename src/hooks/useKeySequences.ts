import { useEffect, useRef } from "react";
import { useStdin } from "ink";
import { tokenizeKeySequences } from "../lib/input/line-editor.js";

/**
 * How long to hold an incomplete escape sequence waiting for the rest of it.
 * A terminal writes a sequence in one go, so anything still incomplete after
 * this was the Escape key itself — the same trick, and roughly the same delay,
 * that terminal emulators use to tell Escape from Alt.
 */
const INCOMPLETE_SEQUENCE_MS = 30;

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
  const pendingRef = useRef("");
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!canReadKeys) return;

    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [canReadKeys, setRawMode]);

  useEffect(() => {
    if (!canReadKeys) return;

    const clearFlushTimer = () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    };

    // One chunk can hold several keypresses, or only part of one
    const onData = (chunk: string | Buffer) => {
      clearFlushTimer();

      const { tokens, remainder } = tokenizeKeySequences(
        pendingRef.current + chunk.toString(),
      );
      pendingRef.current = remainder;
      for (const sequence of tokens) onSequence(sequence);

      if (!remainder) return;

      // Whatever is left never completed, so take it at face value
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = "";
        const flushed = tokenizeKeySequences(pending, { flush: true });
        for (const sequence of flushed.tokens) onSequence(sequence);
      }, INCOMPLETE_SEQUENCE_MS);
    };

    inputEmitter?.on("input", onData);
    return () => {
      inputEmitter?.removeListener("input", onData);
      clearFlushTimer();
      pendingRef.current = "";
    };
  }, [canReadKeys, inputEmitter, onSequence]);
};

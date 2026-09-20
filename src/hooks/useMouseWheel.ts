import { useCallback, useEffect } from "react";
import { useStdout } from "ink";
import {
  MOUSE_TRACKING_OFF,
  MOUSE_TRACKING_ON,
  parseWheelSequence,
  type WheelDirection,
} from "../lib/input/mouse.js";
import { useKeySequences } from "./useKeySequences.js";

/**
 * How many streams currently want mouse reporting. Several viewports can be
 * mounted at once, so the mode is turned off only once the last one is done -
 * otherwise unmounting one would take the wheel away from another.
 */
const subscribers = new Map<NodeJS.WriteStream, number>();

let restoreOnExitRegistered = false;

/**
 * Mouse reporting outlives the process if the terminal is never told to stop,
 * leaving the wheel dead in the shell afterwards. React cleanup covers an
 * orderly unmount; this covers the rest.
 */
const registerRestoreOnExit = (): void => {
  if (restoreOnExitRegistered) return;
  restoreOnExitRegistered = true;

  const restore = () => {
    for (const stream of subscribers.keys()) stream.write(MOUSE_TRACKING_OFF);
    subscribers.clear();
  };

  process.on("exit", restore);
};

const acquire = (stream: NodeJS.WriteStream): void => {
  const count = subscribers.get(stream) ?? 0;
  subscribers.set(stream, count + 1);
  if (count === 0) {
    registerRestoreOnExit();
    stream.write(MOUSE_TRACKING_ON);
  }
};

const release = (stream: NodeJS.WriteStream): void => {
  const count = subscribers.get(stream) ?? 0;
  if (count <= 1) {
    subscribers.delete(stream);
    stream.write(MOUSE_TRACKING_OFF);
    return;
  }
  subscribers.set(stream, count - 1);
};

/**
 * Calls `onWheel` each time the wheel is turned over the terminal.
 *
 * Mouse reporting is asked for only while `isActive`, because it costs
 * something: with it on, the terminal hands clicks and the wheel to the
 * application instead of using them for its own text selection and scrollback.
 * Callers should therefore keep it to the times the wheel has somewhere to
 * scroll to.
 */
export const useMouseWheel = (
  onWheel: (direction: WheelDirection) => void,
  options: { isActive?: boolean } = {},
): void => {
  const isActive = options.isActive ?? true;
  const { stdout } = useStdout();
  // Writing escape codes into a pipe or a file would corrupt the output, and
  // there is no mouse there to report anyway.
  const canTrackMouse = isActive && !!stdout?.isTTY;

  useEffect(() => {
    if (!canTrackMouse) return;

    acquire(stdout);
    return () => {
      release(stdout);
    };
  }, [canTrackMouse, stdout]);

  const onSequence = useCallback(
    (sequence: string) => {
      const direction = parseWheelSequence(sequence);
      if (direction) onWheel(direction);
    },
    [onWheel],
  );

  useKeySequences(onSequence, { isActive: canTrackMouse });
};

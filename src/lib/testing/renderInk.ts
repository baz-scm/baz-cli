/**
 * Renders an Ink component onto fake streams so tests can type at it and read
 * the frames back.
 *
 * Ink drives everything through the `stdin` / `stdout` it is handed, so a pair
 * of small stand-ins is all a test needs: `stdout.write` collects the frames,
 * and `stdin.write` delivers a chunk the way a terminal would — `readable`
 * followed by a `read()`, which is how Ink picks input up.
 */
import { EventEmitter } from "node:events";
import type { ReactElement } from "react";
import { render } from "ink";
import { INCOMPLETE_SEQUENCE_MS } from "../../hooks/useKeySequences.js";

class FakeStdout extends EventEmitter {
  readonly frames: string[] = [];

  get columns(): number {
    return 100;
  }

  write = (frame: string): void => {
    this.frames.push(frame);
  };

  lastFrame = (): string | undefined => this.frames.at(-1);
}

class FakeStdin extends EventEmitter {
  readonly isTTY = true;
  private data: string | null = null;

  write = (data: string): void => {
    this.data = data;
    this.emit("readable");
    this.emit("data", data);
  };

  read = (): string | null => {
    const { data } = this;
    this.data = null;
    return data;
  };

  setEncoding = (): void => {};
  setRawMode = (): void => {};
  resume = (): void => {};
  pause = (): void => {};
  ref = (): void => {};
  unref = (): void => {};
}

export interface InkTestRender {
  /** Types a chunk of input, exactly as a terminal would deliver it. */
  write: (input: string) => void;
  /** The most recently rendered frame. */
  lastFrame: () => string | undefined;
  unmount: () => void;
  /**
   * Lets React and Ink settle after an input chunk, including a key sequence
   * held back as possibly incomplete — a lone Escape waits out
   * `INCOMPLETE_SEQUENCE_MS` before it is delivered.
   */
  flush: () => Promise<void>;
}

export const renderInk = (element: ReactElement): InkTestRender => {
  const stdout = new FakeStdout();
  const stdin = new FakeStdin();

  const instance = render(element, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });

  return {
    write: (input: string) => {
      stdin.write(input);
    },
    lastFrame: stdout.lastFrame,
    unmount: () => {
      instance.unmount();
    },
    flush: () =>
      new Promise((resolve) =>
        setTimeout(resolve, INCOMPLETE_SEQUENCE_MS + 30),
      ),
  };
};

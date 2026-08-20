import React from "react";
import { PassThrough, Writable } from "node:stream";
import { Box, render, Text } from "ink";
import { describe, expect, it } from "vitest";
import ScrollableViewport from "./ScrollableViewport.js";
import { ReservedRows, ScreenLayoutProvider } from "./layout/ScreenLayout.js";

const CONTENT_LINES = 40;

const ESC = "";
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, "g");
const ARROW_UP = `${ESC}[A`;
const ARROW_DOWN = `${ESC}[B`;
const PAGE_DOWN = `${ESC}[6~`;

function createStdout(rows: number, columns = 100) {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  }) as Writable & { columns: number; rows: number; isTTY: boolean };
  stream.columns = columns;
  stream.rows = rows;
  stream.isTTY = true;

  return {
    stream,
    // Ink rewrites the whole frame on every render; the last one is what the
    // user is looking at.
    lastFrame: () => {
      const frames = output.replace(ANSI_PATTERN, "").split("BANNER");
      const last = frames[frames.length - 1];
      return `BANNER${last}`
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0);
    },
  };
}

// Ink reads input through the "readable" event, so a real duplex stream is
// the simplest fake stdin.
function createStdin() {
  const stream = new PassThrough() as PassThrough & Record<string, unknown>;
  stream.isTTY = true;
  stream.setRawMode = () => {};
  stream.ref = () => {};
  stream.unref = () => {};
  return stream;
}

const Harness: React.FC = () => (
  <ScreenLayoutProvider>
    <ReservedRows id="banner">
      <Box>
        <Text>BANNER</Text>
      </Box>
    </ReservedRows>

    <ScrollableViewport>
      {Array.from({ length: CONTENT_LINES }, (_, index) => (
        <Text key={index}>line {index}</Text>
      ))}
    </ScrollableViewport>

    <ReservedRows id="footer">
      <Box>
        <Text>FOOTER</Text>
      </Box>
    </ReservedRows>
  </ScreenLayoutProvider>
);

// Ink throttles its writes, so wait for the trailing frame.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 60));
}

async function renderHarness(rows: number) {
  const stdout = createStdout(rows);
  const stdin = createStdin();
  const instance = render(<Harness />, {
    stdout: stdout.stream as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    patchConsole: false,
  });

  await settle();

  return {
    lines: () => stdout.lastFrame(),
    frame: () => stdout.lastFrame().join("\n"),
    press: async (sequence: string) => {
      stdin.write(sequence);
      await settle();
    },
    cleanup: () => instance.unmount(),
  };
}

describe("ScrollableViewport", () => {
  it("keeps the reserved chrome on screen in a short window", async () => {
    const harness = await renderHarness(12);

    expect(harness.lines().length).toBeLessThanOrEqual(12);
    expect(harness.lines()[0]).toContain("BANNER");
    expect(harness.lines().at(-1)).toContain("FOOTER");
    // Content is clipped, not dumped in full.
    expect(harness.frame()).toContain("line 0");
    expect(harness.frame()).not.toContain(`line ${CONTENT_LINES - 1}`);

    harness.cleanup();
  });

  it("reports the visible range and scrolls with the arrow keys", async () => {
    const harness = await renderHarness(12);
    expect(harness.frame()).toContain(`of ${CONTENT_LINES}`);

    await harness.press(ARROW_DOWN);
    expect(harness.frame()).toContain("line 1");
    expect(harness.lines()).not.toContain("line 0");

    await harness.press(ARROW_UP);
    expect(harness.lines()).toContain("line 0");

    await harness.press(PAGE_DOWN);
    expect(harness.lines()).not.toContain("line 0");

    harness.cleanup();
  });

  it("stops scrolling at the end of the content", async () => {
    const harness = await renderHarness(12);

    for (let i = 0; i < 5; i++) {
      await harness.press(PAGE_DOWN);
    }

    expect(harness.frame()).toContain(`line ${CONTENT_LINES - 1}`);
    expect(harness.lines().length).toBeLessThanOrEqual(12);
    expect(harness.lines().at(-1)).toContain("FOOTER");

    harness.cleanup();
  });

  it("shows everything and no scroll hint when the window is tall", async () => {
    const harness = await renderHarness(60);

    expect(harness.frame()).toContain("line 0");
    expect(harness.frame()).toContain(`line ${CONTENT_LINES - 1}`);
    expect(harness.frame()).not.toContain("to scroll");

    harness.cleanup();
  });
});

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

interface HarnessProps {
  /** Extra rows of chrome, standing in for an open mention list. */
  footerRows?: number;
  resetKey?: string | number;
}

const Harness: React.FC<HarnessProps> = ({ footerRows = 1, resetKey }) => (
  <ScreenLayoutProvider>
    <ReservedRows id="banner">
      <Box>
        <Text>BANNER</Text>
      </Box>
    </ReservedRows>

    <ScrollableViewport resetKey={resetKey}>
      {Array.from({ length: CONTENT_LINES }, (_, index) => (
        <Text key={index}>line {index}</Text>
      ))}
    </ScrollableViewport>

    <ReservedRows id="footer">
      {Array.from({ length: footerRows }, (_, index) => (
        <Text key={index}>{index === 0 ? "FOOTER" : `footer ${index}`}</Text>
      ))}
    </ReservedRows>
  </ScreenLayoutProvider>
);

// Ink throttles its writes, so wait for the trailing frame.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 60));
}

async function renderHarness(rows: number, props: HarnessProps = {}) {
  const stdout = createStdout(rows);
  const stdin = createStdin();
  const instance = render(<Harness {...props} />, {
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
    rerender: async (next: HarnessProps) => {
      instance.rerender(<Harness {...next} />);
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

  // In a 12-row window the banner takes 1 row and SLACK_ROWS takes another, so
  // the rows left for the viewport and its status line are 10 - footerRows.
  // These are the sizes where chrome crowds the viewport out entirely, e.g. an
  // open mention list.
  it.each([
    { footerRows: 8, budget: 2 },
    { footerRows: 9, budget: 1 },
    { footerRows: 10, budget: 0 },
    { footerRows: 11, budget: -1 },
  ])(
    "never grows past the window with $footerRows footer rows (budget $budget)",
    async ({ footerRows, budget }) => {
      const harness = await renderHarness(12, { footerRows });

      // Chrome stays whole and the frame still fits the window.
      expect(harness.lines().length).toBeLessThanOrEqual(12);
      expect(harness.lines()[0]).toContain("BANNER");
      expect(harness.frame()).toContain(`footer ${footerRows - 1}`);

      if (budget > 0) {
        expect(harness.frame()).toContain("line 0");
      } else {
        // Nothing left to show: the viewport collapses instead of pushing the
        // chrome off screen.
        expect(harness.frame()).not.toContain("line 0");
      }

      harness.cleanup();
    },
  );

  it("returns to the top when the reviewed item changes", async () => {
    const harness = await renderHarness(12, { resetKey: "first" });

    await harness.press(PAGE_DOWN);
    expect(harness.lines()).not.toContain("line 0");

    await harness.rerender({ resetKey: "second" });
    expect(harness.lines()).toContain("line 0");

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

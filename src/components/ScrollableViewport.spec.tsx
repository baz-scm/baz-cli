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
const WHEEL_UP = `${ESC}[<64;10;5M`;
const WHEEL_DOWN = `${ESC}[<65;10;5M`;
const MOUSE_ON = `${ESC}[?1000h${ESC}[?1006h`;
const MOUSE_OFF = `${ESC}[?1006l${ESC}[?1000l`;

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
    // Everything written, escape codes and all - the mouse modes never show up
    // in a frame.
    raw: () => output,
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
  /** False while the composer's mention list owns the arrow keys. */
  isActive?: boolean;
}

const Harness: React.FC<HarnessProps> = ({
  footerRows = 1,
  resetKey,
  isActive,
}) => (
  <ScreenLayoutProvider>
    <ReservedRows id="banner">
      <Box>
        <Text>BANNER</Text>
      </Box>
    </ReservedRows>

    <ScrollableViewport resetKey={resetKey} isActive={isActive}>
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
    // Without this Ink detects `CI` and writes nothing until unmount, so the
    // frames below come back empty on the runner.
    debug: true,
    patchConsole: false,
  });

  await settle();

  return {
    raw: stdout.raw,
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

  it("scrolls with the mouse wheel", async () => {
    const harness = await renderHarness(12);

    await harness.press(WHEEL_DOWN);
    // A notch of the wheel moves three lines, as the terminal itself would.
    expect(harness.frame()).toContain("line 3");
    expect(harness.lines()).not.toContain("line 2");

    await harness.press(WHEEL_UP);
    expect(harness.lines()).toContain("line 0");

    harness.cleanup();
  });

  it("stops at the ends of the content when the wheel keeps turning", async () => {
    const harness = await renderHarness(12);

    for (let i = 0; i < 3; i++) await harness.press(WHEEL_UP);
    expect(harness.lines()).toContain("line 0");

    for (let i = 0; i < 40; i++) await harness.press(WHEEL_DOWN);
    expect(harness.frame()).toContain(`line ${CONTENT_LINES - 1}`);
    expect(harness.lines().length).toBeLessThanOrEqual(12);

    harness.cleanup();
  });

  it("keeps scrolling with the wheel while the mention list owns the arrows", async () => {
    const harness = await renderHarness(12, { isActive: false });

    // The mention list has the arrow keys, so they must not scroll behind it.
    await harness.press(ARROW_DOWN);
    expect(harness.lines()).toContain("line 0");

    // Nothing else wants the wheel, so it still scrolls.
    await harness.press(WHEEL_DOWN);
    expect(harness.frame()).toContain("line 3");
    expect(harness.lines()).not.toContain("line 0");

    harness.cleanup();
  });

  it("asks the terminal for the mouse, and hands it back on unmount", async () => {
    const harness = await renderHarness(12);

    expect(harness.raw()).toContain(MOUSE_ON);
    expect(harness.raw()).not.toContain(MOUSE_OFF);

    harness.cleanup();
    await settle();

    expect(harness.raw()).toContain(MOUSE_OFF);
  });

  it("leaves the mouse to the terminal when there is nothing to scroll", async () => {
    // Chrome fills the window, so the viewport collapses and the wheel has
    // nowhere to go: the terminal keeps the mouse for selecting text.
    const harness = await renderHarness(12, { footerRows: 10 });

    expect(harness.raw()).not.toContain(MOUSE_ON);

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

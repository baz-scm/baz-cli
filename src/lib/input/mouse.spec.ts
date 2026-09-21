import { describe, expect, it } from "vitest";
import {
  MOUSE_TRACKING_OFF,
  MOUSE_TRACKING_ON,
  parseWheelSequence,
} from "./mouse.js";

const ESC = "\u001B";

/** `ESC [ M` reports, with each byte offset by 32. */
const legacy = (button: number, column = 1, row = 1) =>
  `${ESC}[M${String.fromCharCode(button + 32, column + 32, row + 32)}`;

describe("parseWheelSequence", () => {
  it("reads the wheel from an SGR report", () => {
    expect(parseWheelSequence(`${ESC}[<64;10;5M`)).toBe("up");
    expect(parseWheelSequence(`${ESC}[<65;10;5M`)).toBe("down");
  });

  it("reads the wheel however far across the window it is turned", () => {
    expect(parseWheelSequence(`${ESC}[<65;240;118M`)).toBe("down");
  });

  it("ignores the modifier keys held while scrolling", () => {
    // Shift adds 4, alt 8 and ctrl 16 to the button number.
    expect(parseWheelSequence(`${ESC}[<68;10;5M`)).toBe("up");
    expect(parseWheelSequence(`${ESC}[<81;10;5M`)).toBe("down");
  });

  it("reads the wheel from a legacy report", () => {
    expect(parseWheelSequence(legacy(64))).toBe("up");
    expect(parseWheelSequence(legacy(65))).toBe("down");
  });

  it("ignores clicks, drags and the horizontal wheel", () => {
    // Buttons 0-2 are left, middle and right; 32 is a drag; 66 and 67 are the
    // horizontal wheel, which this viewport has nothing to do with.
    for (const button of [0, 1, 2, 32, 66, 67]) {
      expect(parseWheelSequence(`${ESC}[<${button};10;5M`)).toBeNull();
      expect(parseWheelSequence(legacy(button))).toBeNull();
    }
  });

  it("ignores a release, which reports the button that was let go", () => {
    expect(parseWheelSequence(`${ESC}[<0;10;5m`)).toBeNull();
    // A wheel notch is only ever a press, so a release carrying a wheel button
    // is not a second notch to scroll on.
    expect(parseWheelSequence(`${ESC}[<64;10;5m`)).toBeNull();
    expect(parseWheelSequence(`${ESC}[<65;10;5m`)).toBeNull();
  });

  it("ignores ordinary keys", () => {
    for (const sequence of [`${ESC}[A`, `${ESC}[6~`, "a", "", `${ESC}[M`]) {
      expect(parseWheelSequence(sequence)).toBeNull();
    }
  });
});

describe("mouse tracking mode", () => {
  it("turns the modes it sets back off", () => {
    expect(MOUSE_TRACKING_ON).toBe(`${ESC}[?1000h${ESC}[?1006h`);
    expect(MOUSE_TRACKING_OFF).toBe(`${ESC}[?1006l${ESC}[?1000l`);
  });
});

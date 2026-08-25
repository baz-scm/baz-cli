import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectTerminalBackground, resolveTheme } from "./theme.js";

describe("detectTerminalBackground", () => {
  it("honors an explicit override", () => {
    expect(detectTerminalBackground({ BAZ_TERMINAL_BACKGROUND: "light" })).toBe(
      "light",
    );
  });

  it("reads COLORFGBG", () => {
    expect(detectTerminalBackground({ COLORFGBG: "15;0" })).toBe("dark");
    expect(detectTerminalBackground({ COLORFGBG: "0;15" })).toBe("light");
    expect(detectTerminalBackground({ COLORFGBG: "15;default" })).toBe("dark");
  });

  it("defaults to dark", () => {
    expect(detectTerminalBackground({})).toBe("dark");
  });
});

describe("resolveTheme", () => {
  const noFile = { BAZ_THEME_FILE: "/nonexistent/baz-theme.json" };

  it("adapts to a dark terminal", () => {
    const theme = resolveTheme({ ...noFile, COLORFGBG: "15;0" });
    expect(theme.name).toBe("dark");
    // Text color is always set alongside a background.
    expect(theme.diffAdded.backgroundColor).toBeTruthy();
    expect(theme.diffAdded.color).toBeTruthy();
    expect(theme.diffSelected.color).toBeTruthy();
  });

  it("adapts to a light terminal", () => {
    const theme = resolveTheme({ ...noFile, COLORFGBG: "0;15" });
    expect(theme.name).toBe("light");
    expect(theme.main).toBe("#5656c4");
  });

  it("can be forced", () => {
    expect(resolveTheme({ ...noFile, BAZ_THEME: "light" }).name).toBe("light");
    expect(
      resolveTheme({ ...noFile, BAZ_THEME: "dark", COLORFGBG: "0;15" }).name,
    ).toBe("dark");
  });

  it("turns colors off for BAZ_THEME=none and NO_COLOR", () => {
    for (const environment of [
      { ...noFile, BAZ_THEME: "none" },
      { ...noFile, BAZ_THEME: "off" },
      { ...noFile, NO_COLOR: "1" },
      { ...noFile, TERM: "dumb" },
    ]) {
      const theme = resolveTheme(environment);
      expect(theme.name).toBe("none");
      expect(theme.colorsEnabled).toBe(false);
      expect(theme.main).toBeUndefined();
      expect(theme.diffAdded).toEqual({});
      // Commented-on lines stay distinguishable without color.
      expect(theme.diffSelected.bold).toBe(true);
    }
  });

  it("applies per-color overrides from the environment", () => {
    const theme = resolveTheme({
      ...noFile,
      BAZ_COLOR_DIFF_ADDED_BG: "#003300",
      BAZ_COLOR_MAIN: "none",
    });
    expect(theme.diffAdded.backgroundColor).toBe("#003300");
    expect(theme.main).toBeUndefined();
  });

  it("reads a theme file", () => {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "baz-theme-")),
      "theme.json",
    );
    fs.writeFileSync(
      file,
      JSON.stringify({ theme: "light", diffAddedBg: "#abcdef" }),
    );

    const theme = resolveTheme({ BAZ_THEME_FILE: file });
    expect(theme.name).toBe("light");
    expect(theme.diffAdded.backgroundColor).toBe("#abcdef");
  });

  it("ignores a broken theme file", () => {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "baz-theme-")),
      "theme.json",
    );
    fs.writeFileSync(file, "{not json");

    expect(() => resolveTheme({ BAZ_THEME_FILE: file })).not.toThrow();
  });

  it("overrides win over a forced theme, colors stay on", () => {
    const theme = resolveTheme({
      ...noFile,
      BAZ_THEME: "none",
      BAZ_COLOR_DIFF_SELECTED_BG: "#222200",
    });
    expect(theme.colorsEnabled).toBe(true);
    expect(theme.diffSelected.backgroundColor).toBe("#222200");
    // A background always comes with a foreground, even in colorless mode.
    expect(theme.diffSelected.color).toBeTruthy();
  });

  it("drops a background whose foreground was turned off", () => {
    const theme = resolveTheme({
      ...noFile,
      BAZ_COLOR_DIFF_ADDED_FG: "none",
    });
    expect(theme.diffAdded.color).toBeUndefined();
    expect(theme.diffAdded.backgroundColor).toBeUndefined();
  });

  it("ignores non-string values in a theme file", () => {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "baz-theme-")),
      "theme.json",
    );
    fs.writeFileSync(
      file,
      JSON.stringify({ theme: 42, diffAddedBg: ["#fff"], main: "#123456" }),
    );

    const theme = resolveTheme({ BAZ_THEME_FILE: file, COLORFGBG: "15;0" });
    // The bad theme name and color fall back to the detected defaults.
    expect(theme.name).toBe("dark");
    expect(theme.diffAdded.backgroundColor).toBe("#1e3b26");
    expect(theme.main).toBe("#123456");
  });
});

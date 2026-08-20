import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Terminal theming for the review UI.
 *
 * Colors adapt to the terminal background (dark / light), can be forced with
 * `BAZ_THEME`, turned off entirely (`BAZ_THEME=none`, `NO_COLOR`) and
 * overridden key-by-key through env vars or a config file. See README.
 */

export type ThemeName = "dark" | "light" | "none";

export interface TextStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
}

/** Every customizable color key. */
export interface ThemeColors {
  /** Brand color: headers, titles, spinners. */
  main?: string;
  /** Secondary/emphasis color, e.g. selected PR title. */
  accent?: string;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
  /** File header row of a diff. */
  fileHeaderBg?: string;
  fileHeaderFg?: string;
  diffAddedBg?: string;
  diffAddedFg?: string;
  diffDeletedBg?: string;
  diffDeletedFg?: string;
  /** The lines a comment points at. */
  diffSelectedBg?: string;
  diffSelectedFg?: string;
  /** Unchanged context lines and their line numbers. */
  diffContextFg?: string;
  lineNumberFg?: string;
}

export interface Theme extends ThemeColors {
  name: ThemeName;
  colorsEnabled: boolean;
  fileHeader: TextStyle;
  diffAdded: TextStyle;
  diffDeleted: TextStyle;
  diffSelected: TextStyle;
  diffContext: TextStyle;
  lineNumber: TextStyle;
}

const DARK_COLORS: ThemeColors = {
  main: "#9d9df0",
  accent: "#f2c96b",
  success: "#5fd7a0",
  warning: "#e5c07b",
  error: "#ff6b81",
  info: "#7fb4ff",
  fileHeaderBg: "#3b3b4d",
  fileHeaderFg: "#e8e8f5",
  diffAddedBg: "#1e3b26",
  diffAddedFg: "#b9f0c4",
  diffDeletedBg: "#4a1f28",
  diffDeletedFg: "#ffbecb",
  diffSelectedBg: "#4a4324",
  diffSelectedFg: "#ffe9a8",
  diffContextFg: "#c8c8d2",
  lineNumberFg: "#8a8a99",
};

const LIGHT_COLORS: ThemeColors = {
  main: "#5656c4",
  accent: "#a35a00",
  success: "#137333",
  warning: "#8a6100",
  error: "#c5221f",
  info: "#1a56b0",
  fileHeaderBg: "#d3d3d3",
  fileHeaderFg: "#1c1c22",
  diffAddedBg: "#9aff9a",
  diffAddedFg: "#0a3312",
  diffDeletedBg: "#ff82ab",
  diffDeletedFg: "#3d0013",
  diffSelectedBg: "#fff59d",
  diffSelectedFg: "#3a2f00",
  diffContextFg: "#1c1c22",
  lineNumberFg: "#5c5c66",
};

const COLOR_KEYS = Object.keys(DARK_COLORS) as (keyof ThemeColors)[];

/** `diffAddedBg` -> `BAZ_COLOR_DIFF_ADDED_BG` */
function envVarNameFor(key: keyof ThemeColors): string {
  return `BAZ_COLOR_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
}

const DISABLED_VALUES = new Set(["", "none", "off", "false", "default"]);

/** Returns the color, or `undefined` when the value means "no color". */
function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (DISABLED_VALUES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

function parseThemeName(value: string | undefined): ThemeName | "auto" | null {
  switch (value?.trim().toLowerCase()) {
    case "dark":
      return "dark";
    case "light":
      return "light";
    case "none":
    case "off":
    case "no":
    case "no-color":
    case "mono":
      return "none";
    case "auto":
      return "auto";
    default:
      return null;
  }
}

/**
 * Best-effort detection of the terminal background.
 *
 * `COLORFGBG` is set by several terminals (iTerm2, urxvt, Konsole) as
 * `fg;bg`, where a low background index means a dark background. When nothing
 * says otherwise we assume dark, which is the common default.
 */
export function detectTerminalBackground(
  environment: NodeJS.ProcessEnv = process.env,
): "dark" | "light" {
  const explicit = environment.BAZ_TERMINAL_BACKGROUND?.trim().toLowerCase();
  if (explicit === "light" || explicit === "dark") return explicit;

  const colorFgBg = environment.COLORFGBG;
  if (colorFgBg) {
    const background = colorFgBg.split(";").pop()?.trim();
    if (background === "default") return "dark";
    const index = Number(background);
    if (Number.isFinite(index)) {
      // 0-6 and 8 are dark backgrounds; 7 and 9-15 are light ones.
      return index === 7 || index > 8 ? "light" : "dark";
    }
  }

  if (environment.TERM === "linux") return "dark";

  return "dark";
}

function readOverridesFile(
  environment: NodeJS.ProcessEnv,
): Partial<ThemeColors> & { theme?: string } {
  const candidates = [
    environment.BAZ_THEME_FILE,
    path.join(process.cwd(), ".baz", "theme.json"),
    path.join(os.homedir(), ".baz", "theme.json"),
    path.join(os.homedir(), ".config", "baz", "theme.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Partial<ThemeColors> & { theme?: string };
      }
    } catch {
      // A broken theme file must never break the CLI - fall through to defaults.
    }
  }

  return {};
}

function styleOf(fg?: string, bg?: string, boldWhenPlain = false): TextStyle {
  if (!fg && !bg) return boldWhenPlain ? { bold: true } : {};
  return { color: fg, backgroundColor: bg };
}

export function resolveTheme(
  environment: NodeJS.ProcessEnv = process.env,
): Theme {
  const fileOverrides = readOverridesFile(environment);

  const requested =
    parseThemeName(environment.BAZ_THEME) ??
    parseThemeName(fileOverrides.theme) ??
    "auto";

  const noColorRequested =
    requested === "none" ||
    // https://no-color.org - any non-empty value disables color.
    Boolean(environment.NO_COLOR) ||
    environment.TERM === "dumb";

  const name: ThemeName = noColorRequested
    ? "none"
    : requested === "auto"
      ? detectTerminalBackground(environment)
      : requested;

  const base: ThemeColors =
    name === "none" ? {} : name === "light" ? LIGHT_COLORS : DARK_COLORS;

  const colors: ThemeColors = {};
  for (const key of COLOR_KEYS) {
    const fromEnv = environment[envVarNameFor(key)];
    const override =
      fromEnv !== undefined ? fromEnv : (fileOverrides[key] as unknown);
    colors[key] = override !== undefined ? normalizeColor(override) : base[key];
  }

  const colorsEnabled = COLOR_KEYS.some((key) => Boolean(colors[key]));

  return {
    ...colors,
    name,
    colorsEnabled,
    fileHeader: styleOf(colors.fileHeaderFg, colors.fileHeaderBg, true),
    diffAdded: styleOf(colors.diffAddedFg, colors.diffAddedBg),
    diffDeleted: styleOf(colors.diffDeletedFg, colors.diffDeletedBg),
    // Without colors, the commented-on lines still need to stand out.
    diffSelected: styleOf(colors.diffSelectedFg, colors.diffSelectedBg, true),
    diffContext: styleOf(colors.diffContextFg),
    lineNumber: styleOf(colors.lineNumberFg),
  };
}

let cached: Theme | null = null;

/** The active theme. Resolved once per process. */
export function getTheme(): Theme {
  cached ??= resolveTheme();
  return cached;
}

/** Test helper - drops the memoized theme. */
export function resetTheme(): void {
  cached = null;
}

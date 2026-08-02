import { describe, it, expect } from "vitest";
import {
  applyEditorAction,
  findWordBoundary,
  parseKeySequence,
  tokenizeKeySequences,
  type EditorAction,
  type EditorState,
} from "./line-editor.js";

const ESC = "\u001B";
const BACKSPACE = "\u007F";
const CTRL_A = "\u0001";
const CTRL_C = "\u0003";
const CTRL_E = "\u0005";
const CTRL_K = "\u000B";
const CTRL_U = "\u0015";
const CTRL_W = "\u0017";

const HOME = `${ESC}[H`;
const END = `${ESC}[F`;
const ALT_LEFT = `${ESC}[1;3D`;
const ALT_RIGHT = `${ESC}[1;3C`;
const CMD_LEFT = `${ESC}[1;9D`;
const CMD_RIGHT = `${ESC}[1;9C`;

const press = (state: EditorState, ...sequences: string[]): EditorState =>
  sequences.reduce((current, sequence) => {
    const action = parseKeySequence(sequence);
    return action ? applyEditorAction(current, action) : current;
  }, state);

describe("parseKeySequence", () => {
  const expectAction = (sequence: string, action: EditorAction) => {
    expect(parseKeySequence(sequence)).toEqual(action);
  };

  it("maps Home to the start of the line", () => {
    for (const sequence of [HOME, `${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`]) {
      expectAction(sequence, { type: "moveLineStart" });
    }
  });

  it("maps End to the end of the line", () => {
    for (const sequence of [END, `${ESC}OF`, `${ESC}[4~`, `${ESC}[8~`]) {
      expectAction(sequence, { type: "moveLineEnd" });
    }
  });

  it("maps Ctrl+A and Ctrl+E to the start and end of the line", () => {
    expectAction(CTRL_A, { type: "moveLineStart" });
    expectAction(CTRL_E, { type: "moveLineEnd" });
  });

  it("maps Cmd+Left and Cmd+Right to the start and end of the line", () => {
    expectAction(CMD_LEFT, { type: "moveLineStart" });
    expectAction(CMD_RIGHT, { type: "moveLineEnd" });
  });

  it("maps Alt+Arrow to word movement, in both escape encodings", () => {
    for (const sequence of [ALT_LEFT, `${ESC}${ESC}[D`, `${ESC}b`]) {
      expectAction(sequence, { type: "moveWordLeft" });
    }
    for (const sequence of [ALT_RIGHT, `${ESC}${ESC}[C`, `${ESC}f`]) {
      expectAction(sequence, { type: "moveWordRight" });
    }
  });

  it("maps Ctrl+Arrow to word movement", () => {
    expectAction(`${ESC}[1;5D`, { type: "moveWordLeft" });
    expectAction(`${ESC}[1;5C`, { type: "moveWordRight" });
  });

  it("maps plain arrows to single character movement", () => {
    expectAction(`${ESC}[D`, { type: "moveCharLeft" });
    expectAction(`${ESC}OD`, { type: "moveCharLeft" });
    expectAction(`${ESC}[C`, { type: "moveCharRight" });
    expectAction(`${ESC}[A`, { type: "up" });
    expectAction(`${ESC}[B`, { type: "down" });
  });

  it("maps the deletion shortcuts", () => {
    expectAction(BACKSPACE, { type: "deleteCharLeft" });
    expectAction(`${ESC}[3~`, { type: "deleteCharRight" });
    expectAction(`${ESC}${BACKSPACE}`, { type: "deleteWordLeft" });
    expectAction(CTRL_W, { type: "deleteWordLeft" });
    expectAction(`${ESC}d`, { type: "deleteWordRight" });
    expectAction(CTRL_U, { type: "deleteToLineStart" });
    expectAction(CTRL_K, { type: "deleteToLineEnd" });
  });

  it("maps Enter, Tab and Escape", () => {
    expectAction("\r", { type: "submit" });
    expectAction("\n", { type: "submit" });
    expectAction("\t", { type: "tab" });
    expectAction(ESC, { type: "escape" });
  });

  it("inserts printable input, including pasted text", () => {
    expectAction("a", { type: "insert", text: "a" });
    expectAction("é", { type: "insert", text: "é" });
    expectAction("hello there", { type: "insert", text: "hello there" });
  });

  it("flattens newlines in pasted text into spaces", () => {
    expectAction("first\r\nsecond\nthird", {
      type: "insert",
      text: "first second third",
    });
  });

  it("ignores unbound control keys and unknown escape sequences", () => {
    expect(parseKeySequence("")).toBeNull();
    expect(parseKeySequence(CTRL_C)).toBeNull(); // Ink exits on Ctrl+C itself
    expect(parseKeySequence(`${ESC}[15~`)).toBeNull(); // F5
    expect(parseKeySequence(`${ESC}[200~`)).toBeNull();
  });
});

describe("tokenizeKeySequences", () => {
  it("keeps a single keypress whole", () => {
    expect(tokenizeKeySequences("a")).toEqual(["a"]);
    expect(tokenizeKeySequences(HOME)).toEqual([HOME]);
    expect(tokenizeKeySequences(ALT_LEFT)).toEqual([ALT_LEFT]);
    expect(tokenizeKeySequences(`${ESC}${ESC}[D`)).toEqual([`${ESC}${ESC}[D`]);
    expect(tokenizeKeySequences(`${ESC}b`)).toEqual([`${ESC}b`]);
    expect(tokenizeKeySequences(ESC)).toEqual([ESC]);
  });

  it("splits keypresses that arrive in one chunk", () => {
    expect(tokenizeKeySequences(`a${ESC}[D`)).toEqual(["a", `${ESC}[D`]);
    expect(tokenizeKeySequences(`${ESC}[D${ESC}[C`)).toEqual([
      `${ESC}[D`,
      `${ESC}[C`,
    ]);
    expect(tokenizeKeySequences(`ab${CTRL_W}cd`)).toEqual(["ab", CTRL_W, "cd"]);
    expect(tokenizeKeySequences(`${HOME}fix ${END}`)).toEqual([
      HOME,
      "fix ",
      END,
    ]);
  });

  it("unwraps bracketed paste and keeps the payload as text", () => {
    expect(tokenizeKeySequences(`${ESC}[200~hello there${ESC}[201~`)).toEqual([
      "hello there",
    ]);
    expect(
      tokenizeKeySequences(`${ESC}[200~first\r\nsecond${ESC}[201~`),
    ).toEqual(["first second"]);
    // An unterminated paste still yields its text rather than being dropped
    expect(tokenizeKeySequences(`${ESC}[200~hello`)).toEqual(["hello"]);
  });

  it("treats a newline inside pasted text as a space, and a trailing one as Enter", () => {
    expect(tokenizeKeySequences("first\nsecond")).toEqual(["first second"]);
    expect(tokenizeKeySequences("done\r")).toEqual(["done", "\r"]);
    expect(tokenizeKeySequences("\r")).toEqual(["\r"]);
    expect(tokenizeKeySequences("\r\n")).toEqual(["\r"]);
  });

  it("never drops typed text next to an unknown escape sequence", () => {
    const tokens = tokenizeKeySequences(`ab${ESC}[15~cd`);
    expect(tokens).toEqual(["ab", `${ESC}[15~`, "cd"]);
    expect(tokens.map(parseKeySequence)).toEqual([
      { type: "insert", text: "ab" },
      null,
      { type: "insert", text: "cd" },
    ]);
  });

  it("returns nothing for an empty chunk", () => {
    expect(tokenizeKeySequences("")).toEqual([]);
  });
});

describe("findWordBoundary", () => {
  it("skips adjacent whitespace before skipping the word", () => {
    expect(findWordBoundary("one two three", 13, "left")).toBe(8);
    expect(findWordBoundary("one two  ", 9, "left")).toBe(4);
    expect(findWordBoundary("one two three", 0, "right")).toBe(3);
    expect(findWordBoundary("  one", 0, "right")).toBe(5);
  });

  it("stops at the ends of the buffer", () => {
    expect(findWordBoundary("one", 0, "left")).toBe(0);
    expect(findWordBoundary("one", 3, "right")).toBe(3);
  });

  it("clamps an out of range cursor", () => {
    expect(findWordBoundary("one two", 99, "left")).toBe(4);
    expect(findWordBoundary("one two", -5, "right")).toBe(3);
  });
});

describe("applyEditorAction", () => {
  const state = (text: string, cursor: number): EditorState => ({
    text,
    cursor,
  });

  it("inserts at the cursor", () => {
    expect(
      applyEditorAction(state("helo", 2), { type: "insert", text: "l" }),
    ).toEqual(state("hello", 3));
  });

  it("moves to the start and end of the line", () => {
    expect(
      applyEditorAction(state("hello", 3), { type: "moveLineStart" }),
    ).toEqual(state("hello", 0));
    expect(
      applyEditorAction(state("hello", 1), { type: "moveLineEnd" }),
    ).toEqual(state("hello", 5));
  });

  it("moves a word at a time", () => {
    expect(
      applyEditorAction(state("fix the parser", 14), { type: "moveWordLeft" }),
    ).toEqual(state("fix the parser", 8));
    expect(
      applyEditorAction(state("fix the parser", 0), { type: "moveWordRight" }),
    ).toEqual(state("fix the parser", 3));
  });

  it("deletes a word backwards and forwards", () => {
    expect(
      applyEditorAction(state("fix the parser", 14), {
        type: "deleteWordLeft",
      }),
    ).toEqual(state("fix the ", 8));
    expect(
      applyEditorAction(state("fix the parser", 3), {
        type: "deleteWordRight",
      }),
    ).toEqual(state("fix parser", 3));
  });

  it("deletes to the start and end of the line", () => {
    expect(
      applyEditorAction(state("fix the parser", 8), {
        type: "deleteToLineStart",
      }),
    ).toEqual(state("parser", 0));
    expect(
      applyEditorAction(state("fix the parser", 8), {
        type: "deleteToLineEnd",
      }),
    ).toEqual(state("fix the ", 8));
  });

  it("deletes single characters in both directions", () => {
    expect(
      applyEditorAction(state("hello", 5), { type: "deleteCharLeft" }),
    ).toEqual(state("hell", 4));
    expect(
      applyEditorAction(state("hello", 0), { type: "deleteCharRight" }),
    ).toEqual(state("ello", 0));
  });

  it("returns the same state for no-ops so the caller can skip a render", () => {
    const atStart = state("hello", 0);
    expect(applyEditorAction(atStart, { type: "moveCharLeft" })).toBe(atStart);
    expect(applyEditorAction(atStart, { type: "moveLineStart" })).toBe(atStart);
    expect(applyEditorAction(atStart, { type: "deleteCharLeft" })).toBe(
      atStart,
    );
    expect(applyEditorAction(atStart, { type: "deleteWordLeft" })).toBe(
      atStart,
    );

    const atEnd = state("hello", 5);
    expect(applyEditorAction(atEnd, { type: "moveCharRight" })).toBe(atEnd);
    expect(applyEditorAction(atEnd, { type: "moveLineEnd" })).toBe(atEnd);
    expect(applyEditorAction(atEnd, { type: "deleteCharRight" })).toBe(atEnd);
    expect(applyEditorAction(atEnd, { type: "deleteToLineEnd" })).toBe(atEnd);

    expect(applyEditorAction(atEnd, { type: "submit" })).toBe(atEnd);
  });
});

describe("editing a line end to end", () => {
  it("supports Home, End and word movement while typing", () => {
    let editor: EditorState = { text: "", cursor: 0 };

    editor = press(editor, "review the diff");
    expect(editor).toEqual({ text: "review the diff", cursor: 15 });

    // Home, then type at the start of the line
    editor = press(editor, HOME, "please ");
    expect(editor).toEqual({ text: "please review the diff", cursor: 7 });

    // End, one word back, then drop the rest of the line
    editor = press(editor, END, ALT_LEFT, CTRL_K);
    expect(editor).toEqual({ text: "please review the ", cursor: 18 });

    // Ctrl+A, one word forward, Ctrl+E
    editor = press(editor, CTRL_A);
    expect(editor.cursor).toBe(0);
    editor = press(editor, ALT_RIGHT);
    expect(editor.cursor).toBe(6);
    editor = press(editor, CTRL_E);
    expect(editor.cursor).toBe(18);
  });
});

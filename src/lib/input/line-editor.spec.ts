import { describe, it, expect } from "vitest";
import {
  applyEditorAction,
  charAt,
  findCharBoundary,
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
  const tokens = (chunk: string, flush = false) =>
    tokenizeKeySequences(chunk, { flush }).tokens;

  it("keeps a single keypress whole", () => {
    expect(tokens("a")).toEqual(["a"]);
    expect(tokens(HOME)).toEqual([HOME]);
    expect(tokens(ALT_LEFT)).toEqual([ALT_LEFT]);
    expect(tokens(`${ESC}${ESC}[D`)).toEqual([`${ESC}${ESC}[D`]);
    expect(tokens(`${ESC}b`)).toEqual([`${ESC}b`]);
  });

  it("splits keypresses that arrive in one chunk", () => {
    expect(tokens(`a${ESC}[D`)).toEqual(["a", `${ESC}[D`]);
    expect(tokens(`${ESC}[D${ESC}[C`)).toEqual([`${ESC}[D`, `${ESC}[C`]);
    expect(tokens(`ab${CTRL_W}cd`)).toEqual(["ab", CTRL_W, "cd"]);
    expect(tokens(`${HOME}fix ${END}`)).toEqual([HOME, "fix ", END]);
  });

  it("holds an incomplete sequence back for the next chunk", () => {
    expect(tokenizeKeySequences(`ab${ESC}[`)).toEqual({
      tokens: ["ab"],
      remainder: `${ESC}[`,
    });
    expect(tokenizeKeySequences(`${ESC}O`)).toEqual({
      tokens: [],
      remainder: `${ESC}O`,
    });
    expect(tokenizeKeySequences(`${ESC}[1;`)).toEqual({
      tokens: [],
      remainder: `${ESC}[1;`,
    });
    // ...and picks it up again once the rest arrives
    expect(tokens(`${ESC}[` + "D")).toEqual([`${ESC}[D`]);
  });

  it("holds back a lone ESC until it is known not to be a prefix", () => {
    expect(tokenizeKeySequences(ESC)).toEqual({ tokens: [], remainder: ESC });
    expect(tokenizeKeySequences(`${ESC}${ESC}`)).toEqual({
      tokens: [],
      remainder: `${ESC}${ESC}`,
    });
    // Flushing is what turns it into the Escape key
    expect(tokens(ESC, true)).toEqual([ESC]);
    expect(parseKeySequence(ESC)).toEqual({ type: "escape" });
  });

  it("drops an incomplete sequence on flush rather than typing it", () => {
    const flushed = tokens(`${ESC}[1;`, true);
    expect(flushed).toEqual([`${ESC}[1;`]);
    expect(flushed.map(parseKeySequence)).toEqual([null]);
  });

  it("unwraps bracketed paste and keeps the payload as text", () => {
    expect(tokens(`${ESC}[200~hello there${ESC}[201~`)).toEqual([
      "hello there",
    ]);
    expect(tokens(`${ESC}[200~first\r\nsecond${ESC}[201~`)).toEqual([
      "first second",
    ]);
  });

  it("waits for the end of a paste that spans chunks", () => {
    expect(tokenizeKeySequences(`${ESC}[200~hel`)).toEqual({
      tokens: [],
      remainder: `${ESC}[200~hel`,
    });
    expect(tokens(`${ESC}[200~hello${ESC}[201~`)).toEqual(["hello"]);
    // An unterminated paste still yields its text rather than being dropped
    expect(tokens(`${ESC}[200~hello`, true)).toEqual(["hello"]);
  });

  it("treats a newline inside pasted text as a space, and a trailing one as Enter", () => {
    expect(tokens("first\nsecond")).toEqual(["first second"]);
    expect(tokens("done\r")).toEqual(["done", "\r"]);
    expect(tokens("\r")).toEqual(["\r"]);
    expect(tokens("\r\n")).toEqual(["\r"]);
  });

  it("never drops typed text next to an unknown escape sequence", () => {
    const chunk = tokens(`ab${ESC}[15~cd`);
    expect(chunk).toEqual(["ab", `${ESC}[15~`, "cd"]);
    expect(chunk.map(parseKeySequence)).toEqual([
      { type: "insert", text: "ab" },
      null,
      { type: "insert", text: "cd" },
    ]);
  });

  it("returns nothing for an empty chunk", () => {
    expect(tokenizeKeySequences("")).toEqual({ tokens: [], remainder: "" });
  });
});

describe("applying every token from one chunk in order", () => {
  const feed = (state: EditorState, chunk: string): EditorState =>
    tokenizeKeySequences(chunk, { flush: true }).tokens.reduce(
      (current, sequence) => {
        const action = parseKeySequence(sequence);
        return action ? applyEditorAction(current, action) : current;
      },
      state,
    );

  it("edits with the result of the previous key, not the state before the chunk", () => {
    // `ab`, Left, `X` coalesced into one read
    expect(feed({ text: "", cursor: 0 }, `ab${ESC}[D` + "X")).toEqual({
      text: "aXb",
      cursor: 2,
    });
  });

  it("submits the text typed earlier in the same chunk", () => {
    const chunk = tokenizeKeySequences("fix\r", { flush: true }).tokens;
    expect(chunk).toEqual(["fix", "\r"]);

    let state: EditorState = { text: "", cursor: 0 };
    let submitted: string | null = null;
    for (const sequence of chunk) {
      const action = parseKeySequence(sequence);
      if (action?.type === "submit") submitted = state.text;
      else if (action) state = applyEditorAction(state, action);
    }
    expect(submitted).toBe("fix");
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

describe("grapheme boundaries", () => {
  // "a😀é👨‍👩‍👧" — 1 code unit, then 2 (emoji), 2 (e + combining acute), 8 (ZWJ family)
  const text = "a\u{1F600}e\u0301\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";

  it("steps over a whole emoji, accent or ZWJ sequence", () => {
    expect(findCharBoundary(text, 0, "right")).toBe(1);
    expect(findCharBoundary(text, 1, "right")).toBe(3);
    expect(findCharBoundary(text, 3, "right")).toBe(5);
    expect(findCharBoundary(text, 5, "right")).toBe(13);
    expect(findCharBoundary(text, 13, "left")).toBe(5);
    expect(findCharBoundary(text, 5, "left")).toBe(3);
    expect(findCharBoundary(text, 3, "left")).toBe(1);
    expect(findCharBoundary(text, 1, "left")).toBe(0);
  });

  it("returns the whole grapheme under the cursor", () => {
    expect(charAt(text, 0)).toBe("a");
    expect(charAt(text, 1)).toBe("\u{1F600}");
    expect(charAt(text, 3)).toBe("e\u0301");
    expect(charAt(text, 5)).toBe("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}");
    expect(charAt(text, text.length)).toBe("");
  });

  it("moves the cursor a glyph at a time, never onto half of one", () => {
    let state: EditorState = { text, cursor: text.length };
    for (const expected of [5, 3, 1, 0]) {
      state = applyEditorAction(state, { type: "moveCharLeft" });
      expect(state.cursor).toBe(expected);
    }
    for (const expected of [1, 3, 5, 13]) {
      state = applyEditorAction(state, { type: "moveCharRight" });
      expect(state.cursor).toBe(expected);
    }
  });

  it("deletes a whole glyph in both directions", () => {
    expect(
      applyEditorAction(
        { text: "hi\u{1F600}", cursor: 4 },
        { type: "deleteCharLeft" },
      ),
    ).toEqual({ text: "hi", cursor: 2 });

    expect(
      applyEditorAction(
        { text: "\u{1F600}hi", cursor: 0 },
        { type: "deleteCharRight" },
      ),
    ).toEqual({ text: "hi", cursor: 0 });

    // The combining accent goes with its letter
    expect(
      applyEditorAction(
        { text: "cafe\u0301", cursor: 5 },
        { type: "deleteCharLeft" },
      ),
    ).toEqual({ text: "caf", cursor: 3 });
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

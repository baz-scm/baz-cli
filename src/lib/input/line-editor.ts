/**
 * Single line editing for the terminal inputs: maps raw key sequences to
 * editing actions and applies them to a text buffer.
 *
 * Ink's `useInput` normalises keypresses into a small set of flags that cannot
 * express Home/End at all (they arrive with an empty `input` and no key flags)
 * and cannot tell Alt+Arrow apart from Cmd+Arrow, so the inputs read the raw
 * escape sequences from stdin (see `useKeySequences`) and map them here.
 */

export type EditorState = {
  text: string;
  cursor: number;
};

export type EditorActionType =
  | "insert"
  | "moveCharLeft"
  | "moveCharRight"
  | "moveWordLeft"
  | "moveWordRight"
  | "moveLineStart"
  | "moveLineEnd"
  | "deleteCharLeft"
  | "deleteCharRight"
  | "deleteWordLeft"
  | "deleteWordRight"
  | "deleteToLineStart"
  | "deleteToLineEnd"
  | "submit"
  | "escape"
  | "tab"
  | "up"
  | "down";

export type EditorAction =
  | { type: "insert"; text: string }
  | { type: Exclude<EditorActionType, "insert"> };

const ESC = "\u001B";
const BACKSPACE = "\u0008";
const DELETE = "\u007F";
const ctrl = (letter: string) =>
  String.fromCharCode(letter.toUpperCase().charCodeAt(0) - 64);

/**
 * Exact escape sequences emitted by the common terminals (Terminal.app, iTerm2,
 * Ghostty, WezTerm, Alacritty, VS Code, tmux) mapped to an editing action.
 *
 * xterm modifier suffixes: `;2` shift, `;3` alt/option, `;5` ctrl, `;9` meta
 * (Cmd on macOS).
 */
const KEY_BINDINGS: Record<string, Exclude<EditorActionType, "insert">> = {
  "\r": "submit",
  "\n": "submit",
  "\t": "tab",
  [ESC]: "escape",

  // Backwards delete: Backspace, Ctrl+H
  [DELETE]: "deleteCharLeft",
  [BACKSPACE]: "deleteCharLeft",

  // Forwards delete: Delete (Fn+Backspace on macOS), Ctrl+D
  [`${ESC}[3~`]: "deleteCharRight",
  [ctrl("d")]: "deleteCharRight",

  // Delete word backwards: Alt+Backspace, Ctrl+W
  [`${ESC}${DELETE}`]: "deleteWordLeft",
  [`${ESC}${BACKSPACE}`]: "deleteWordLeft",
  [ctrl("w")]: "deleteWordLeft",

  // Delete word forwards: Alt+D, Alt+Delete
  [`${ESC}d`]: "deleteWordRight",
  [`${ESC}D`]: "deleteWordRight",
  [`${ESC}[3;3~`]: "deleteWordRight",

  // Delete to start/end of line: Ctrl+U, Ctrl+K
  [ctrl("u")]: "deleteToLineStart",
  [ctrl("k")]: "deleteToLineEnd",

  // Arrows (normal and application cursor mode), Shift+Arrow, Ctrl+B / Ctrl+F
  [`${ESC}[D`]: "moveCharLeft",
  [`${ESC}OD`]: "moveCharLeft",
  [`${ESC}[1;2D`]: "moveCharLeft",
  [ctrl("b")]: "moveCharLeft",
  [`${ESC}[C`]: "moveCharRight",
  [`${ESC}OC`]: "moveCharRight",
  [`${ESC}[1;2C`]: "moveCharRight",
  [ctrl("f")]: "moveCharRight",
  [`${ESC}[A`]: "up",
  [`${ESC}OA`]: "up",
  [`${ESC}[B`]: "down",
  [`${ESC}OB`]: "down",

  // One word left: Alt+Left, Ctrl+Left, Alt+B
  [`${ESC}b`]: "moveWordLeft",
  [`${ESC}B`]: "moveWordLeft",
  [`${ESC}${ESC}[D`]: "moveWordLeft",
  [`${ESC}[1;3D`]: "moveWordLeft",
  [`${ESC}[1;5D`]: "moveWordLeft",
  [`${ESC}[5D`]: "moveWordLeft",
  [`${ESC}Od`]: "moveWordLeft",

  // One word right: Alt+Right, Ctrl+Right, Alt+F
  [`${ESC}f`]: "moveWordRight",
  [`${ESC}F`]: "moveWordRight",
  [`${ESC}${ESC}[C`]: "moveWordRight",
  [`${ESC}[1;3C`]: "moveWordRight",
  [`${ESC}[1;5C`]: "moveWordRight",
  [`${ESC}[5C`]: "moveWordRight",
  [`${ESC}Oc`]: "moveWordRight",

  // Start of line: Home, Cmd+Left, Ctrl+A
  [`${ESC}[H`]: "moveLineStart",
  [`${ESC}OH`]: "moveLineStart",
  [`${ESC}[1~`]: "moveLineStart",
  [`${ESC}[7~`]: "moveLineStart",
  [`${ESC}[1;9D`]: "moveLineStart",
  [ctrl("a")]: "moveLineStart",

  // End of line: End, Cmd+Right, Ctrl+E
  [`${ESC}[F`]: "moveLineEnd",
  [`${ESC}OF`]: "moveLineEnd",
  [`${ESC}[4~`]: "moveLineEnd",
  [`${ESC}[8~`]: "moveLineEnd",
  [`${ESC}[1;9C`]: "moveLineEnd",
  [ctrl("e")]: "moveLineEnd",
};

/** True when `sequence` is the given Ctrl+letter chord, e.g. Ctrl+G. */
export const isCtrlChord = (sequence: string, letter: string): boolean =>
  sequence === ctrl(letter);

const isControlCharacter = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f;
};

const toInsertableText = (sequence: string): string =>
  [...sequence.replace(/\r\n|\r|\n/g, " ")]
    .filter((character) => !isControlCharacter(character))
    .join("");

const PASTE_START = `${ESC}[200~`;
const PASTE_END = `${ESC}[201~`;

const isNewline = (character: string): boolean =>
  character === "\r" || character === "\n";

/**
 * The full escape sequence starting at `start`, e.g. `ESC [ 1 ; 3 D`, or
 * `null` when the chunk ends mid-sequence and the rest is yet to arrive.
 */
const readEscapeSequence = (chunk: string, start: number): string | null => {
  let index = start + 1;

  // Alt+Arrow arrives as a second ESC in front of the sequence
  if (chunk[index] === ESC) index++;
  if (index >= chunk.length) return null;

  if (chunk[index] === "[") {
    index++;
    while (index < chunk.length && /[0-9;:<=>?]/.test(chunk[index])) index++;
    if (index >= chunk.length) return null; // no final byte yet
    index++;
  } else if (chunk[index] === "O") {
    if (index + 1 >= chunk.length) return null;
    index += 2;
  } else {
    index++; // ESC + one character, e.g. Alt+B
  }

  return chunk.slice(start, index);
};

export interface TokenizedKeys {
  /** One string per keypress, ready for `parseKeySequence`. */
  tokens: string[];
  /** A trailing sequence that is not complete yet; prepend it to the next chunk. */
  remainder: string;
}

/**
 * Splits a stdin chunk into one string per keypress. Chunk boundaries are not
 * key boundaries: typing quickly coalesces `a` and Left into `a ESC [ D`, a
 * paste arrives in one piece (bracketed by `ESC [ 200~` when the terminal
 * supports it), and a single sequence can equally be split across two reads.
 *
 * An incomplete trailing sequence is returned as `remainder` rather than
 * guessed at, so the caller can prepend it to the next chunk. Pass
 * `flush: true` once no more input is coming — a lone `ESC` is only the Escape
 * key rather than the start of a sequence when nothing follows it.
 *
 * Newlines within pasted text become spaces — this is a single line input — but
 * a newline that ends the chunk is Enter, so typing quickly and hitting return
 * still submits.
 */
export const tokenizeKeySequences = (
  chunk: string,
  options: { flush?: boolean } = {},
): TokenizedKeys => {
  const flush = options.flush ?? false;
  const tokens: string[] = [];
  let text = "";

  const flushText = () => {
    if (text) tokens.push(text);
    text = "";
  };

  const withRemainder = (remainder: string): TokenizedKeys => {
    flushText();
    return { tokens, remainder };
  };

  let index = 0;
  while (index < chunk.length) {
    const character = chunk[index];

    if (chunk.startsWith(PASTE_START, index)) {
      const start = index + PASTE_START.length;
      const end = chunk.indexOf(PASTE_END, start);
      if (end === -1) {
        // Wait for the closing marker so the paste lands in one go
        if (!flush) return withRemainder(chunk.slice(index));
        text += toInsertableText(chunk.slice(start));
        index = chunk.length;
        continue;
      }
      text += toInsertableText(chunk.slice(start, end));
      index = end + PASTE_END.length;
      continue;
    }

    if (character === ESC) {
      const sequence = readEscapeSequence(chunk, index);
      if (sequence === null) {
        if (!flush) return withRemainder(chunk.slice(index));
        flushText();
        tokens.push(chunk.slice(index));
        index = chunk.length;
        continue;
      }
      flushText();
      tokens.push(sequence);
      index += sequence.length;
      continue;
    }

    if (isNewline(character)) {
      if ([...chunk.slice(index)].every(isNewline)) {
        flushText();
        tokens.push("\r");
        return { tokens, remainder: "" };
      }
      text += " ";
      index++;
      continue;
    }

    if (isControlCharacter(character)) {
      flushText();
      tokens.push(character);
      index++;
      continue;
    }

    text += character;
    index++;
  }

  flushText();
  return { tokens, remainder: "" };
};

/**
 * Maps a raw stdin chunk to an editing action, or `null` when the chunk should
 * be ignored: unbound control keys (Ctrl+C, which Ink handles) and escape
 * sequences this input does not understand, which must never end up as text in
 * the buffer.
 */
export const parseKeySequence = (sequence: string): EditorAction | null => {
  if (!sequence) return null;

  const binding = KEY_BINDINGS[sequence];
  if (binding) return { type: binding };

  if (sequence.includes(ESC)) return null;

  const text = toInsertableText(sequence);
  return text ? { type: "insert", text } : null;
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const graphemeBoundaries = (text: string): number[] => {
  const boundaries: number[] = [0];
  for (const { index, segment } of segmenter.segment(text)) {
    boundaries.push(index + segment.length);
  }
  return boundaries;
};

/**
 * The grapheme boundary one step left or right of the cursor. Stepping by a
 * single UTF-16 code unit would land between the halves of an emoji, or between
 * a letter and its combining accent, and render a broken glyph.
 */
export const findCharBoundary = (
  text: string,
  cursor: number,
  direction: "left" | "right",
): number => {
  const boundaries = graphemeBoundaries(text);

  if (direction === "right") {
    return boundaries.find((boundary) => boundary > cursor) ?? text.length;
  }

  return boundaries.filter((boundary) => boundary < cursor).pop() ?? 0;
};

/** Rounds an arbitrary index down to the grapheme boundary at or before it. */
export const snapToCharBoundary = (text: string, index: number): number => {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  const boundaries = graphemeBoundaries(text);
  return boundaries.filter((boundary) => boundary <= index).pop() ?? 0;
};

/**
 * The whole grapheme starting at `index`, for rendering the cursor cell — a
 * single code unit there could be half of an emoji.
 */
export const charAt = (text: string, index: number): string => {
  if (index >= text.length) return "";
  return text.slice(index, findCharBoundary(text, index, "right"));
};

/**
 * Whitespace-delimited word boundary, matching readline's Alt+B / Alt+F: skip
 * the whitespace next to the cursor, then skip over the word itself.
 */
export const findWordBoundary = (
  text: string,
  cursor: number,
  direction: "left" | "right",
): number => {
  let pos = Math.max(0, Math.min(cursor, text.length));

  if (direction === "right") {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    while (pos < text.length && !/\s/.test(text[pos])) pos++;
    return pos;
  }

  while (pos > 0 && /\s/.test(text[pos - 1])) pos--;
  while (pos > 0 && !/\s/.test(text[pos - 1])) pos--;
  return pos;
};

const deleteRange = (
  state: EditorState,
  start: number,
  end: number,
): EditorState =>
  start === end
    ? state
    : {
        text: state.text.slice(0, start) + state.text.slice(end),
        cursor: start,
      };

/**
 * Applies an editing action to the buffer. Returns the state object unchanged
 * when the action is a no-op (moving left at the start of the line) or is not
 * an editing action at all, so callers can skip re-rendering.
 */
export const applyEditorAction = (
  state: EditorState,
  action: EditorAction,
): EditorState => {
  const { text, cursor } = state;

  switch (action.type) {
    case "insert":
      if (!action.text) return state;
      return {
        text: text.slice(0, cursor) + action.text + text.slice(cursor),
        cursor: cursor + action.text.length,
      };

    case "moveCharLeft":
      return cursor > 0
        ? { text, cursor: findCharBoundary(text, cursor, "left") }
        : state;

    case "moveCharRight":
      return cursor < text.length
        ? { text, cursor: findCharBoundary(text, cursor, "right") }
        : state;

    case "moveWordLeft": {
      const target = findWordBoundary(text, cursor, "left");
      return target === cursor ? state : { text, cursor: target };
    }

    case "moveWordRight": {
      const target = findWordBoundary(text, cursor, "right");
      return target === cursor ? state : { text, cursor: target };
    }

    case "moveLineStart":
      return cursor > 0 ? { text, cursor: 0 } : state;

    case "moveLineEnd":
      return cursor < text.length ? { text, cursor: text.length } : state;

    case "deleteCharLeft":
      return deleteRange(state, findCharBoundary(text, cursor, "left"), cursor);

    case "deleteCharRight":
      return cursor < text.length
        ? {
            text:
              text.slice(0, cursor) +
              text.slice(findCharBoundary(text, cursor, "right")),
            cursor,
          }
        : state;

    case "deleteWordLeft":
      return deleteRange(state, findWordBoundary(text, cursor, "left"), cursor);

    case "deleteWordRight": {
      const end = findWordBoundary(text, cursor, "right");
      return end === cursor
        ? state
        : { text: text.slice(0, cursor) + text.slice(end), cursor };
    }

    case "deleteToLineStart":
      return deleteRange(state, 0, cursor);

    case "deleteToLineEnd":
      return cursor < text.length
        ? { text: text.slice(0, cursor), cursor }
        : state;

    default:
      return state;
  }
};

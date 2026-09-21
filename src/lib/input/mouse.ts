/**
 * Terminal mouse reporting: turning it on, and reading wheel events back.
 *
 * A terminal only sends mouse events to an application that asks for them.
 * Until it does, the wheel scrolls the terminal's own scrollback and the
 * application never hears about it — which is why the scroll keys worked and
 * the wheel did not.
 */

const ESC = "\u001B";

/**
 * Ask for button events (`?1000`) reported with SGR coordinates (`?1006`).
 *
 * `?1000` is the narrowest mode that includes the wheel; there is no
 * wheel-only mode. SGR is what every modern terminal understands and, unlike
 * the original encoding, it is unambiguous past column 223.
 */
export const MOUSE_TRACKING_ON = `${ESC}[?1000h${ESC}[?1006h`;

/** Hand the mouse back to the terminal, in the reverse order. */
export const MOUSE_TRACKING_OFF = `${ESC}[?1006l${ESC}[?1000l`;

export type WheelDirection = "up" | "down";

/** Bits the modifier keys add to the button number: shift, alt, ctrl. */
const MODIFIER_BITS = 4 | 8 | 16;
const WHEEL_UP = 64;
const WHEEL_DOWN = 65;

/** `ESC [ < button ; column ; row M` (press) or `m` (release). */
const SGR_MOUSE = new RegExp(`^${ESC}\\[<(\\d+);\\d+;\\d+([Mm])$`);

/** `ESC [ M` followed by button, column and row, each offset by 32. */
const LEGACY_MOUSE_PREFIX = `${ESC}[M`;
const LEGACY_MOUSE_LENGTH = LEGACY_MOUSE_PREFIX.length + 3;

const toWheelDirection = (button: number): WheelDirection | null => {
  switch (button & ~MODIFIER_BITS) {
    case WHEEL_UP:
      return "up";
    case WHEEL_DOWN:
      return "down";
    // Anything else is a click, a drag, or the horizontal wheel.
    default:
      return null;
  }
};

/**
 * The wheel direction reported by `sequence`, or `null` when it is not a wheel
 * event — a click, a drag, or an ordinary key.
 */
export const parseWheelSequence = (sequence: string): WheelDirection | null => {
  const sgr = SGR_MOUSE.exec(sequence);
  // A wheel notch is only ever a press. `m` ends a release, and a release
  // carrying a wheel button is not a second notch to scroll on.
  if (sgr) return sgr[2] === "M" ? toWheelDirection(Number(sgr[1])) : null;

  if (
    sequence.startsWith(LEGACY_MOUSE_PREFIX) &&
    sequence.length === LEGACY_MOUSE_LENGTH
  ) {
    const button = (sequence.codePointAt(LEGACY_MOUSE_PREFIX.length) ?? 0) - 32;
    return toWheelDirection(button);
  }

  return null;
};

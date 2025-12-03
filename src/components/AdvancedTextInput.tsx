import React, { useState, useEffect } from "react";
import { Text, useInput } from "ink";

interface AdvancedTextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isActive?: boolean;
}

const AdvancedTextInput: React.FC<AdvancedTextInputProps> = ({
  value,
  placeholder = "",
  onChange,
  onSubmit,
  isActive = true,
}) => {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  useEffect(() => {
    setCursorPosition((prev) => Math.min(prev, value.length));
  }, [value]);

  const findWordBoundaryLeft = (text: string, pos: number): number => {
    if (pos === 0) return 0;

    let newPos = pos - 1;
    while (newPos > 0 && text[newPos] === " ") {
      newPos--;
    }
    while (newPos > 0 && text[newPos] !== " ") {
      newPos--;
    }
    return newPos === 0 && text[0] !== " " ? 0 : newPos + 1;
  };

  const findWordBoundaryRight = (text: string, pos: number): number => {
    if (pos >= text.length) return text.length;

    let newPos = pos;
    while (newPos < text.length && text[newPos] === " ") {
      newPos++;
    }
    while (newPos < text.length && text[newPos] !== " ") {
      newPos++;
    }
    return newPos;
  };

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit();
        return;
      }

      if (key.backspace && (key.ctrl || key.meta)) {
        const wordStart = findWordBoundaryLeft(value, cursorPosition);
        const newValue =
          value.slice(0, wordStart) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(wordStart);
        return;
      }

      if (key.delete && (key.ctrl || key.meta)) {
        const wordEnd = findWordBoundaryRight(value, cursorPosition);
        const newValue = value.slice(0, cursorPosition) + value.slice(wordEnd);
        onChange(newValue);
        return;
      }

      if (key.backspace) {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
        return;
      }

      if (key.delete) {
        if (cursorPosition < value.length) {
          const newValue =
            value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
          onChange(newValue);
        }
        return;
      }

      if (key.leftArrow) {
        if (key.ctrl || key.meta) {
          const newPos = findWordBoundaryLeft(value, cursorPosition);
          setCursorPosition(newPos);
        } else {
          setCursorPosition(Math.max(0, cursorPosition - 1));
        }
        return;
      }

      if (key.rightArrow) {
        if (key.ctrl || key.meta) {
          const newPos = findWordBoundaryRight(value, cursorPosition);
          setCursorPosition(newPos);
        } else {
          setCursorPosition(Math.min(value.length, cursorPosition + 1));
        }
        return;
      }

      if (
        input === "\x1b[H" ||
        input === "\x1b[1~" ||
        input === "\x1bOH" ||
        (input === "a" && key.ctrl)
      ) {
        setCursorPosition(0);
        return;
      }

      if (
        input === "\x1b[F" ||
        input === "\x1b[4~" ||
        input === "\x1bOF" ||
        (input === "e" && key.ctrl)
      ) {
        setCursorPosition(value.length);
        return;
      }

      if (input === "k" && key.ctrl) {
        const newValue = value.slice(0, cursorPosition);
        onChange(newValue);
        return;
      }

      if (input === "u" && key.ctrl) {
        const newValue = value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(0);
        return;
      }

      if (input === "w" && key.ctrl) {
        const wordStart = findWordBoundaryLeft(value, cursorPosition);
        const newValue =
          value.slice(0, wordStart) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(wordStart);
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        const isPrintable =
          !input.includes("\x1b") &&
          [...input].every((c) => {
            const code = c.charCodeAt(0);
            return code >= 0x20 && code !== 0x7f;
          });

        if (isPrintable) {
          const newValue =
            value.slice(0, cursorPosition) +
            input +
            value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition + input.length);
        }
      }
    },
    { isActive },
  );

  const isPlaceholder = !value && placeholder;

  const beforeCursor = value.slice(0, cursorPosition);
  const atCursor = value[cursorPosition] || " ";
  const afterCursor = value.slice(cursorPosition + 1);

  return (
    <Text>
      {isPlaceholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        <>
          <Text>{beforeCursor}</Text>
          <Text inverse>{atCursor}</Text>
          <Text>{afterCursor}</Text>
        </>
      )}
    </Text>
  );
};

export default AdvancedTextInput;

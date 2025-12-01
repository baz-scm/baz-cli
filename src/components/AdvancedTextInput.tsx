import React, { useState, useEffect } from "react";
import { Text, useInput } from "ink";

interface AdvancedTextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const AdvancedTextInput: React.FC<AdvancedTextInputProps> = ({
  value,
  placeholder = "",
  onChange,
  onSubmit,
}) => {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  useEffect(() => {
    setCursorPosition(value.length);
  }, [value]);

  const findWordBoundaryLeft = (text: string, pos: number): number => {
    if (pos === 0) return 0;

    let newPos = pos - 1;
    // Skip spaces
    while (newPos > 0 && text[newPos] === " ") {
      newPos--;
    }
    // Skip word characters
    while (newPos > 0 && text[newPos] !== " ") {
      newPos--;
    }
    return newPos === 0 && text[0] !== " " ? 0 : newPos + 1;
  };

  const findWordBoundaryRight = (text: string, pos: number): number => {
    if (pos >= text.length) return text.length;

    let newPos = pos;
    // Skip spaces
    while (newPos < text.length && text[newPos] === " ") {
      newPos++;
    }
    // Skip word characters
    while (newPos < text.length && text[newPos] !== " ") {
      newPos++;
    }
    return newPos;
  };

  useInput((input, key) => {
    // Handle Enter
    if (key.return) {
      onSubmit();
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition - 1);
      }
      return;
    }

    // Ctrl+Backspace or Alt+Backspace (delete word left) - works on both Mac and Windows
    if (key.backspace && (key.ctrl || key.meta)) {
      const wordStart = findWordBoundaryLeft(value, cursorPosition);
      const newValue = value.slice(0, wordStart) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(wordStart);
      return;
    }

    // Ctrl+Delete or Alt+Delete (delete word right)
    if (key.delete && (key.ctrl || key.meta)) {
      const wordEnd = findWordBoundaryRight(value, cursorPosition);
      const newValue = value.slice(0, cursorPosition) + value.slice(wordEnd);
      onChange(newValue);
      return;
    }

    // Left arrow
    if (key.leftArrow) {
      // Ctrl/Cmd+Left: jump to previous word (Mac: Option+Left)
      if (key.ctrl || key.meta) {
        const newPos = findWordBoundaryLeft(value, cursorPosition);
        setCursorPosition(newPos);
      } else {
        // Regular left arrow
        setCursorPosition(Math.max(0, cursorPosition - 1));
      }
      return;
    }

    // Right arrow
    if (key.rightArrow) {
      // Ctrl/Cmd+Right: jump to next word (Mac: Option+Right)
      if (key.ctrl || key.meta) {
        const newPos = findWordBoundaryRight(value, cursorPosition);
        setCursorPosition(newPos);
      } else {
        // Regular right arrow
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      }
      return;
    }

    // Home key detection (escape sequence or Ctrl+A)
    // Home key sends different sequences: \x1b[H, \x1b[1~, or \x1bOH
    if ((input === "\x1b[H" || input === "\x1b[1~" || input === "\x1bOH") || (input === "a" && key.ctrl)) {
      setCursorPosition(0);
      return;
    }

    // End key detection (escape sequence or Ctrl+E)
    // End key sends different sequences: \x1b[F, \x1b[4~, or \x1bOF
    if ((input === "\x1b[F" || input === "\x1b[4~" || input === "\x1bOF") || (input === "e" && key.ctrl)) {
      setCursorPosition(value.length);
      return;
    }

    // Ctrl+K (delete from cursor to end of line - Unix standard)
    if (input === "k" && key.ctrl) {
      const newValue = value.slice(0, cursorPosition);
      onChange(newValue);
      return;
    }

    // Ctrl+U (delete from cursor to start of line - Unix standard)
    if (input === "u" && key.ctrl) {
      const newValue = value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(0);
      return;
    }

    // Ctrl+W (delete word before cursor - Unix standard)
    if (input === "w" && key.ctrl) {
      const wordStart = findWordBoundaryLeft(value, cursorPosition);
      const newValue = value.slice(0, wordStart) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(wordStart);
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + input.length);
    }
  });

  const isPlaceholder = !value && placeholder;

  // Render text with cursor
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

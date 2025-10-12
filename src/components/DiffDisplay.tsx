import React from "react";
import { Box, Text } from "ink";
import { FileDiff } from "../lib/clients/baz";
import { FileSelectionLines } from "../models/Diff";

const MAX_ADDED_VIEW_LINES = 3;
const ADDED_LINE_COLOR = "#9AFF9A";
const ADDED_LINE_PREFIX = "+";
const DELETED_LINE_COLOR = "#FF82AB";
const DELETED_LINE_PREFIX = "-";
const SELECTED_LINE_COLOR = "#FFF59D";

interface DiffDisplayProps {
  fileDiffs: FileDiff[];
  fileLines: FileSelectionLines;
  outdated: boolean;
}

const DiffDisplay: React.FC<DiffDisplayProps> = ({
  fileDiffs,
  fileLines,
  outdated,
}) => {
  return (
    <Box flexDirection="column">
      {fileDiffs.map((file) => {
        const selectionLines = fileLines.get(file.diff.file_relative_path);

        if (!selectionLines || selectionLines.end === undefined) {
          return (
            <Text color="red">
              No range info for {file.diff.file_relative_path}
            </Text>
          );
        }

        const selectionStart = selectionLines.start ?? selectionLines.end;
        const selectionEnd = selectionLines.end;
        const selectionSide = selectionLines.side ?? "right";
        const viewStart =
          (selectionStart ?? selectionEnd) - MAX_ADDED_VIEW_LINES;
        const viewEnd = selectionEnd + MAX_ADDED_VIEW_LINES;

        return (
          <Box
            key={file.diff.file_relative_path}
            flexDirection="column"
            marginBottom={1}
          >
            {/* File header */}
            <Box
              key={`${file.diff.file_relative_path}-header`}
              paddingX={1}
              backgroundColor="#D3D3D3"
            >
              <Text>{file.diff.file_relative_path}</Text>
              <Text bold color="red">
                {outdated ? " outdated" : ""}
              </Text>
            </Box>

            {/* Diff block */}
            {file.diff.chunks.map((chunk, idx) => (
              <Box
                key={`${file.diff.file_relative_path}-${idx}`}
                flexDirection="column"
              >
                {chunk.before_lines
                  .filter((line) => {
                    const lineNumber = line.new_line_number ?? 0;
                    return lineNumber >= viewStart && lineNumber <= viewEnd;
                  })
                  .map((line) => {
                    const rightLeftLine =
                      line.content ?? line.new_content ?? "";

                    return (
                      <DiffRow
                        key={`${file.diff.file_relative_path}-${idx}-${line.number ?? line.new_line_number}`}
                        leftNumber={line.number}
                        leftLine={rightLeftLine}
                        rightNumber={line.new_line_number}
                        rightLine={rightLeftLine}
                      />
                    );
                  })}
                {chunk.lines
                  .filter((line) => {
                    const lineNumber =
                      (selectionSide === "left"
                        ? line.number
                        : line.new_line_number) ?? 0;
                    return lineNumber >= viewStart && lineNumber <= viewEnd;
                  })
                  .map((line) => {
                    let leftPrefix = "";
                    let rightPrefix = "";
                    let leftColor: string | undefined;
                    let rightColor: string | undefined;

                    if (line.line_type === "Added") {
                      rightPrefix = ADDED_LINE_PREFIX;
                      rightColor = ADDED_LINE_COLOR;
                    } else if (line.line_type === "Deleted") {
                      leftPrefix = DELETED_LINE_PREFIX;
                      leftColor = DELETED_LINE_COLOR;
                    } else if (line.line_type === "Changed") {
                      // in this case we have old and new content
                      if (line.content != null) {
                        leftPrefix = DELETED_LINE_PREFIX;
                        leftColor = DELETED_LINE_COLOR;
                      }
                      if (line.new_content != null) {
                        rightPrefix = ADDED_LINE_PREFIX;
                        rightColor = ADDED_LINE_COLOR;
                      }
                    }

                    if (selectionSide === "left") {
                      const num = line.number ?? 0;
                      if (num >= selectionStart && num <= selectionEnd) {
                        leftColor = SELECTED_LINE_COLOR;
                      }
                    } else {
                      const newNum = line.new_line_number ?? 0;
                      if (newNum >= selectionStart && newNum <= selectionEnd) {
                        rightColor = SELECTED_LINE_COLOR;
                      }
                    }

                    return (
                      <DiffRow
                        key={`${file.diff.file_relative_path}-${idx}-${line.number ?? line.new_line_number}`}
                        leftNumber={line.number}
                        leftPrefix={leftPrefix}
                        leftLine={line.content ?? ""}
                        leftColor={leftColor}
                        rightNumber={line.new_line_number}
                        rightPrefix={rightPrefix}
                        rightLine={line.new_content ?? ""}
                        rightColor={rightColor}
                      />
                    );
                  })}
                {chunk.after_lines
                  .filter((line) => {
                    const lineNumber = line.new_line_number ?? 0;
                    return lineNumber >= viewStart && lineNumber <= viewEnd;
                  })
                  .map((line) => {
                    const rightLeftLine =
                      line.content ?? line.new_content ?? "";

                    return (
                      <DiffRow
                        key={`${file.diff.file_relative_path}-${idx}-${line.number ?? line.new_line_number}`}
                        leftNumber={line.number}
                        leftLine={rightLeftLine}
                        rightNumber={line.new_line_number}
                        rightLine={rightLeftLine}
                      />
                    );
                  })}
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
};

interface DiffRowProps {
  leftNumber?: number;
  leftPrefix?: string;
  leftLine: string;
  leftColor?: string;
  rightNumber?: number;
  rightPrefix?: string;
  rightLine: string;
  rightColor?: string;
}

const DiffRow: React.FC<DiffRowProps> = ({
  leftNumber,
  leftPrefix,
  leftLine,
  leftColor,
  rightNumber,
  rightPrefix,
  rightLine,
  rightColor,
}) => {
  const leftNum = (leftNumber ?? "").toString().padStart(5);
  const rightNum = (rightNumber ?? "").toString().padStart(5);

  return (
    <Box>
      <Box width="50%" backgroundColor={leftColor}>
        {/* a simple space works better than margin/padding */}
        <Text>
          {leftNum}
          {leftPrefix ? ` ${leftPrefix} ` : "   "}
        </Text>
        {/* the `Box` is needed, otherwise the automatic line wrap cuts off a character */}
        <Box>
          <Text>{leftLine}</Text>
        </Box>
      </Box>
      <Box width="50%" backgroundColor={rightColor}>
        <Text>
          {rightNum}
          {rightPrefix ? ` ${rightPrefix} ` : "   "}
        </Text>
        <Box>
          <Text>{rightLine}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default DiffDisplay;

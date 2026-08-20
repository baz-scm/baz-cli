import React, { memo } from "react";
import { Box, Text } from "ink";
import type { FileDiff } from "../lib/providers/index.js";
import { FileSelectionLines } from "../models/Diff.js";
import { getTheme, type TextStyle } from "../theme/theme.js";

const theme = getTheme();

const MAX_ADDED_VIEW_LINES = 3;
const ADDED_LINE_PREFIX = "+";
const DELETED_LINE_PREFIX = "-";

// Memoized diff row component
interface DiffRowProps {
  leftNumber?: number;
  leftPrefix?: string;
  leftLine: string;
  leftStyle?: TextStyle;
  rightNumber?: number;
  rightPrefix?: string;
  rightLine: string;
  rightStyle?: TextStyle;
}

/**
 * One side of a diff row.
 *
 * The background and the foreground are always set together - a background
 * without a matching text color is what made these rows unreadable on dark
 * terminals, since the terminal's own foreground stayed light.
 */
const DiffSide: React.FC<{
  number?: number;
  prefix?: string;
  line: string;
  style: TextStyle;
}> = ({ number, prefix, line, style }) => (
  <Box width="50%" backgroundColor={style.backgroundColor}>
    <Text
      color={style.color ?? theme.lineNumber.color}
      backgroundColor={style.backgroundColor}
      bold={style.bold}
      dimColor={!style.color && !style.backgroundColor}
    >
      {(number ?? "").toString().padStart(5)}
      {prefix ? ` ${prefix} ` : "   "}
    </Text>
    <Box>
      <Text
        color={style.color}
        backgroundColor={style.backgroundColor}
        bold={style.bold}
      >
        {line}
      </Text>
    </Box>
  </Box>
);

const DiffRow = memo<DiffRowProps>(
  ({
    leftNumber,
    leftPrefix,
    leftLine,
    leftStyle,
    rightNumber,
    rightPrefix,
    rightLine,
    rightStyle,
  }) => (
    <Box>
      <DiffSide
        number={leftNumber}
        prefix={leftPrefix}
        line={leftLine}
        style={leftStyle ?? theme.diffContext}
      />
      <DiffSide
        number={rightNumber}
        prefix={rightPrefix}
        line={rightLine}
        style={rightStyle ?? theme.diffContext}
      />
    </Box>
  ),
);

// Memoized file header
interface FileHeaderProps {
  filePath: string;
  outdated: boolean;
}

const FileHeader = memo<FileHeaderProps>(({ filePath, outdated }) => (
  <Box paddingX={1} backgroundColor={theme.fileHeader.backgroundColor}>
    <Text
      color={theme.fileHeader.color}
      backgroundColor={theme.fileHeader.backgroundColor}
      bold={theme.fileHeader.bold}
    >{`☰ ${filePath}`}</Text>
    {outdated && (
      <Text
        bold
        color={theme.error}
        backgroundColor={theme.fileHeader.backgroundColor}
      >
        {" "}
        outdated
      </Text>
    )}
  </Box>
));

interface DiffDisplayProps {
  fileDiffs: FileDiff[];
  fileLines: FileSelectionLines;
  outdated: boolean;
}

const DiffDisplayInternal: React.FC<DiffDisplayProps> = ({
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
            <Text color={theme.error}>
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
            <FileHeader
              filePath={file.diff.file_relative_path}
              outdated={outdated}
            />

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
                    let leftStyle: TextStyle | undefined;
                    let rightStyle: TextStyle | undefined;

                    if (line.line_type === "Added") {
                      rightPrefix = ADDED_LINE_PREFIX;
                      rightStyle = theme.diffAdded;
                    } else if (line.line_type === "Deleted") {
                      leftPrefix = DELETED_LINE_PREFIX;
                      leftStyle = theme.diffDeleted;
                    } else if (line.line_type === "Changed") {
                      // in this case we have old and new content
                      if (line.content != null) {
                        leftPrefix = DELETED_LINE_PREFIX;
                        leftStyle = theme.diffDeleted;
                      }
                      if (line.new_content != null) {
                        rightPrefix = ADDED_LINE_PREFIX;
                        rightStyle = theme.diffAdded;
                      }
                    }

                    if (selectionSide === "left") {
                      const num = line.number ?? 0;
                      if (num >= selectionStart && num <= selectionEnd) {
                        leftStyle = theme.diffSelected;
                      }
                    } else {
                      const newNum = line.new_line_number ?? 0;
                      if (newNum >= selectionStart && newNum <= selectionEnd) {
                        rightStyle = theme.diffSelected;
                      }
                    }

                    return (
                      <DiffRow
                        key={`${file.diff.file_relative_path}-${idx}-${line.number ?? line.new_line_number}`}
                        leftNumber={line.number}
                        leftPrefix={leftPrefix}
                        leftLine={line.content ?? ""}
                        leftStyle={leftStyle}
                        rightNumber={line.new_line_number}
                        rightPrefix={rightPrefix}
                        rightLine={line.new_content ?? ""}
                        rightStyle={rightStyle}
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

const DiffDisplay = memo(DiffDisplayInternal);

export default DiffDisplay;

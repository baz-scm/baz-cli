import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useFileDiffs } from "../hooks/useFileDiffs.js";
import DiffDisplay from "./DiffDisplay.js";
import { FileSelectionLines } from "../models/Diff.js";
import type { PRContext } from "../lib/providers/index.js";

interface DiffDisplayContainerProps {
  prContext: PRContext;
  commit: string;
  fileSelectionLines: FileSelectionLines;
  outdated: boolean;
}

const DiffDisplayContainer: React.FC<DiffDisplayContainerProps> = ({
  prContext,
  commit,
  fileSelectionLines,
  outdated,
}) => {
  const files = [...fileSelectionLines.keys()];
  const { data, loading, error } = useFileDiffs(prContext, commit, files);

  if (loading) {
    return (
      <Box>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>
        <Text color="blue"> Fetching diff...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          ❌ Error: {error}
        </Text>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">✨ No diff related to issue!</Text>
      </Box>
    );
  }

  return (
    <DiffDisplay
      fileDiffs={data}
      fileLines={fileSelectionLines}
      outdated={outdated}
    />
  );
};

export default DiffDisplayContainer;

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import {
  hasStagedChanges,
  getUnstagedFiles,
  getStagedDiff,
  getAllDiff,
} from "../../lib/git.js";

type DiffChoice = "staged" | "all";

interface SelectItem {
  label: string;
  value: DiffChoice;
}

interface LocalDiffPromptProps {
  onReady: (diffText: string) => void;
  onError: (message: string) => void;
}

const LocalDiffPrompt: React.FC<LocalDiffPromptProps> = ({
  onReady,
  onError,
}) => {
  const [unstagedFiles, setUnstagedFiles] = useState<string[]>([]);
  const [hasStaged, setHasStaged] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const staged = hasStagedChanges();
      const unstaged = getUnstagedFiles();

      if (!staged && unstaged.length === 0) {
        onError(
          "No changes detected. Stage some changes with `git add` and try again.",
        );
        return;
      }

      setHasStaged(staged);
      setUnstagedFiles(unstaged);

      // Auto-proceed if no unstaged files
      if (unstaged.length === 0) {
        onReady(getStagedDiff());
        return;
      }

      // If no staged changes but there are unstaged, auto-select all
      if (!staged) {
        onReady(getAllDiff());
        return;
      }

      setReady(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to read git state");
    }
  }, []);

  if (!ready) {
    return null;
  }

  const items: SelectItem[] = [
    { label: "Review only staged changes", value: "staged" },
    { label: "Review all changes (staged + unstaged)", value: "all" },
  ];

  const handleSelect = (item: SelectItem) => {
    if (item.value === "staged") {
      onReady(getStagedDiff());
    } else {
      onReady(getAllDiff());
    }
  };

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow" bold>
          The following files have unstaged changes:
        </Text>
        {unstagedFiles.map((file) => (
          <Text key={file} color="yellow">
            {"  "}- {file}
          </Text>
        ))}
      </Box>

      {hasStaged && (
        <>
          <Box marginBottom={1}>
            <Text>How would you like to proceed?</Text>
          </Box>

          <SelectInput
            items={items}
            onSelect={handleSelect}
            indicatorComponent={({ isSelected }) => (
              <Text color={isSelected ? "green" : "gray"}>
                {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}
              </Text>
            )}
            itemComponent={({ isSelected, label }) => (
              <Text color={isSelected ? "cyan" : "white"}>{label}</Text>
            )}
          />

          <Box marginTop={1}>
            <Text dimColor italic>
              Use ↑↓ arrows and Enter to select
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default LocalDiffPrompt;

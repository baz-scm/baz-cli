import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import {
  getDiff,
  getBranchDiff,
  isOnNonDefaultBranch,
} from "../../lib/git.js";

export interface DiffResult {
  diffText: string;
  currentBranch: string | null;
  defaultBranch: string | null;
  hasUncommittedChanges: boolean;
}

interface SelectItem {
  label: string;
  value: "yes" | "no";
}

interface LocalDiffPromptProps {
  onReady: (result: DiffResult) => void;
  onError: (message: string) => void;
}

const LocalDiffPrompt: React.FC<LocalDiffPromptProps> = ({
  onReady,
  onError,
}) => {
  const [branchInfo, setBranchInfo] = useState<{
    currentBranch: string;
    defaultBranch: string;
    hasUncommittedChanges: boolean;
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const info = isOnNonDefaultBranch();
      const hasUncommitted = !!getDiff();

      if (!info.onFeatureBranch || !info.defaultBranch) {
        if (!hasUncommitted) {
          onError(
            "No changes detected. Stage some changes with `git add` and try again.",
          );
          return;
        }
        onReady({
          diffText: getDiff(),
          currentBranch: null,
          defaultBranch: null,
          hasUncommittedChanges: false,
        });
        return;
      }

      setBranchInfo({
        currentBranch: info.currentBranch,
        defaultBranch: info.defaultBranch,
        hasUncommittedChanges: hasUncommitted,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to read git state");
    }
  }, []);

  // Delay rendering SelectInput by one tick to avoid Enter key leak from previous screen
  useEffect(() => {
    if (branchInfo) {
      const timer = setTimeout(() => setReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [branchInfo]);

  if (!branchInfo || !ready) {
    return null;
  }

  const items: SelectItem[] = [
    { label: "Yes", value: "yes" },
    { label: "No, back to PR list", value: "no" },
  ];

  const handleSelect = (item: SelectItem) => {
    if (item.value === "no") {
      onError("Review cancelled.");
      return;
    }

    try {
      const diff = getBranchDiff(branchInfo.defaultBranch);
      if (!diff) {
        onError(
          `No changes found between ${branchInfo.currentBranch} and ${branchInfo.defaultBranch}.`,
        );
        return;
      }
      onReady({
        diffText: diff,
        currentBranch: branchInfo.currentBranch,
        defaultBranch: branchInfo.defaultBranch,
        hasUncommittedChanges: branchInfo.hasUncommittedChanges,
      });
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to compute branch diff",
      );
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          You're on branch <Text bold color="cyan">{branchInfo.currentBranch}</Text>.
          Review changes vs <Text bold color="cyan">{branchInfo.defaultBranch}</Text>?
        </Text>
      </Box>

      {branchInfo.hasUncommittedChanges && (
        <Box marginBottom={1}>
          <Text color="yellow">⚠ You have uncommitted changes (not included in branch diff)</Text>
        </Box>
      )}

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
    </Box>
  );
};

export default LocalDiffPrompt;

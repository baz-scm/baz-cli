import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import type { PullRequest, PRContext } from "../../lib/providers/index.js";
import { useAppMode } from "../../lib/config/AppModeContext.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { MAIN_COLOR } from "../../theme/colors.js";

interface MergeConfirmationPromptProps {
  pr: PullRequest;
  updateData: (updater: (prev: PullRequest[]) => PullRequest[]) => void;
  onComplete: () => void;
  onCancel: () => void;
}

type MergeState = "confirming" | "merging" | "error";

interface MergeConfirmItem {
  label: string;
  value: "yes" | "goBack";
}

const MergeConfirmationPrompt: React.FC<MergeConfirmationPromptProps> = ({
  pr,
  updateData,
  onComplete,
  onCancel,
}) => {
  const [state, setState] = useState<MergeState>("confirming");
  const [error, setError] = useState<string>("");
  const appMode = useAppMode();

  const handleConfirm = async (item: MergeConfirmItem) => {
    if (item.value === "goBack") {
      onCancel();
      return;
    }

    setState("merging");

    try {
      const prContext: PRContext = {
        prId: pr.id,
        fullRepoName: pr.repositoryName,
        prNumber: pr.prNumber,
      };

      const mergeStatus =
        await appMode.mode.dataProvider.fetchMergeStatus(prContext);

      await appMode.mode.dataProvider.mergePR(
        prContext,
        mergeStatus.merge_strategy,
      );

      updateData((prevPRs) => prevPRs.filter((p) => p.id !== pr.id));

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  useInput((_input, key) => {
    if (state === "error" && key.escape) {
      onCancel();
    }
  });

  if (state === "confirming") {
    const items: MergeConfirmItem[] = [
      { label: "Yes", value: "yes" },
      { label: "Go back", value: "goBack" },
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            Merge {pr.title}?
          </Text>
        </Box>
        <SelectInput
          items={items}
          onSelect={handleConfirm}
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
      </Box>
    );
  }

  if (state === "merging") {
    return (
      <Box>
        <Text color={MAIN_COLOR}>
          <Spinner type="dots" />
        </Text>
        <Text color={MAIN_COLOR}> Merging PR...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>
          ✗ Failed to merge PR: {error}
        </Text>
      </Box>
      <Box>
        <Text dimColor italic>
          Press ESC to return to selector
        </Text>
      </Box>
    </Box>
  );
};

export default MergeConfirmationPrompt;

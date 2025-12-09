import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { triggerSpecReview } from "../../lib/clients/baz.js";
import { MAIN_COLOR } from "../../theme/colors.js";
import ErrorPrompt from "./SpecReviewErrorPrompt.js";

interface TriggerSpecReviewPromptProps {
  prId: string;
  bazRepoId?: string;
  onComplete: () => void;
  onBack: () => void;
}

type State =
  | { step: "prompt" }
  | { step: "triggering" }
  | { step: "triggered" }
  | { step: "error" };

interface SelectItem {
  label: string;
  value: "trigger" | "skip";
}

const TriggerSpecReviewPrompt: React.FC<TriggerSpecReviewPromptProps> = ({
  prId,
  bazRepoId,
  onComplete,
  onBack,
}) => {
  const [state, setState] = useState<State>({ step: "prompt" });
  const [error, setError] = useState<unknown>(null);

  useInput((_input, key) => {
    if (key.escape && state.step === "prompt") {
      onBack();
    }
  });

  const items: SelectItem[] = [
    { label: "Trigger spec review", value: "trigger" },
    { label: "Skip and continue", value: "skip" },
  ];

  const handleTrigger = async () => {
    if (!bazRepoId) {
      setError(new Error("Repository ID not available"));
      setState({ step: "error" });
      return;
    }
    setState({ step: "triggering" });
    setError(null);
    try {
      await triggerSpecReview(prId, bazRepoId);
      setState({ step: "triggered" });
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setError(err);
      setState({ step: "error" });
    }
  };

  const handleSelect = async (item: SelectItem) => {
    if (item.value === "skip") {
      onComplete();
      return;
    }

    await handleTrigger();
  };

  if (state.step === "triggering") {
    return (
      <Box>
        <Text color={MAIN_COLOR}>
          <Spinner type="dots" />
        </Text>
        <Text color={MAIN_COLOR}> Triggering spec review...</Text>
      </Box>
    );
  }

  if (state.step === "triggered") {
    return (
      <Box marginBottom={1}>
        <Text color="green">✓ Spec review triggered successfully</Text>
      </Box>
    );
  }

  if (state.step === "error" && error) {
    return (
      <ErrorPrompt
        error={error}
        context="Failed to trigger spec review"
        onContinue={onComplete}
        onRetry={handleTrigger}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="yellow">No spec reviews found for this PR</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="cyan">
          Would you like to trigger a spec review?
        </Text>
      </Box>

      <SelectInput
        items={items}
        onSelect={handleSelect}
        indicatorComponent={({ isSelected }) => (
          <Text color={isSelected ? "green" : "gray"}>
            {isSelected ? "❯" : " "}
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
};

export default TriggerSpecReviewPrompt;

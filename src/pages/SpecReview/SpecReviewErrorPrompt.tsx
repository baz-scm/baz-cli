import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { AxiosError } from "axios";

interface ErrorPromptProps {
  error: unknown;
  context?: string;
  onContinue: () => void;
  onRetry?: () => void;
}

interface SelectItem {
  label: string;
  value: "retry" | "continue";
}

const ErrorPrompt: React.FC<ErrorPromptProps> = ({
  error,
  context,
  onContinue,
  onRetry,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  const items: SelectItem[] = [];

  if (onRetry) {
    items.push({ label: "Retry", value: "retry" });
  }

  items.push({ label: "Continue", value: "continue" });

  const handleSelect = (item: SelectItem) => {
    setIsSelected(true);
    if (item.value === "retry" && onRetry) {
      onRetry();
    } else {
      onContinue();
    }
  };

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof AxiosError) {
      const errMsg = err.response?.data?.error;
      if (errMsg) {
        if (errMsg.includes("Jira") || errMsg.includes("Linear")) {
          return "Jira or Linear integration not found. To integrate, please follow the relevant links:\n For Jira - https://baz.co/settings/integrations/jira\nFor Linear - https://baz.co/settings/integrations/linear.";
        }
      }
      return errMsg || "An unexpected error occurred. please try again later.";
    }

    return "An unexpected error occurred. Please try again later.";
  };

  if (isSelected) {
    return null;
  }

  const errorMessage = getErrorMessage(error);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>
          ✗ Error{context ? `: ${context}` : ""}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="red">{errorMessage}</Text>
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

export default ErrorPrompt;

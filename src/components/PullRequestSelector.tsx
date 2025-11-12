import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { PullRequest } from "../lib/clients/baz.js";

interface PullRequestSelectorProps {
  pullRequests: PullRequest[];
  onSelect: (pr: PullRequest) => void;
  onBack: () => void;
  initialPrId?: string;
}

interface SelectItem {
  label: string;
  value: PullRequest;
}

const PullRequestSelector: React.FC<PullRequestSelectorProps> = ({
  pullRequests,
  onSelect,
  onBack,
  initialPrId,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  const items: SelectItem[] = pullRequests.map((pr) => ({
    key: `pr-${pr.id}`,
    label: `#${pr.prNumber} ${pr.title}`,
    value: pr,
  }));

  const initialIndex = initialPrId
    ? pullRequests.findIndex((pr) => pr.id === initialPrId)
    : 0;

  useInput((_input, key) => {
    if (key.escape && !isSelected) {
      onBack();
    }
  });

  const handleSelect = (item: SelectItem) => {
    setIsSelected(true);
    onSelect(item.value);
  };

  if (isSelected) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📋 Select a PR (Use ↑↓ arrows and Enter):
        </Text>
      </Box>
      <SelectInput
        items={items}
        onSelect={handleSelect}
        initialIndex={initialIndex >= 0 ? initialIndex : 0}
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
          ESC to go back • Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestSelector;

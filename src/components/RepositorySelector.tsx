import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { Repository } from "../lib/clients/baz.js";

interface RepoSelectorProps {
  repositories: Repository[];
  onSelect: (repo: Repository) => void;
  onCancel?: () => void;
}

interface SelectItem {
  label: string;
  value: Repository;
}

const RepositorySelector: React.FC<RepoSelectorProps> = ({
  repositories,
  onSelect,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  const items: SelectItem[] = repositories.map((repo) => ({
    key: `repo-${repo.id}`,
    label: `${repo.fullName} (${repo.description})`,
    value: repo,
  }));

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
          📋 Select a Repository (Use ↑↓ arrows and Enter):
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
          Press Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default RepositorySelector;

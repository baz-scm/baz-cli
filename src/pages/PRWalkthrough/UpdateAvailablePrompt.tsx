import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { getTheme } from "../../theme/theme.js";
import {
  SelectIndicator,
  SelectItem,
} from "../../components/SelectRenderers.js";

const theme = getTheme();

type UserChoice = "continue" | "startNew";

interface UpdateAvailablePromptProps {
  onSelect: (choice: UserChoice) => void;
}

interface SelectItem {
  label: string;
  value: UserChoice;
}

const UpdateAvailablePrompt: React.FC<UpdateAvailablePromptProps> = ({
  onSelect,
}) => {
  const items: SelectItem[] = [
    { label: "Continue existing walkthrough session", value: "continue" },
    { label: "Start a new walkthrough with updated data", value: "startNew" },
  ];

  const handleSelect = (item: SelectItem) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={theme.main}>
          The pull request has been updated since your last review. How would
          you like to proceed?
        </Text>
      </Box>
      <SelectInput
        items={items}
        onSelect={handleSelect}
        indicatorComponent={SelectIndicator}
        itemComponent={SelectItem}
      />
      <Box marginTop={1}>
        <Text dimColor italic>
          Use ↑↓ arrows and Enter to select
        </Text>
      </Box>
    </Box>
  );
};

export default UpdateAvailablePrompt;

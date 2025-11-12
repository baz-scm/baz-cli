import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

interface IntegrationPromptProps {
  onSelect: (shouldIntegrate: boolean) => void;
}

interface SelectItem {
  label: string;
  value: boolean;
}

const IntegrationPrompt: React.FC<IntegrationPromptProps> = ({ onSelect }) => {
  const [isSelected, setIsSelected] = useState(false);

  const items: SelectItem[] = [
    { label: "Set up integration", value: true },
    { label: "Skip for now", value: false },
  ];

  const handleSelect = (item: SelectItem) => {
    setIsSelected(true);
    onSelect(item.value);
  };

  if (isSelected) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            ⚠️ Integration Required
          </Text>
        </Box>
        <Text>
          {" "}
          Spec Reviewer requires an integration with a ticketing system.
        </Text>
        <Text> Read more: - https://docs.baz.co</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Would you like to set it up now?
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

export default IntegrationPrompt;

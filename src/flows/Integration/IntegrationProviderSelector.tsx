import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { IntegrationProvider } from "../../integrations/types.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { getTheme } from "../../theme/theme.js";

const theme = getTheme();

interface IntegrationProviderSelectorProps {
  providers: IntegrationProvider[];
  onSelect: (provider: IntegrationProvider) => void;
  onSkip: (skipped: boolean) => void;
}

interface SelectItem {
  key?: string;
  label: string;
  value: IntegrationProvider;
}

const IntegrationProviderSelector: React.FC<
  IntegrationProviderSelectorProps
> = ({ providers, onSelect, onSkip }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [notImplementedMessage, setNotImplementedMessage] = useState<
    string | null
  >(null);

  const items: SelectItem[] = providers.map((provider) => ({
    key: `provider-${provider.type}`,
    label: provider.isImplemented
      ? provider.name
      : `${provider.name} (Coming Soon)`,
    value: provider,
  }));

  const handleSelect = (item: SelectItem) => {
    if (!item.value.isImplemented) {
      setNotImplementedMessage(
        `${item.value.name} integration is coming soon! Please check back later.`,
      );
      onSkip(true);
      return;
    }
    setIsSelected(true);
    onSelect(item.value);
  };

  if (isSelected) {
    return null;
  }

  if (notImplementedMessage) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.warning}>ℹ️ {notImplementedMessage}</Text>
        </Box>
        <Box>
          <Text dimColor italic>
            Press Ctrl+C to exit
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={theme.main}>
          🔧 Select an integration provider:
        </Text>
      </Box>
      <SelectInput
        items={items}
        onSelect={handleSelect}
        indicatorComponent={({ isSelected }) => (
          <Text
            color={isSelected ? theme.success : undefined}
            dimColor={!isSelected}
          >
            {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}
          </Text>
        )}
        itemComponent={({ isSelected, label }) => (
          <Text color={isSelected ? theme.main : theme.text}>{label}</Text>
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

export default IntegrationProviderSelector;

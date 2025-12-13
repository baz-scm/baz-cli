import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { MAIN_COLOR } from "../../theme/colors.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";

export type ReviewStatusAction =
  | "viewMetRequirements"
  | "viewComments"
  | "finish";

interface ReviewStatusPromptProps {
  unmetRequirementsCount: number;
  metRequirementsCount: number;
  unresolvedCommentsCount: number;
  hasViewedUnmetRequirements: boolean;
  onSelect: (action: ReviewStatusAction) => void;
  onBack: () => void;
}

interface SelectItem {
  label: string;
  value: ReviewStatusAction;
}

const ReviewStatusPrompt: React.FC<ReviewStatusPromptProps> = ({
  unmetRequirementsCount,
  metRequirementsCount,
  unresolvedCommentsCount,
  hasViewedUnmetRequirements,
  onSelect,
  onBack,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  useInput((_input, key) => {
    if (key.escape && !isSelected) {
      onBack();
    }
  });

  const items: SelectItem[] = [];

  if (metRequirementsCount > 0) {
    items.push({
      label: "View met requirements",
      value: "viewMetRequirements",
    });
  }

  if (unresolvedCommentsCount > 0) {
    items.push({
      label: "Go to unresolved comments",
      value: "viewComments",
    });
  }

  items.push({
    label: "Finish review",
    value: "finish",
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
        <Text color={MAIN_COLOR} bold>
          Review Status
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {unmetRequirementsCount > 0 && (
          <Text>
            {hasViewedUnmetRequirements ? (
              <Text strikethrough dimColor>
                {unmetRequirementsCount} unmet requirement
                {unmetRequirementsCount > 1 ? "s" : ""}
              </Text>
            ) : (
              <>
                {unmetRequirementsCount} unmet requirement
                {unmetRequirementsCount > 1 ? "s" : ""}
              </>
            )}
          </Text>
        )}
        {metRequirementsCount > 0 && (
          <Text>
            {metRequirementsCount} met requirement
            {metRequirementsCount > 1 ? "s" : ""}
          </Text>
        )}
        {unresolvedCommentsCount > 0 && (
          <Text>
            {unresolvedCommentsCount} unresolved comment
            {unresolvedCommentsCount > 1 ? "s" : ""}
          </Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text bold color="cyan">
          What would you like to do next?
        </Text>
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
    </Box>
  );
};

export default ReviewStatusPrompt;

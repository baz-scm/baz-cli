import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { MAIN_COLOR } from "../theme/colors.js";

export type ReviewMenuAction =
  | "viewUnmetRequirements"
  | "viewMetRequirements"
  | "viewComments"
  | "narratePR"
  | "finish";

export interface CompletedSteps {
  unmetRequirements: boolean;
  metRequirements: boolean;
  comments: boolean;
  narratePR: boolean;
}

interface ReviewMenuProps {
  unmetRequirementsCount: number;
  metRequirementsCount: number;
  unresolvedCommentsCount: number;
  completedSteps: CompletedSteps;
  onSelect: (action: ReviewMenuAction) => void;
  onBack: () => void;
}

interface SelectItem {
  label: string;
  value: ReviewMenuAction;
  completed: boolean;
}

const ReviewMenu: React.FC<ReviewMenuProps> = ({
  unmetRequirementsCount,
  metRequirementsCount,
  unresolvedCommentsCount,
  completedSteps,
  onSelect,
  onBack,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  useInput((_input, key) => {
    if (key.escape && !isSelected) {
      onBack();
    }
  });

  // Build status lines with numbering
  const statusLines: Array<{
    count: number;
    label: string;
    completed: boolean;
  }> = [];

  if (unmetRequirementsCount > 0) {
    statusLines.push({
      count: unmetRequirementsCount,
      label: `unmet requirement${unmetRequirementsCount > 1 ? "s" : ""}`,
      completed: completedSteps.unmetRequirements,
    });
  }

  if (metRequirementsCount > 0) {
    statusLines.push({
      count: metRequirementsCount,
      label: `met requirement${metRequirementsCount > 1 ? "s" : ""}`,
      completed: completedSteps.metRequirements,
    });
  }

  if (unresolvedCommentsCount > 0) {
    statusLines.push({
      count: unresolvedCommentsCount,
      label: `unresolved comment${unresolvedCommentsCount > 1 ? "s" : ""}`,
      completed: completedSteps.comments,
    });
  }

  // Build menu items - only show options with data, plus always show Narrate PR
  const items: SelectItem[] = [];

  if (unmetRequirementsCount > 0) {
    items.push({
      label: "Unmet requirement",
      value: "viewUnmetRequirements",
      completed: completedSteps.unmetRequirements,
    });
  }

  if (metRequirementsCount > 0) {
    items.push({
      label: "Met requirement",
      value: "viewMetRequirements",
      completed: completedSteps.metRequirements,
    });
  }

  if (unresolvedCommentsCount > 0) {
    items.push({
      label: "Unresolved comments",
      value: "viewComments",
      completed: completedSteps.comments,
    });
  }

  items.push({
    label: "Narrate PR",
    value: "narratePR",
    completed: completedSteps.narratePR,
  });

  items.push({
    label: "Finish review",
    value: "finish",
    completed: false,
  });

  const handleSelect = (item: { label: string; value: ReviewMenuAction }) => {
    setIsSelected(true);
    onSelect(item.value);
  };

  if (isSelected) {
    return null;
  }

  // Create a lookup map for completion status by label
  const completionByLabel = new Map<string, boolean>(
    items.map((item) => [item.label, item.completed]),
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          Review status
        </Text>
      </Box>

      {statusLines.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {statusLines.map((line, index) => (
            <Text key={index}>
              {line.completed ? (
                <Text strikethrough dimColor>
                  {index + 1}. {line.count} {line.label}
                </Text>
              ) : (
                <Text>
                  {index + 1}. {line.count} {line.label}
                </Text>
              )}
            </Text>
          ))}
        </Box>
      )}

      <Box marginBottom={1}>
        <Text bold>Let&apos;s review</Text>
      </Box>

      <SelectInput
        items={items}
        onSelect={handleSelect}
        indicatorComponent={({ isSelected: isHighlighted }) => (
          <Text color={isHighlighted ? "green" : "gray"}>
            {isHighlighted ? "→" : " "}
          </Text>
        )}
        itemComponent={({ isSelected: isHighlighted, label }) => {
          const completed = completionByLabel.get(label) ?? false;
          if (completed) {
            return (
              <Text
                strikethrough
                dimColor={!isHighlighted}
                color={isHighlighted ? "cyan" : undefined}
              >
                {label}
              </Text>
            );
          }
          return <Text color={isHighlighted ? "cyan" : "white"}>{label}</Text>;
        }}
      />

      <Box marginTop={1}>
        <Text dimColor>
          ↕ to navigate{"    "}↵ to choose{"    "}↺ skip
        </Text>
      </Box>
    </Box>
  );
};

export default ReviewMenu;

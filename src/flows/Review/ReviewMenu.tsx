import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { MAIN_COLOR } from "../../theme/colors.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import TextInput from "ink-text-input";

const CHAT_ITEM_LABEL = "Chat with PR";

export type ReviewMenuAction =
  | "viewUnmetRequirements"
  | "viewMetRequirements"
  | "viewComments"
  | "prWalkthrough"
  | "prChat"
  | "finish";

export interface CompletedSteps {
  unmetRequirements: boolean;
  metRequirements: boolean;
  comments: boolean;
  prWalkthrough: boolean;
}

interface ReviewMenuProps {
  unmetRequirementsCount: number;
  metRequirementsCount: number;
  unresolvedCommentsCount: number;
  completedSteps: CompletedSteps;
  onSelect: (action: ReviewMenuAction, input?: string) => void;
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
  const [chatMode, setChatMode] = useState(false);
  const [chatInput, setChatInput] = useState("");

  useInput((_input, key) => {
    // ignore input in chat mode
    if (chatMode) {
      if (key.escape) {
        setChatMode(false);
        setChatInput("");
      }
      return;
    }

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
  const items: SelectItem[] = [
    {
      label: "PR Walkthrough",
      value: "prWalkthrough",
      completed: completedSteps.prWalkthrough,
    },
  ];

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

  items.push(
    {
      label: CHAT_ITEM_LABEL,
      value: "prChat",
      completed: false,
    },
    {
      label: "Finish review",
      value: "finish",
      completed: false,
    },
  );

  const handleSelect = (item: { label: string; value: ReviewMenuAction }) => {
    if (item.value === "prChat") {
      // handled by `handleChatSubmit()`
      return;
    }
    setIsSelected(true);
    onSelect(item.value);
  };

  const handleHighlight = (item: {
    label: string;
    value: ReviewMenuAction;
  }) => {
    if (item.value === "prChat") {
      setChatMode(true);
    } else if (chatMode) {
      setChatMode(false);
      setChatInput("");
    }
  };

  const handleChatSubmit = (value: string) => {
    const inputValue = value.trim();
    if (inputValue) {
      setIsSelected(true);
      onSelect("prChat", inputValue);
    }
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
        isFocused={!(chatMode && chatInput)} // override the built-in input handler
        onSelect={handleSelect}
        onHighlight={handleHighlight}
        indicatorComponent={({ isSelected: isHighlighted }) => (
          <Text color={isHighlighted ? "green" : "gray"}>
            {isHighlighted ? ITEM_SELECTOR : ITEM_SELECTION_GAP}
          </Text>
        )}
        itemComponent={({ isSelected: isHighlighted, label }) => {
          const completed = completionByLabel.get(label) ?? false;

          // inline chat box
          if (label === CHAT_ITEM_LABEL && chatMode) {
            return (
              <Box>
                <TextInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSubmit={handleChatSubmit}
                  placeholder={CHAT_ITEM_LABEL}
                  focus={true}
                />
              </Box>
            );
          }

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
          ↕ to navigate{"    "}↵ to {chatMode ? "submit" : "choose"}
          {"    "}
          {chatMode ? "↺ exit chat" : "↺ skip"}
        </Text>
      </Box>
    </Box>
  );
};

export default ReviewMenu;

import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export type PostReviewAction =
  | "reviewSameRepo"
  | "reviewDifferentRepo"
  | "exit";

interface PostReviewPromptProps {
  onSelect: (action: PostReviewAction) => void;
}

interface SelectItem {
  label: string;
  value: PostReviewAction;
}

const PostReviewPrompt: React.FC<PostReviewPromptProps> = ({ onSelect }) => {
  const [isSelected, setIsSelected] = useState(false);

  const items: SelectItem[] = [
    { label: "Review another PR in this repository", value: "reviewSameRepo" },
    {
      label: "Review a PR in a different repository",
      value: "reviewDifferentRepo",
    },
    { label: "Exit", value: "exit" },
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

export default PostReviewPrompt;

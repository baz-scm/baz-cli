import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { ChangeReviewer } from "../lib/clients/baz.js";
import { MentionableUser } from "../models/chat.js";

interface MentionAutocompleteProps {
  reviewers: ChangeReviewer[];
  searchQuery: string;
  onSelect: (reviewer: MentionableUser) => void;
  onCancel: () => void;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  reviewers,
  searchQuery,
  onSelect,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredReviewers: MentionableUser[] = reviewers
    .filter((reviewer): reviewer is ChangeReviewer & { login: string } => {
      return (
        reviewer.login !== undefined &&
        reviewer.login !== null &&
        reviewer.reviewer_type !== "group"
      );
    })
    .filter((reviewer) => {
      const query = searchQuery.toLowerCase();
      return (
        reviewer.name.toLowerCase().includes(query) ||
        reviewer.login.toLowerCase().includes(query)
      );
    });

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) =>
          Math.min(filteredReviewers.length - 1, prev + 1),
        );
      } else if (key.return) {
        if (filteredReviewers.length > 0) {
          onSelect(filteredReviewers[selectedIndex]);
        }
      } else if (key.escape) {
        onCancel();
      }
    },
    { isActive: true },
  );

  if (filteredReviewers.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        marginTop={1}
      >
        <Text color="yellow">No reviewers match your search.</Text>
        <Text dimColor italic>
          ESC to cancel
        </Text>
      </Box>
    );
  }

  const maxVisible = 10;
  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - 5, filteredReviewers.length - maxVisible),
  );
  const endIndex = Math.min(startIndex + maxVisible, filteredReviewers.length);
  const visibleReviewers = filteredReviewers.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginTop={1}>
        {startIndex > 0 && (
          <Text dimColor italic>
            ... {startIndex} more above
          </Text>
        )}
        {visibleReviewers.map((reviewer, index) => {
          const actualIndex = startIndex + index;
          return (
            <Box key={reviewer.id}>
              <Text color={actualIndex === selectedIndex ? "cyan" : "white"}>
                {actualIndex === selectedIndex ? "❯ " : "  "}
                {reviewer.name}
                {reviewer.login && (
                  <Text color="gray"> (@{reviewer.login})</Text>
                )}
              </Text>
            </Box>
          );
        })}
        {endIndex < filteredReviewers.length && (
          <Text dimColor italic>
            ... {filteredReviewers.length - endIndex} more below
          </Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor italic>
          ↑↓ to navigate • Enter to select • ESC to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default MentionAutocomplete;

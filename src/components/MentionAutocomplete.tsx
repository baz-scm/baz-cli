import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ChangeReviewer } from "../lib/providers/index.js";
import { MentionableUser } from "../models/chat.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../theme/symbols.js";
import { getTheme } from "../theme/theme.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";

const theme = getTheme();

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
  const { rows } = useTerminalSize();

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
        borderColor={theme.warning}
        paddingX={1}
        marginTop={1}
      >
        <Text color={theme.warning}>No reviewers match your search.</Text>
        <Text dimColor italic>
          ESC to cancel
        </Text>
      </Box>
    );
  }

  // The list shares the window with the input box and its hints, so it only
  // grows to what the terminal can spare.
  const maxVisible = Math.max(1, Math.min(10, rows - 8));
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
              <Text
                color={actualIndex === selectedIndex ? theme.main : undefined}
              >
                {actualIndex === selectedIndex
                  ? ITEM_SELECTOR
                  : ITEM_SELECTION_GAP}
                {reviewer.name}
                {reviewer.login && <Text dimColor> (@{reviewer.login})</Text>}
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

import React, { useEffect, useState, useRef } from "react";
import { Box, Text, useInput } from "ink";
import type { PullRequest } from "../../lib/providers/index.js";

interface PullRequestSelectorProps {
  pullRequests: PullRequest[];
  onSelect: (pr: PullRequest) => void;
  initialPrId?: string;
}

const PullRequestSelector: React.FC<PullRequestSelectorProps> = ({
  pullRequests,
  onSelect,
  initialPrId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const isFirstRender = useRef(true);

  const initialIndex = initialPrId
    ? pullRequests.findIndex((pr) => pr.id === initialPrId)
    : 0;

  const [selectedIndex, setSelectedIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0,
  );

  const filteredPRs = pullRequests.filter((pr) => {
    const query = searchQuery.toLowerCase();
    return (
      pr.title.toLowerCase().includes(query) ||
      pr.prNumber.toString().includes(query) ||
      pr.repositoryName.toLowerCase().includes(query) ||
      pr.authorName?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSelectedIndex(0);
  }, [searchQuery]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filteredPRs.length - 1, prev + 1));
    } else if (key.return) {
      handleSubmit();
    } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
      // Regular character typed
      setSearchQuery((prev) => prev + input);
    } else if (key.backspace || key.delete) {
      setSearchQuery((prev) => prev.slice(0, -1));
    }
  });

  const handleSubmit = () => {
    if (filteredPRs.length > 0) {
      onSelect(filteredPRs[selectedIndex]);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Search for a Pull Request:
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <Text>{searchQuery || <Text dimColor>Type to search...</Text>}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {filteredPRs.length === 0 ? (
          <Text color="yellow">No pull requests match your search.</Text>
        ) : (
          <>
            <Text dimColor>
              Found {filteredPRs.length}{" "}
              {filteredPRs.length === 1 ? "pull request" : "pull requests"}:
            </Text>
            <Box flexDirection="column" marginTop={1}>
              {(() => {
                const maxVisible = 10;
                const startIndex = Math.max(
                  0,
                  Math.min(selectedIndex - 5, filteredPRs.length - maxVisible),
                );
                const endIndex = Math.min(
                  startIndex + maxVisible,
                  filteredPRs.length,
                );
                const visiblePRs = filteredPRs.slice(startIndex, endIndex);

                return (
                  <>
                    {startIndex > 0 && (
                      <Text dimColor italic>
                        ... {startIndex} more above
                      </Text>
                    )}
                  {visiblePRs.map((pr, index) => {
                    const actualIndex = startIndex + index;
                    const approvalColor =
                      pr.approvalStatus === "Approved"
                        ? "green"
                        : pr.approvalStatus === "Changes requested"
                          ? "red"
                          : "yellow";
                    return (
                      <Box key={pr.id} flexDirection="column">
                        <Text
                          color={
                            actualIndex === selectedIndex ? "cyan" : "white"
                          }
                        >
                          {actualIndex === selectedIndex ? "❯ " : "  "}#
                          {pr.prNumber} {pr.title}
                          <Text color="gray"> [{pr.repositoryName}]</Text>
                        </Text>
                        <Text dimColor>
                          {pr.authorName ? `Author: ${pr.authorName}` : "Author unknown"}
                          {"  •  "}
                          <Text color={approvalColor}>
                            {pr.approvalStatus ?? "Review status unknown"}
                          </Text>
                        </Text>
                      </Box>
                    );
                  })}
                    {endIndex < filteredPRs.length && (
                      <Text dimColor italic>
                        ... {filteredPRs.length - endIndex} more below
                      </Text>
                    )}
                  </>
                );
              })()}
            </Box>
          </>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Type to search • ↑↓ to navigate • Enter to select • Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestSelector;

import React, { useEffect, useState, useRef } from "react";
import { Box, Text, useInput } from "ink";
import type { PullRequest } from "../../lib/providers/index.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { MAIN_COLOR } from "../../theme/colors.js";
import { updatedTimeAgo } from "../../lib/date.js";

interface PullRequestSearchKeywords {
  author?: string;
  authorNot?: string;
  repo?: string;
  repoNot?: string;
  freetext: string;
}

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

  const sanitizedPRs = [...pullRequests]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((pr) => ({
      ...pr,
      authorName:
        pr.authorName.lastIndexOf("/") > 0
          ? pr.authorName.substring(pr.authorName.lastIndexOf("/") + 1)
          : pr.authorName,
      updatedAt: updatedTimeAgo(pr.updatedAt),
    }));

  const searchKeywords = extractSearchKeywords(searchQuery.toLowerCase());
  const filteredPRs = sanitizedPRs.filter((pr) => {
    const authorName = pr.authorName.toLowerCase();
    const repositoryName = pr.repositoryName.toLowerCase();

    const keywordFilter =
      (searchKeywords.author
        ? authorName.includes(searchKeywords.author)
        : true) &&
      (searchKeywords.authorNot
        ? !authorName.includes(searchKeywords.authorNot)
        : true) &&
      (searchKeywords.repo
        ? repositoryName.includes(searchKeywords.repo)
        : true) &&
      (searchKeywords.repoNot
        ? !repositoryName.includes(searchKeywords.repoNot)
        : true);

    const freeTextFilter =
      pr.title.toLowerCase().includes(searchKeywords.freetext) ||
      pr.prNumber.toString().includes(searchKeywords.freetext) ||
      repositoryName.includes(searchKeywords.freetext) ||
      authorName.includes(searchKeywords.freetext);

    return keywordFilter && freeTextFilter;
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

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="gray">Search: </Text>
          <Text>
            {searchQuery || (
              <Text dimColor>
                Try: repo:myrepo, author:username bug fix...
              </Text>
            )}
          </Text>
        </Box>
        {!searchQuery && (
          <Box marginTop={0}>
            <Text dimColor italic>
              💡 Use repo:name, author:user to filter
            </Text>
          </Box>
        )}
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
                      return (
                        <Box key={pr.id} flexDirection="column">
                          <Text
                            color={
                              actualIndex === selectedIndex ? "cyan" : "white"
                            }
                          >
                            {actualIndex === selectedIndex
                              ? ITEM_SELECTOR
                              : ITEM_SELECTION_GAP}
                            #{pr.prNumber} {pr.title}
                            <Text color="gray"> [{pr.repositoryName}]</Text>
                          </Text>
                          <Text
                            color={
                              actualIndex === selectedIndex
                                ? MAIN_COLOR
                                : "white"
                            }
                          >
                            {`${ITEM_SELECTION_GAP}  by ${pr.authorName} ⏺ ${pr.updatedAt}`}
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

function extractSearchKeywords(query: string): PullRequestSearchKeywords {
  const q = query.trim();
  if (!q) return { freetext: "" };

  let author: string | undefined = undefined;
  let repo: string | undefined = undefined;
  let authorNot: string | undefined;
  let repoNot: string | undefined;
  const freeText: string[] = [];

  for (const part of q.split(/\s+/)) {
    let colonIndex = part.indexOf(":");
    if (colonIndex === -1) {
      freeText.push(part);
      continue;
    }

    const isNegative = part.startsWith("-");
    colonIndex = isNegative ? colonIndex - 1 : colonIndex;

    const searchKeyword = isNegative ? part.slice(1) : part;
    const key = searchKeyword.slice(0, colonIndex);
    const value = searchKeyword.slice(colonIndex + 1).trim();

    if (!value) {
      freeText.push(part);
      continue;
    }

    if (key === "author") {
      if (isNegative) authorNot = value.toLowerCase();
      else author = value.toLowerCase();
      continue;
    }

    if (key === "repo" || key === "repository") {
      if (isNegative) repoNot = value.toLowerCase();
      else repo = value.toLowerCase();
      continue;
    }

    // Unknown keyword treat as freetext
    freeText.push(part);
  }

  return { author, authorNot, repo, repoNot, freetext: freeText.join(" ") };
}

export default PullRequestSelector;

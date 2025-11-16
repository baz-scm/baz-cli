import React, { useEffect, useState, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Repository } from "../lib/clients/baz.js";

interface RepositoryAutocompleteProps {
  repositories: Repository[];
  onSelect: (repo: Repository) => void;
  initialRepoId?: string;
}

const RepositoryAutocomplete: React.FC<RepositoryAutocompleteProps> = ({
  repositories,
  onSelect,
  initialRepoId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const isFirstRender = useRef(true);

  const initialIndex = initialRepoId
    ? repositories.findIndex((repo) => repo.id === initialRepoId)
    : 0;

  const [selectedIndex, setSelectedIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0,
  );

  const filteredRepos = repositories.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.fullName.toLowerCase().includes(query) ||
      (repo.description?.toLowerCase().includes(query) ?? false)
    );
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSelectedIndex(0);
  }, [searchQuery]);

  useInput((_input, key) => {
    if (isTyping) {
      // Tab key to switch to navigation mode
      if (key.tab) {
        setIsTyping(false);
      }
      return;
    }

    // Navigation mode
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filteredRepos.length - 1, prev + 1));
    } else if (key.return) {
      handleSubmit();
    } else if (key.tab) {
      setIsTyping(true);
    }
  });

  const handleSubmit = () => {
    if (filteredRepos.length > 0) {
      onSelect(filteredRepos[selectedIndex]);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Search for a Repository:
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <TextInput
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSubmit}
          placeholder="Type to search..."
          focus={isTyping}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {filteredRepos.length === 0 ? (
          <Text color="yellow">No repositories match your search.</Text>
        ) : (
          <>
            <Text dimColor>
              Found {filteredRepos.length}{" "}
              {filteredRepos.length === 1 ? "repository" : "repositories"}:
            </Text>
            <Box flexDirection="column" marginTop={1}>
              {(() => {
                const maxVisible = 10;
                const startIndex = Math.max(
                  0,
                  Math.min(
                    selectedIndex - 5,
                    filteredRepos.length - maxVisible,
                  ),
                );
                const endIndex = Math.min(
                  startIndex + maxVisible,
                  filteredRepos.length,
                );
                const visibleRepos = filteredRepos.slice(startIndex, endIndex);

                return (
                  <>
                    {startIndex > 0 && (
                      <Text dimColor italic>
                        ... {startIndex} more above
                      </Text>
                    )}
                    {visibleRepos.map((repo, index) => {
                      const actualIndex = startIndex + index;
                      return (
                        <Box key={repo.fullName}>
                          <Text
                            color={
                              actualIndex === selectedIndex ? "cyan" : "white"
                            }
                          >
                            {actualIndex === selectedIndex ? "❯ " : "  "}
                            {repo.fullName}
                            {repo.description && (
                              <Text color="gray"> - {repo.description}</Text>
                            )}
                          </Text>
                        </Box>
                      );
                    })}
                    {endIndex < filteredRepos.length && (
                      <Text dimColor italic>
                        ... {filteredRepos.length - endIndex} more below
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
          {isTyping
            ? "Tab to navigate • Enter to select • Ctrl+C to cancel"
            : "↑↓ to navigate • Tab to search • Enter to select • Ctrl+C to cancel"}
        </Text>
      </Box>
    </Box>
  );
};

export default RepositoryAutocomplete;

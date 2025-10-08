import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Repository } from "../lib/clients/baz";

interface RepositoryAutocompleteProps {
  repositories: Repository[];
  onSelect: (repo: Repository) => void;
}

const RepositoryAutocomplete: React.FC<RepositoryAutocompleteProps> = ({
  repositories,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const filteredRepos = repositories.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.fullName.toLowerCase().includes(query) ||
      (repo.description?.toLowerCase().includes(query) ?? false)
    );
  });

  useEffect(() => {
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
              {filteredRepos.slice(0, 10).map((repo, index) => (
                <Box key={repo.fullName}>
                  <Text color={index === selectedIndex ? "cyan" : "white"}>
                    {index === selectedIndex ? "❯ " : "  "}
                    {repo.fullName}
                    {repo.description && (
                      <Text color="gray"> - {repo.description}</Text>
                    )}
                  </Text>
                </Box>
              ))}
              {filteredRepos.length > 10 && (
                <Box marginTop={1}>
                  <Text dimColor italic>
                    ... and {filteredRepos.length - 10} more
                  </Text>
                </Box>
              )}
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

import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { PullRequest } from "../lib/clients/baz.js";
import { usePullRequests } from "../hooks/usePullRequests.js";
import PullRequestSelector from "./PullRequestSelector.js";

interface PullRequestSelectorContainerProps {
  repoId?: string;
  onSelect: (pr: PullRequest) => void;
  initialPrId?: string;
}

const PullRequestSelectorContainer: React.FC<
  PullRequestSelectorContainerProps
> = ({ repoId, onSelect, initialPrId }) => {
  const { data, loading, error } = usePullRequests(repoId);

  if (loading) {
    return (
      <Box>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>
        <Text color="blue"> Fetching pull requests...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          ❌ Error: {error}
        </Text>
      </Box>
    );
  }

  if (data.length === 0) {
    return <EmptyPRState />;
  }

  return (
    <PullRequestSelector
      pullRequests={data}
      onSelect={onSelect}
      initialPrId={initialPrId}
    />
  );
};

const EmptyPRState: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  useInput((_input, key) => {
    if (key.escape && onBack) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="yellow">📭 No open pull requests found</Text>
      </Box>
      <Box>
        <Text dimColor italic>
          {onBack ? "ESC to go back • " : ""}Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestSelectorContainer;

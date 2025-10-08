import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { PullRequest } from "../lib/clients/baz";
import { usePullRequests } from "../hooks/usePullRequests";
import PullRequestSelector from "./PullRequestSelector";

interface PullRequestSelectorContainerProps {
  repoId: string;
  onSelect: (pr: PullRequest) => void;
  onCancel?: () => void;
}

const PullRequestSelectorContainer: React.FC<
  PullRequestSelectorContainerProps
> = ({ repoId, onSelect }) => {
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

  return <PullRequestSelector pullRequests={data} onSelect={onSelect} />;
};

export default PullRequestSelectorContainer;

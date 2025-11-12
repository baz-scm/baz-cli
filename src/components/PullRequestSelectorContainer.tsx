import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { PullRequest } from "../lib/clients/baz.js";
import { usePullRequests } from "../hooks/usePullRequests.js";
import PullRequestSelector from "./PullRequestSelector.js";

interface PullRequestSelectorContainerProps {
  repoId: string;
  onSelect: (pr: PullRequest) => void;
  onBack: () => void;
  initialPrId?: string;
}

const PullRequestSelectorContainer: React.FC<
  PullRequestSelectorContainerProps
> = ({ repoId, onSelect, onBack, initialPrId }) => {
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

  return (
    <PullRequestSelector
      pullRequests={data}
      onSelect={onSelect}
      onBack={onBack}
      initialPrId={initialPrId}
    />
  );
};

export default PullRequestSelectorContainer;

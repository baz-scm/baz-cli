import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { PullRequest } from "../../lib/providers/index.js";
import { usePullRequests } from "../../hooks/usePullRequests.js";
import { getDiff, isOnNonDefaultBranch } from "../../lib/git.js";
import PullRequestSelector from "./PullRequestSelector.js";
import { getTheme } from "../../theme/theme.js";

const theme = getTheme();

interface PullRequestSelectorContainerProps {
  onSelect: (pr: PullRequest) => void;
  onLocalSelect?: () => void;
  initialPrId?: string;
}

const PullRequestSelectorContainer: React.FC<
  PullRequestSelectorContainerProps
> = ({ onSelect, onLocalSelect, initialPrId }) => {
  const { data, loading, error, updateData } = usePullRequests();
  const [hasLocalReviewOption, setHasLocalReviewOption] = useState(false);

  useEffect(() => {
    try {
      const { onFeatureBranch } = isOnNonDefaultBranch();
      if (onFeatureBranch) {
        setHasLocalReviewOption(true);
        return;
      }
      setHasLocalReviewOption(!!getDiff());
    } catch {
      // Not a git repo or git not available — don't show local option
    }
  }, []);

  if (loading) {
    return (
      <Box>
        <Text color={theme.info}>
          <Spinner type="dots" />
        </Text>
        <Text color={theme.info}> Fetching pull requests...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.error} bold>
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
      onLocalSelect={hasLocalReviewOption ? onLocalSelect : undefined}
      initialPrId={initialPrId}
      updateData={updateData}
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
        <Text color={theme.warning}>📭 No open pull requests found</Text>
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

import React, { useState } from "react";
import { Box, Spacer, Text } from "ink";
import Spinner from "ink-spinner";
import IssueBrowser from "./IssueBrowser.js";
import { usePullRequest } from "../hooks/usePullRequest.js";
import PullRequestOverviewSelect from "./PullRequestOverviewSelect.js";
import { useIssues } from "../hooks/useIssues.js";
import PullRequestOverview from "./PullRequestOverview.js";
import { MAIN_COLOR } from "../theme/colors.js";

type State = { step: "prompt" } | { step: "showIssues" } | { step: "complete" };

interface PullRequestReviewProps {
  repoId: string;
  prId: string;
  onComplete: () => void;
}

const PullRequestReview: React.FC<PullRequestReviewProps> = ({
  repoId,
  prId,
  onComplete,
}) => {
  const [state, setState] = useState<State>({ step: "prompt" });

  const pr = usePullRequest(prId);
  const issues = useIssues(prId);

  const loading = pr.loading || issues.loading;
  const error = pr.error || issues.error;

  if (loading) {
    return (
      <Box>
        <Text color={MAIN_COLOR}>
          <Spinner type="dots" />
        </Text>
        <Text color={MAIN_COLOR}> Fetching pull request details...</Text>
      </Box>
    );
  }

  if (error || !pr.data) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          ❌ Error: {error}
        </Text>
      </Box>
    );
  }

  const handlePromptSelect = () => {
    if (issues.data.length > 0) {
      setState({ step: "showIssues" });
    } else {
      setState({ step: "complete" });
      onComplete();
    }
  };

  switch (state.step) {
    case "prompt":
      return (
        <PullRequestOverviewSelect
          pr={pr.data}
          issues={issues.data}
          onSelect={handlePromptSelect}
        />
      );
    case "showIssues":
      return (
        <>
          <PullRequestOverview pr={pr.data} issues={issues.data} />
          <Spacer />
          <IssueBrowser
            issues={issues.data}
            prId={prId}
            repoId={repoId}
            onComplete={onComplete}
          />
        </>
      );
    case "complete":
      return null;
  }
};

export default PullRequestReview;

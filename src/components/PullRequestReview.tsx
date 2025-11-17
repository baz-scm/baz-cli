import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
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
  onBack: () => void;
}

const PullRequestReview: React.FC<PullRequestReviewProps> = ({
  repoId,
  prId,
  onComplete,
  onBack,
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
      <StateMessage
        message={`❌ Error: ${error}`}
        color="red"
        bold
        onComplete={onComplete}
        onBack={onBack}
      />
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

          <IssueBrowser
            issues={issues.data}
            prId={prId}
            repoId={repoId}
            onComplete={onComplete}
            onBack={onBack}
          />
        </>
      );
    case "complete":
      return null;
  }
};

const StateMessage: React.FC<{
  message: string;
  color: string;
  bold?: boolean;
  onComplete: () => void;
  onBack: () => void;
}> = ({ message, color, bold = false, onComplete, onBack }) => {
  useInput((_input, key) => {
    if (key.return) {
      onComplete();
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={color} bold={bold}>
          {message}
        </Text>
      </Box>
      <Box>
        <Text dimColor italic>
          Enter to continue • ESC to go back • Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestReview;

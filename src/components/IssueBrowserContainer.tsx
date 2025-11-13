import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { useIssues } from "../hooks/useIssues.js";
import IssueBrowser from "./IssueBrowser.js";

interface IssueBrowserContainerProps {
  prId: string;
  repoId: string;
  onComplete: () => void;
  onBack: () => void;
}

const IssueBrowserContainer: React.FC<IssueBrowserContainerProps> = ({
  prId,
  repoId,
  onComplete,
  onBack,
}) => {
  const { data, loading, error } = useIssues(prId);

  if (loading) {
    return (
      <Box>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>
        <Text color="blue"> Fetching issues...</Text>
      </Box>
    );
  }

  if (error) {
    return <ErrorState error={error} onComplete={onComplete} onBack={onBack} />;
  }

  if (data.length === 0) {
    return <EmptyState onComplete={onComplete} onBack={onBack} />;
  }

  return (
    <IssueBrowser
      issues={data}
      onComplete={onComplete}
      prId={prId}
      repoId={repoId}
      onBack={onBack}
    />
  );
};

const ErrorState: React.FC<{
  error: string;
  onComplete: () => void;
  onBack: () => void;
}> = ({ error, onComplete, onBack }) => {
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
        <Text color="red" bold>
          ❌ Error: {error}
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

const EmptyState: React.FC<{
  onComplete: () => void;
  onBack: () => void;
}> = ({ onComplete, onBack }) => {
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
        <Text color="green">✨ No issues to review!</Text>
      </Box>
      <Box>
        <Text dimColor italic>
          Enter to continue • ESC to go back • Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default IssueBrowserContainer;

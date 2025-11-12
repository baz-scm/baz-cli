import React from "react";
import { Box, Text } from "ink";
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
    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          ❌ Error: {error}
        </Text>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">✨ No issues to review!</Text>
      </Box>
    );
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

export default IssueBrowserContainer;

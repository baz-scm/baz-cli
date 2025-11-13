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

  if (data.length === 0) {
    return (
      <StateMessage
        message="✨ No issues to review!"
        color="green"
        onComplete={onComplete}
        onBack={onBack}
      />
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

export default IssueBrowserContainer;

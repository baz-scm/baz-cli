import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useDiscussions } from "../hooks/useDiscussions";
import DiscussionSelector from "./DiscussionSelector";

interface DiscussionSelectorContainerProps {
  prId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

const DiscussionSelectorContainer: React.FC<
  DiscussionSelectorContainerProps
> = ({ prId, onComplete }) => {
  const { data, loading, error } = useDiscussions(prId);

  if (loading) {
    return (
      <Box>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>
        <Text color="blue"> Fetching discussions...</Text>
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
        <Text color="green">✨ No discussions to review!</Text>
      </Box>
    );
  }

  return (
    <DiscussionSelector
      discussions={data}
      onComplete={onComplete}
      prId={prId}
    />
  );
};

export default DiscussionSelectorContainer;

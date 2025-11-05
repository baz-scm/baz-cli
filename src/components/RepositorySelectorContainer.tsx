import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import RepositorySelector from "./RepositorySelector.js";
import { useRepositories } from "../hooks/useRepositories.js";
import { Repository } from "../lib/clients/baz.js";

interface RepositorySelectorContainerProps {
  onSelect: (repo: Repository) => void;
  onCancel?: () => void;
}

const RepositorySelectorContainer: React.FC<
  RepositorySelectorContainerProps
> = ({ onSelect }) => {
  const { data, loading, error } = useRepositories();

  if (loading) {
    return (
      <Box>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>
        <Text color="blue"> Fetching repositories...</Text>
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

  return <RepositorySelector repositories={data} onSelect={onSelect} />;
};

export default RepositorySelectorContainer;

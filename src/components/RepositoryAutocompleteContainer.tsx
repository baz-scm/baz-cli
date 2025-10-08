import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import RepositoryAutocomplete from "./RepositoryAutocomplete.js";
import { useRepositories } from "../hooks/useRepositories.js";
import { Repository } from "../lib/clients/baz";

interface RepositoryAutocompleteContainerProps {
  onSelect: (repo: Repository) => void;
}

const RepositoryAutocompleteContainer: React.FC<
  RepositoryAutocompleteContainerProps
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

  return <RepositoryAutocomplete repositories={data} onSelect={onSelect} />;
};

export default RepositoryAutocompleteContainer;

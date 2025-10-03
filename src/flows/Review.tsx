import React, { useState } from "react";
import { Box, Text } from "ink";
import { PullRequest, Repository } from "../lib/clients/baz.js";
import RepositoryAutocompleteContainer from "../components/RepositoryAutocompleteContainer";
import PullRequestSelectorContainer from "../components/PullRequestSelectorContainer";
import DiscussionSelectorContainer from "../components/DiscussionSelectorContainer";

type FlowStep =
  | "handleRepoSelect"
  | "handlePRSelect"
  | "handleDiscussionSelect"
  | "complete";

interface FlowState {
  step: FlowStep;
  selectedRepo?: Repository;
  selectedPR?: PullRequest;
  // Add more state as needed for subsequent steps
}

const ReviewFlow: React.FC = () => {
  const [flowState, setFlowState] = useState<FlowState>({
    step: "handleRepoSelect",
  });

  // Step 1: Select Repository
  const handleRepoSelect = (repo: Repository) => {
    setFlowState({
      selectedRepo: repo,
      step: "handlePRSelect",
    });
  };

  // Step 2: Select Pull Request
  const handlePRSelect = (pr: PullRequest) => {
    setFlowState({
      ...flowState,
      selectedPR: pr,
      step: "handleDiscussionSelect",
    });
  };

  // Step 3: Select Discussion
  const handleDiscussionSelect = () => {
    setFlowState({
      ...flowState,
      step: "complete",
    });
  };

  switch (flowState.step) {
    case "handleRepoSelect":
      return (
        <Box flexDirection="column">
          <RepositoryAutocompleteContainer onSelect={handleRepoSelect} />
        </Box>
      );

    case "handlePRSelect":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Selected repository: </Text>
            <Text color="yellow">{flowState.selectedRepo!.fullName}</Text>
          </Box>
          <PullRequestSelectorContainer
            repoId={flowState.selectedRepo!.id}
            onSelect={handlePRSelect}
          />
        </Box>
      );

    case "handleDiscussionSelect":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Selected repository: </Text>
            <Text color="yellow">{flowState.selectedRepo!.fullName}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="green">✓ Selected pull request: </Text>
            <Text color="yellow">
              #{flowState.selectedPR!.prNumber} {flowState.selectedPR!.title}
            </Text>
          </Box>
          <DiscussionSelectorContainer
            prId={flowState.selectedPR!.id}
            onComplete={handleDiscussionSelect}
          />
        </Box>
      );

    case "complete":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Selected repository: </Text>
            <Text color="yellow">{flowState.selectedRepo!.fullName}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="green">✓ Selected PR: </Text>
            <Text color="yellow">
              #{flowState.selectedPR!.prNumber} {flowState.selectedPR!.title}
            </Text>
          </Box>
          <Text color="green" bold>
            ✨ Review Complete!
          </Text>
        </Box>
      );

    default:
      return <Text color="red">Unknown step</Text>;
  }
};

export default ReviewFlow;

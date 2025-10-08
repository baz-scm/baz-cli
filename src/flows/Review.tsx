import React, { useState } from "react";
import { Box, Text } from "ink";
import { PullRequest, Repository } from "../lib/clients/baz.js";
import RepositoryAutocompleteContainer from "../components/RepositoryAutocompleteContainer";
import PullRequestSelectorContainer from "../components/PullRequestSelectorContainer";
import DiscussionSelectorContainer from "../components/DiscussionSelectorContainer";

type FlowState =
  | { step: "handleRepoSelect" }
  | { step: "handlePRSelect"; selectedRepo: Repository }
  | {
      step: "handleDiscussionSelect" | "complete";
      selectedRepo: Repository;
      selectedPR: PullRequest;
    };

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
    if (flowState.step !== "handlePRSelect") return;

    setFlowState({
      ...flowState,
      selectedPR: pr,
      step: "handleDiscussionSelect",
    });
  };

  // Step 3: Select Discussion
  const handleDiscussionSelect = () => {
    if (flowState.step !== "handleDiscussionSelect") return;

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
            <Text color="yellow">{flowState.selectedRepo.fullName}</Text>
          </Box>
          <PullRequestSelectorContainer
            repoId={flowState.selectedRepo.id}
            onSelect={handlePRSelect}
          />
        </Box>
      );

    case "handleDiscussionSelect":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Selected repository: </Text>
            <Text color="yellow">{flowState.selectedRepo.fullName}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="green">✓ Selected pull request: </Text>
            <Text color="yellow">
              #{flowState.selectedPR.prNumber} {flowState.selectedPR.title}
            </Text>
          </Box>
          <DiscussionSelectorContainer
            prId={flowState.selectedPR.id}
            onComplete={handleDiscussionSelect}
          />
        </Box>
      );

    case "complete":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Selected repository: </Text>
            <Text color="yellow">{flowState.selectedRepo.fullName}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="green">✓ Selected PR: </Text>
            <Text color="yellow">
              #{flowState.selectedPR.prNumber} {flowState.selectedPR.title}
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

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import {
  PullRequest,
  Repository,
  fetchIntegrations,
} from "../lib/clients/baz.js";
import RepositoryAutocompleteContainer from "../components/RepositoryAutocompleteContainer.js";
import PullRequestSelectorContainer from "../components/PullRequestSelectorContainer.js";
import HeaderDisplay from "../components/HeaderDisplay.js";
import IntegrationsCheck from "../components/IntegrationsCheck.js";
import PostReviewPrompt, {
  PostReviewAction,
} from "../components/PostReviewPrompt.js";
import { logger } from "../lib/logger.js";
import PullRequestReview from "../components/PullRequestReview.js";
import { MAIN_COLOR } from "../theme/colors.js";
import { REVIEW_COMPLETE_TEXT } from "../theme/banners.js";

type FlowState =
  | { step: "handleRepoSelect"; selectedRepo?: Repository }
  | {
      step: "handlePRSelect";
      selectedRepo: Repository;
      selectedPR?: PullRequest;
    }
  | {
      step: "integrationsCheck";
      selectedRepo: Repository;
      selectedPR: PullRequest;
    }
  | {
      step: "handleIssueSelect";
      selectedRepo: Repository;
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    }
  | {
      step: "reviewComplete";
      selectedRepo: Repository;
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    }
  | {
      step: "complete";
      selectedRepo: Repository;
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    };

const InternalReviewFlow: React.FC = () => {
  const [flowState, setFlowState] = useState<FlowState>({
    step: "handleRepoSelect",
  });
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const integrations = await fetchIntegrations();
        logger.info(integrations);
        const hasTicketingIntegration = integrations.some(
          (integration) =>
            integration.integrationType === "jira" ||
            integration.integrationType === "linear" ||
            integration.integrationType === "youtrack",
        );
        setHasIntegration(hasTicketingIntegration);
      } catch (error) {
        logger.debug({ error }, "Error checking integrations");
        setHasIntegration(true);
      }
    };

    checkIntegrations();
  }, []);

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

    if (hasIntegration === false) {
      setFlowState({
        ...flowState,
        selectedPR: pr,
        step: "integrationsCheck",
      });
    } else {
      if (hasIntegration === null) {
        logger.debug(
          "Integration check not completed, proceeding without setup",
        );
      }
      setFlowState({
        ...flowState,
        selectedPR: pr,
        step: "handleIssueSelect",
        skippedIntegration: false,
      });
    }
  };

  // Step 3: Integration Check
  const handleIntegrationsCheckComplete = (skipped: boolean) => {
    if (flowState.step !== "integrationsCheck") return;

    setFlowState({
      ...flowState,
      step: "handleIssueSelect",
      skippedIntegration: skipped,
    });
  };

  // Step 4: Browse Issues
  const handleIssueComplete = () => {
    if (flowState.step !== "handleIssueSelect") return;

    setFlowState({
      ...flowState,
      step: "reviewComplete",
    });
  };

  // Step 5: Post-Review Actions
  const handlePostReviewAction = (action: PostReviewAction) => {
    if (flowState.step !== "reviewComplete") return;

    switch (action) {
      case "reviewSameRepo":
        setFlowState({
          selectedRepo: flowState.selectedRepo,
          step: "handlePRSelect",
        });
        break;
      case "reviewDifferentRepo":
        setFlowState({
          step: "handleRepoSelect",
        });
        break;
      case "exit":
        setFlowState({
          ...flowState,
          step: "complete",
        });
        break;
    }
  };

  const handleBackFromPRSelect = () => {
    if (flowState.step !== "handlePRSelect") return;

    setFlowState({
      step: "handleRepoSelect",
      selectedRepo: flowState.selectedRepo,
    });
  };

  const handleBackFromIssueSelect = () => {
    if (flowState.step !== "handleIssueSelect") return;

    setFlowState({
      ...flowState,
      step: "handlePRSelect",
    });
  };

  switch (flowState.step) {
    case "handleRepoSelect":
      return (
        <Box flexDirection="column">
          <RepositoryAutocompleteContainer
            onSelect={handleRepoSelect}
            initialRepoId={flowState.selectedRepo?.id}
          />
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
            onBack={handleBackFromPRSelect}
            initialPrId={flowState.selectedPR?.id}
          />
        </Box>
      );

    case "integrationsCheck":
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
          <IntegrationsCheck onComplete={handleIntegrationsCheckComplete} />
        </Box>
      );

    case "handleIssueSelect":
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
          <PullRequestReview
            repoId={flowState.selectedRepo.id}
            prId={flowState.selectedPR.id}
            onComplete={handleIssueComplete}
            onBack={handleBackFromIssueSelect}
          />
        </Box>
      );

    case "reviewComplete":
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
          <Box marginBottom={1}>
            <Text color="green" bold>
              ✨ Review Complete!
            </Text>
          </Box>
          <PostReviewPrompt onSelect={handlePostReviewAction} />
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
          <Box>
            <Text color={MAIN_COLOR}>{REVIEW_COMPLETE_TEXT}</Text>
          </Box>
          <Text>CR Review completed</Text>
        </Box>
      );

    default:
      return <Text color="red">Unknown step</Text>;
  }
};

const ReviewFlow = () => (
  <>
    <HeaderDisplay />

    <InternalReviewFlow />
  </>
);
export default ReviewFlow;

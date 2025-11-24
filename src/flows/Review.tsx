import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PullRequest, fetchIntegrations } from "../lib/clients/baz.js";
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

const SelectedPRHeader: React.FC<{ pullRequest: PullRequest }> = ({
  pullRequest,
}) => (
  <Box marginBottom={1}>
    <Text color="green">✓ Selected PR: </Text>
    <Text color="yellow">
      #{pullRequest.prNumber} {pullRequest.title} [{pullRequest.repositoryName}]
    </Text>
  </Box>
);

type FlowState =
  | {
      step: "handlePRSelect";
      selectedPR?: PullRequest;
    }
  | {
      step: "integrationsCheck";
      selectedPR: PullRequest;
    }
  | {
      step: "handleIssueSelect";
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    }
  | {
      step: "reviewComplete";
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    }
  | {
      step: "complete";
      selectedPR: PullRequest;
      skippedIntegration?: boolean;
    };

const InternalReviewFlow: React.FC = () => {
  const [flowState, setFlowState] = useState<FlowState>({
    step: "handlePRSelect",
  });
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const integrations = await fetchIntegrations();
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

  // Step 1: Select Pull Request
  const handlePRSelect = (pr: PullRequest) => {
    if (flowState.step !== "handlePRSelect") return;

    if (hasIntegration === false) {
      setFlowState({
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
        selectedPR: pr,
        step: "handleIssueSelect",
        skippedIntegration: false,
      });
    }
  };

  // Step 2: Integration Check
  const handleIntegrationsCheckComplete = (skipped: boolean) => {
    if (flowState.step !== "integrationsCheck") return;

    setFlowState({
      selectedPR: flowState.selectedPR,
      step: "handleIssueSelect",
      skippedIntegration: skipped,
    });
  };

  // Step 3: Browse Issues
  const handleIssueComplete = () => {
    if (flowState.step !== "handleIssueSelect") return;

    setFlowState({
      selectedPR: flowState.selectedPR,
      step: "reviewComplete",
    });
  };

  // Step 4: Post-Review Actions
  const handlePostReviewAction = (action: PostReviewAction) => {
    if (flowState.step !== "reviewComplete") return;

    switch (action) {
      case "reviewSameRepo":
        setFlowState({
          step: "handlePRSelect",
        });
        break;
      case "exit":
        setFlowState({
          selectedPR: flowState.selectedPR,
          step: "complete",
        });
        break;
    }
  };

  const handleBackFromIssueSelect = () => {
    if (flowState.step !== "handleIssueSelect") return;

    setFlowState({
      step: "handlePRSelect",
      selectedPR: flowState.selectedPR,
    });
  };

  switch (flowState.step) {
    case "handlePRSelect":
      return (
        <Box flexDirection="column">
          <PullRequestSelectorContainer
            onSelect={handlePRSelect}
            initialPrId={flowState.selectedPR?.id}
          />
        </Box>
      );

    case "integrationsCheck":
      return (
        <Box flexDirection="column">
          <SelectedPRHeader pullRequest={flowState.selectedPR} />
          <IntegrationsCheck onComplete={handleIntegrationsCheckComplete} />
        </Box>
      );

    case "handleIssueSelect":
      return (
        <Box flexDirection="column">
          <SelectedPRHeader pullRequest={flowState.selectedPR} />
          <PullRequestReview
            repoId={flowState.selectedPR.repoId}
            prId={flowState.selectedPR.id}
            onComplete={handleIssueComplete}
            onBack={handleBackFromIssueSelect}
          />
        </Box>
      );

    case "reviewComplete":
      return (
        <CompleteMessage
          flowState={flowState}
          onSelect={handlePostReviewAction}
        />
      );

    case "complete":
      return <CompleteMessage flowState={flowState} />;

    default:
      return <Text color="red">Unknown step</Text>;
  }
};

const CompleteMessage: React.FC<{
  flowState: Extract<
    FlowState,
    { step: "reviewComplete" } | { step: "complete" }
  >;
  onSelect?: (action: PostReviewAction) => void;
}> = ({ flowState, onSelect }) => {
  return (
    <Box flexDirection="column">
      <SelectedPRHeader pullRequest={flowState.selectedPR} />
      <Box flexDirection="column" marginBottom={1}>
        <Text color={MAIN_COLOR}>{REVIEW_COMPLETE_TEXT}</Text>
        <Text>CR Review completed</Text>
      </Box>
      {onSelect && (
        <PostReviewPrompt onSelect={onSelect} prId={flowState.selectedPR.id} />
      )}
    </Box>
  );
};

const ReviewFlow = () => (
  <>
    <HeaderDisplay />

    <InternalReviewFlow />
  </>
);
export default ReviewFlow;

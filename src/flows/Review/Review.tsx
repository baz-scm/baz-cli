import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PullRequest } from "../../lib/providers/index.js";
import PullRequestSelectorContainer from "../../pages/PRSelector/PullRequestSelectorContainer.js";
import HeaderDisplay from "../../components/HeaderDisplay.js";
import IntegrationsCheck from "../Integration/IntegrationsCheck.js";
import PostReviewPrompt, { PostReviewAction } from "./PostReviewPrompt.js";
import { logger } from "../../lib/logger.js";
import PullRequestReview from "../../components/PullRequestReview.js";
import LocalDiffPrompt, {
  type DiffResult,
} from "../LocalReview/LocalDiffPrompt.js";
import LocalPullRequestReview from "../LocalReview/LocalPullRequestReview.js";
import { getRepoName } from "../../lib/git.js";
import { getTheme } from "../../theme/theme.js";
import { REVIEW_COMPLETE_TEXT } from "../../theme/banners.js";
import { useAppMode } from "../../lib/config/index.js";
import {
  ReservedRows,
  ScreenLayoutProvider,
} from "../../components/layout/ScreenLayout.js";

const theme = getTheme();

const SelectedPRHeader: React.FC<{ pullRequest: PullRequest }> = ({
  pullRequest,
}) => (
  <ReservedRows id="selected-pr">
    <Box marginBottom={1}>
      <Text color={theme.success}>✓ Selected PR: </Text>
      <Text color={theme.accent}>
        #{pullRequest.prNumber} {pullRequest.title} [
        {pullRequest.repositoryName}]
      </Text>
    </Box>
  </ReservedRows>
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
      step: "pullRequestReview";
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
    }
  | {
      step: "localDiffPrompt";
    }
  | {
      step: "localReview";
      diffResult: DiffResult;
    }
  | {
      step: "localReviewComplete";
    };

interface InternalReviewFlowProps {
  isLocal?: boolean;
}

const InternalReviewFlow: React.FC<InternalReviewFlowProps> = ({ isLocal }) => {
  const [flowState, setFlowState] = useState<FlowState>(
    isLocal ? { step: "localDiffPrompt" } : { step: "handlePRSelect" },
  );
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        // Integrations not supported in current mode - skip check
        if (appMode.mode.name === "tokens") {
          setHasIntegration(true);
          return;
        }

        const integrations =
          await appMode.mode.dataProvider.fetchIntegrations();

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

    // Skip integrations config for tokens mode
    if (appMode.mode.name === "tokens") {
      setFlowState({
        selectedPR: pr,
        step: "pullRequestReview",
      });
      return;
    }

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
        step: "pullRequestReview",
        skippedIntegration: false,
      });
    }
  };

  // Step 2: Integration Check
  const handleIntegrationsCheckComplete = (skipped: boolean) => {
    if (flowState.step !== "integrationsCheck") return;

    setFlowState({
      selectedPR: flowState.selectedPR,
      step: "pullRequestReview",
      skippedIntegration: skipped,
    });
  };

  // Step 3: Browse Issues
  const handleIssueComplete = () => {
    if (flowState.step !== "pullRequestReview") return;

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
    if (flowState.step !== "pullRequestReview") return;

    setFlowState({
      step: "handlePRSelect",
      selectedPR: flowState.selectedPR,
    });
  };

  // Local review handlers
  const handleLocalSelect = () => {
    setFlowState({ step: "localDiffPrompt" });
  };

  const handleLocalDiffReady = (result: DiffResult) => {
    setFlowState({ step: "localReview", diffResult: result });
  };

  const handleLocalDiffError = (message: string) => {
    // Fall back to PR selector with error shown
    logger.debug({ message }, "Local diff error");
    setFlowState({ step: "handlePRSelect" });
  };

  const handleLocalReviewComplete = () => {
    setFlowState({ step: "localReviewComplete" });
  };

  const handleLocalReviewBack = () => {
    if (isLocal) {
      // If launched with --local, go back to diff prompt
      setFlowState({ step: "localDiffPrompt" });
    } else {
      // If entered from PR selector, go back to selector
      setFlowState({ step: "handlePRSelect" });
    }
  };

  switch (flowState.step) {
    case "handlePRSelect":
      return (
        <Box flexDirection="column">
          <PullRequestSelectorContainer
            onSelect={handlePRSelect}
            onLocalSelect={handleLocalSelect}
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

    case "pullRequestReview":
      return (
        <Box flexDirection="column">
          <SelectedPRHeader pullRequest={flowState.selectedPR} />
          <PullRequestReview
            prContext={{
              prId: flowState.selectedPR.id,
              fullRepoName: flowState.selectedPR.repositoryName,
              prNumber: flowState.selectedPR.prNumber,
            }}
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

    case "localDiffPrompt":
      return (
        <Box flexDirection="column">
          <LocalDiffPrompt
            onReady={handleLocalDiffReady}
            onError={handleLocalDiffError}
          />
        </Box>
      );

    case "localReview": {
      const { diffResult } = flowState;
      const reviewLabel = diffResult.currentBranch
        ? `${diffResult.currentBranch} vs ${diffResult.defaultBranch}`
        : "uncommitted changes";
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.success}>✓ Reviewing {reviewLabel} </Text>
            <Text color={theme.accent}>[{getRepoName()}]</Text>
          </Box>
          <LocalPullRequestReview
            diffText={diffResult.diffText}
            repoName={getRepoName()}
            currentBranch={diffResult.currentBranch}
            defaultBranch={diffResult.defaultBranch}
            onComplete={handleLocalReviewComplete}
            onBack={handleLocalReviewBack}
          />
        </Box>
      );
    }

    case "localReviewComplete":
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.main}>{REVIEW_COMPLETE_TEXT}</Text>
            <Text>Local review completed</Text>
          </Box>
        </Box>
      );

    default:
      return <Text color={theme.error}>Unknown step</Text>;
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
        <Text color={theme.main}>{REVIEW_COMPLETE_TEXT}</Text>
        <Text>PR Review completed</Text>
      </Box>
      {onSelect && (
        <PostReviewPrompt
          onSelect={onSelect}
          prContext={{
            prId: flowState.selectedPR.id,
            fullRepoName: flowState.selectedPR.repositoryName,
            prNumber: flowState.selectedPR.prNumber,
          }}
        />
      )}
    </Box>
  );
};

interface ReviewFlowProps {
  isLocal?: boolean;
}

const ReviewFlow: React.FC<ReviewFlowProps> = ({ isLocal }) => (
  <ScreenLayoutProvider>
    <ReservedRows id="banner">
      <HeaderDisplay />
    </ReservedRows>

    <InternalReviewFlow isLocal={isLocal} />
  </ScreenLayoutProvider>
);
export default ReviewFlow;

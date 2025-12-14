import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import IssueBrowser from "../pages/IssueBrowser.js";
import { usePullRequest } from "../hooks/usePullRequest.js";
import PullRequestOverviewSelect from "../pages/PROverview/PullRequestOverviewSelect.js";
import { useIssues } from "../hooks/useIssues.js";
import { useSpecReviews } from "../hooks/useSpecReviews.js";
import SpecReviewBrowser from "../pages/SpecReview/SpecReviewBrowser.js";
import ReviewMenu, {
  ReviewMenuAction,
  CompletedSteps,
} from "../flows/Review/ReviewMenu.js";
import TriggerSpecReviewPrompt from "../pages/SpecReview/TriggerSpecReviewPrompt.js";
import MetRequirementBrowser from "../pages/SpecReview/MetRequirementBrowser.js";
import PRWalkthrough from "../pages/PRWalkthrough/PRWalkthrough.js";
import { MAIN_COLOR } from "../theme/colors.js";
import { useAppMode } from "../lib/config/index.js";
import type { Requirement } from "../lib/providers/index.js";
import { PRContext } from "../lib/providers/index.js";
import { useRepoWriteAccess } from "../hooks/useRepoWriteAccess.js";
import PRChat from "../pages/PRChat/PRChat.js";

interface MenuStateData {
  unmetRequirements: Requirement[];
  metRequirements: Requirement[];
  chatInput?: string;
  completedSteps: CompletedSteps;
}

type State =
  | { step: "prOverview" }
  | { step: "specReviewInProgress" }
  | { step: "triggerSpecReview" }
  | ({ step: "menu" } & MenuStateData)
  | ({ step: "browseUnmetRequirements" } & MenuStateData)
  | ({ step: "browseMetRequirements" } & MenuStateData)
  | ({ step: "showIssues" } & MenuStateData)
  | ({ step: "prWalkthrough" } & MenuStateData)
  | ({ step: "prChat" } & MenuStateData)
  | { step: "complete" };

interface PullRequestReviewProps {
  prContext: PRContext;
  onComplete: () => void;
  onBack: () => void;
}

const PullRequestReview: React.FC<PullRequestReviewProps> = ({
  prContext,
  onComplete,
  onBack,
}) => {
  const [state, setState] = useState<State>({ step: "prOverview" });
  const appMode = useAppMode();
  const pr = usePullRequest(prContext);
  const issues = useIssues(prContext);
  const specReviews = useSpecReviews(prContext.prId);
  const repoWriteAccess = useRepoWriteAccess(prContext);

  const prId = prContext.prId;
  const fullRepoName = prContext.fullRepoName;
  // bazRepoId is only available in baz mode, undefined in tokens mode
  const bazRepoId = pr.data?.repository_id;

  const loading =
    pr.loading ||
    issues.loading ||
    specReviews.loading ||
    repoWriteAccess.loading;
  const error =
    pr.error || issues.error || specReviews.error || repoWriteAccess.error;

  if (loading) {
    return (
      <Box>
        <Text color={MAIN_COLOR}>
          <Spinner type="dots" />
        </Text>
        <Text color={MAIN_COLOR}> Fetching details...</Text>
      </Box>
    );
  }

  if (error || !pr.data) {
    return (
      <StateMessage
        message={`Error: ${error}`}
        color="red"
        bold
        onComplete={onComplete}
        onBack={onBack}
      />
    );
  }

  // Get requirements from latest spec review
  const getRequirementsData = (): {
    unmetRequirements: Requirement[];
    metRequirements: Requirement[];
  } => {
    // Spec reviews not supported in current mode
    if (appMode.mode.name === "tokens" || specReviews.data === null) {
      return { unmetRequirements: [], metRequirements: [] };
    }

    const latestSpecReview = specReviews.data.at(-1);

    if (!latestSpecReview) {
      return { unmetRequirements: [], metRequirements: [] };
    }

    return {
      unmetRequirements: latestSpecReview.requirements.filter(
        (req) => req.verdict.toLowerCase() !== "met",
      ),
      metRequirements: latestSpecReview.requirements.filter(
        (req) => req.verdict.toLowerCase() === "met",
      ),
    };
  };

  // Initial state for completed steps
  const initialCompletedSteps: CompletedSteps = {
    unmetRequirements: false,
    metRequirements: false,
    comments: false,
    prWalkthrough: false,
  };

  // Handle prompt selection - check spec review status and go to menu
  const handlePrOverviewContinue = () => {
    // Spec reviews not supported in current mode - skip directly to menu
    if (appMode.mode.name === "tokens" || specReviews.data === null) {
      setState({
        step: "menu",
        unmetRequirements: [],
        metRequirements: [],
        completedSteps: initialCompletedSteps,
      });
      return;
    }

    const latestSpecReview = specReviews.data.at(-1);

    if (!latestSpecReview) {
      setState({ step: "triggerSpecReview" });
      return;
    }

    if (latestSpecReview.status === "in_progress") {
      setState({ step: "specReviewInProgress" });
      return;
    }

    if (latestSpecReview.status !== "success") {
      setState({ step: "triggerSpecReview" });
      return;
    }

    // Go directly to menu after spec review check
    const { unmetRequirements, metRequirements } = getRequirementsData();
    setState({
      step: "menu",
      unmetRequirements,
      metRequirements,
      completedSteps: initialCompletedSteps,
    });
  };

  // Handle trigger spec review complete - go to menu
  const handleTriggerSpecReviewComplete = () => {
    const { unmetRequirements, metRequirements } = getRequirementsData();
    setState({
      step: "menu",
      unmetRequirements,
      metRequirements,
      completedSteps: initialCompletedSteps,
    });
  };

  // Handle spec review in progress - go to menu
  const handleSpecReviewInProgressContinue = () => {
    const { unmetRequirements, metRequirements } = getRequirementsData();
    setState({
      step: "menu",
      unmetRequirements,
      metRequirements,
      completedSteps: initialCompletedSteps,
    });
  };

  // Handle menu action selection
  const handleMenuAction = (action: ReviewMenuAction, input?: string) => {
    if (state.step !== "menu") return;

    switch (action) {
      case "viewUnmetRequirements":
        setState({
          ...state,
          step: "browseUnmetRequirements",
        });
        break;
      case "viewMetRequirements":
        setState({
          ...state,
          step: "browseMetRequirements",
        });
        break;
      case "viewComments":
        setState({
          ...state,
          step: "showIssues",
        });
        break;
      case "prWalkthrough":
        setState({
          ...state,
          step: "prWalkthrough",
        });
        break;
      case "prChat":
        setState({
          ...state,
          chatInput: input,
          step: "prChat",
        });
        break;
      case "finish":
        setState({ step: "complete" });
        onComplete();
        break;
    }
  };

  // Handle completion of browsing unmet requirements
  const handleUnmetRequirementsComplete = () => {
    if (state.step !== "browseUnmetRequirements") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: {
        ...state.completedSteps,
        unmetRequirements: true,
      },
    });
  };

  // Handle back from unmet requirements - go to menu without marking complete
  const handleBackFromUnmetRequirements = () => {
    if (state.step !== "browseUnmetRequirements") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: state.completedSteps,
    });
  };

  // Handle completion of browsing met requirements
  const handleMetRequirementsComplete = () => {
    if (state.step !== "browseMetRequirements") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: {
        ...state.completedSteps,
        metRequirements: true,
      },
    });
  };

  // Handle back from met requirements - go to menu without marking complete
  const handleBackFromMetRequirements = () => {
    if (state.step !== "browseMetRequirements") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: state.completedSteps,
    });
  };

  // Handle completion of browsing issues/comments
  const handleIssuesComplete = () => {
    if (state.step !== "showIssues") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: {
        ...state.completedSteps,
        comments: true,
      },
    });
  };

  // Handle back from issues - go to menu without marking complete
  const handleBackFromIssues = () => {
    if (state.step !== "showIssues") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: state.completedSteps,
    });
  };

  // Handle back from PR walkthrough - go to menu and mark as complete (user interacted)
  const handleBackFromPRWalkthrough = () => {
    if (state.step !== "prWalkthrough") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: {
        ...state.completedSteps,
        prWalkthrough: true,
      },
    });
  };

  // Handle back from PR chat - go to menu
  const handleBackFromPRChat = () => {
    if (state.step !== "prChat") return;

    setState({
      ...state,
      step: "menu",
    });
  };

  // Handle back from menu - go to prompt
  const handleBackFromMenu = () => {
    setState({ step: "prOverview" });
  };

  // Handle back from trigger spec review
  const handleBackFromTriggerSpecReview = () => {
    setState({ step: "prOverview" });
  };

  switch (state.step) {
    case "prOverview":
      return (
        <PullRequestOverviewSelect
          pr={pr.data}
          issues={issues.data}
          specReviews={specReviews.data ?? []}
          onContinue={handlePrOverviewContinue}
          onBack={onBack}
        />
      );
    case "specReviewInProgress":
      return (
        <StateMessage
          message="Spec review is currently in progress. Continuing to review menu..."
          color="yellow"
          onComplete={handleSpecReviewInProgressContinue}
          onBack={onBack}
        />
      );
    case "triggerSpecReview":
      return (
        <TriggerSpecReviewPrompt
          prId={prId}
          bazRepoId={bazRepoId}
          onComplete={handleTriggerSpecReviewComplete}
          onBack={handleBackFromTriggerSpecReview}
        />
      );
    case "menu":
      return (
        <ReviewMenu
          unmetRequirementsCount={state.unmetRequirements.length}
          metRequirementsCount={state.metRequirements.length}
          unresolvedCommentsCount={issues.data.length}
          completedSteps={state.completedSteps}
          onSelect={handleMenuAction}
          onBack={handleBackFromMenu}
        />
      );
    case "browseUnmetRequirements":
      return (
        <SpecReviewBrowser
          unmetRequirements={state.unmetRequirements}
          prId={prId}
          bazRepoId={bazRepoId}
          onComplete={handleUnmetRequirementsComplete}
          onBack={handleBackFromUnmetRequirements}
        />
      );
    case "browseMetRequirements":
      return (
        <MetRequirementBrowser
          metRequirements={state.metRequirements}
          prId={prId}
          bazRepoId={bazRepoId}
          onComplete={handleMetRequirementsComplete}
          onBack={handleBackFromMetRequirements}
        />
      );
    case "showIssues":
      return (
        <IssueBrowser
          issues={issues.data}
          prId={prId}
          bazRepoId={bazRepoId}
          fullRepoName={fullRepoName}
          prNumber={prContext.prNumber}
          writeAccess={repoWriteAccess.data}
          onComplete={handleIssuesComplete}
          onBack={handleBackFromIssues}
        />
      );
    case "prWalkthrough":
      return (
        <PRWalkthrough
          prId={prId}
          bazRepoId={bazRepoId}
          fullRepoName={fullRepoName}
          prNumber={prContext.prNumber}
          onBack={handleBackFromPRWalkthrough}
        />
      );
    case "prChat":
      return (
        <PRChat
          prId={prId}
          bazRepoId={bazRepoId}
          fullRepoName={fullRepoName}
          prNumber={prContext.prNumber}
          chatInput={state.chatInput}
          onBack={handleBackFromPRChat}
        />
      );
    case "complete":
      return null;
  }
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
          Enter to continue - ESC to go back - Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestReview;

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
import NarratePR from "../pages/PRWalkthrough/NarratePR.js";
import { MAIN_COLOR } from "../theme/colors.js";
import { Requirement } from "../lib/clients/baz.js";

interface MenuStateData {
  unmetRequirements: Requirement[];
  metRequirements: Requirement[];
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
  | ({ step: "narratePR" } & MenuStateData)
  | { step: "complete" };

interface PullRequestReviewProps {
  prId: string;
  onComplete: () => void;
  onBack: () => void;
}

const PullRequestReview: React.FC<PullRequestReviewProps> = ({
  prId,
  onComplete,
  onBack,
}) => {
  const [state, setState] = useState<State>({ step: "prOverview" });

  const pr = usePullRequest(prId);
  const issues = useIssues(prId);
  const specReviews = useSpecReviews(prId);

  const loading = pr.loading || issues.loading || specReviews.loading;
  const error = pr.error || issues.error || specReviews.error;

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

  const repoId = pr.data.repository_id;

  // Get requirements from latest spec review
  const getRequirementsData = (): {
    unmetRequirements: Requirement[];
    metRequirements: Requirement[];
  } => {
    const latestSpecReview = specReviews.data.at(-1);

    if (!latestSpecReview) {
      return { unmetRequirements: [], metRequirements: [] };
    }

    return {
      unmetRequirements: latestSpecReview.requirements.filter(
        (req) => req.verdict !== "met",
      ),
      metRequirements: latestSpecReview.requirements.filter(
        (req) => req.verdict === "met",
      ),
    };
  };

  // Initial state for completed steps
  const initialCompletedSteps: CompletedSteps = {
    unmetRequirements: false,
    metRequirements: false,
    comments: false,
    narratePR: false,
  };

  // Handle prompt selection - check spec review status and go to menu
  const handlePrOverviewContinue = () => {
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

    if (!latestSpecReview) {
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
  const handleMenuAction = (action: ReviewMenuAction) => {
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
      case "narratePR":
        setState({
          ...state,
          step: "narratePR",
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

  // Handle back from narrate PR - go to menu and mark as complete (user interacted)
  const handleBackFromNarratePR = () => {
    if (state.step !== "narratePR") return;

    setState({
      step: "menu",
      unmetRequirements: state.unmetRequirements,
      metRequirements: state.metRequirements,
      completedSteps: {
        ...state.completedSteps,
        narratePR: true,
      },
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
          specReviews={specReviews.data}
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
          repoId={repoId}
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
          onComplete={handleUnmetRequirementsComplete}
          onBack={handleBackFromUnmetRequirements}
        />
      );
    case "browseMetRequirements":
      return (
        <MetRequirementBrowser
          metRequirements={state.metRequirements}
          onComplete={handleMetRequirementsComplete}
          onBack={handleBackFromMetRequirements}
        />
      );
    case "showIssues":
      return (
        <IssueBrowser
          issues={issues.data}
          prId={prId}
          repoId={repoId}
          onComplete={handleIssuesComplete}
          onBack={handleBackFromIssues}
        />
      );
    case "narratePR":
      return (
        <NarratePR
          prId={prId}
          repoId={repoId}
          onBack={handleBackFromNarratePR}
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

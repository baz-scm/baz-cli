import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import IssueBrowser from "./IssueBrowser.js";
import { usePullRequest } from "../hooks/usePullRequest.js";
import PullRequestOverviewSelect from "./PullRequestOverviewSelect.js";
import { useIssues } from "../hooks/useIssues.js";
import { useSpecReviews } from "../hooks/useSpecReviews.js";
import PullRequestOverview from "./PullRequestOverview.js";
import SpecReviewBrowser from "./SpecReviewBrowser.js";
import ReviewStatusPrompt, {
  ReviewStatusAction,
} from "./ReviewStatusPrompt.js";
import TriggerSpecReviewPrompt from "./TriggerSpecReviewPrompt.js";
import MetRequirementBrowser from "./MetRequirementBrowser.js";
import { MAIN_COLOR } from "../theme/colors.js";
import { Requirement } from "../lib/clients/baz.js";

type State =
  | { step: "prompt" }
  | { step: "specReviewInProgress" }
  | { step: "triggerSpecReview" }
  | { step: "browseUnmetRequirements"; unmetRequirements: Requirement[] }
  | {
      step: "reviewStatus";
      unmetRequirements: Requirement[];
      metRequirements: Requirement[];
      hasViewedUnmetRequirements: boolean;
    }
  | { step: "browseMetRequirements"; metRequirements: Requirement[] }
  | { step: "showIssues" }
  | { step: "complete" };

interface PullRequestReviewProps {
  repoId: string;
  prId: string;
  onComplete: () => void;
  onBack: () => void;
}

const PullRequestReview: React.FC<PullRequestReviewProps> = ({
  repoId,
  prId,
  onComplete,
  onBack,
}) => {
  const [state, setState] = useState<State>({ step: "prompt" });

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
        <Text color={MAIN_COLOR}> Fetching pull request details...</Text>
      </Box>
    );
  }

  if (error || !pr.data) {
    return (
      <StateMessage
        message={`❌ Error: ${error}`}
        color="red"
        bold
        onComplete={onComplete}
        onBack={onBack}
      />
    );
  }

  const handlePromptSelect = () => {
    const latestSpecReview = specReviews.data.at(-1);

    if (!latestSpecReview) {
      setState({ step: "triggerSpecReview" });
      return;
    }

    if (latestSpecReview.status === "in_progress") {
      setState({ step: "specReviewInProgress" });
      return;
    }

    if (latestSpecReview.status !== "done") {
      setState({ step: "triggerSpecReview" });
      return;
    }

    const result = latestSpecReview.result;
    if (!result) {
      setState({ step: "triggerSpecReview" });
      return;
    }

    const unmetRequirements = result.requirements.filter(
      (req) => req.verdict !== "met",
    );
    const metRequirements = result.requirements.filter(
      (req) => req.verdict === "met",
    );

    if (unmetRequirements.length > 0) {
      setState({
        step: "browseUnmetRequirements",
        unmetRequirements,
      });
    } else {
      setState({
        step: "reviewStatus",
        unmetRequirements: [],
        metRequirements,
        hasViewedUnmetRequirements: false,
      });
    }
  };

  const handleTriggerSpecReviewComplete = () => {
    if (issues.data.length > 0) {
      setState({ step: "showIssues" });
    } else {
      setState({ step: "complete" });
      onComplete();
    }
  };

  const handleUnmetRequirementsComplete = () => {
    if (state.step !== "browseUnmetRequirements") return;

    const latestSpecReview = specReviews.data.at(-1);
    const metRequirements =
      latestSpecReview?.result?.requirements.filter(
        (req) => req.verdict === "met",
      ) || [];

    setState({
      step: "reviewStatus",
      unmetRequirements: state.unmetRequirements,
      metRequirements,
      hasViewedUnmetRequirements: true,
    });
  };

  const handleReviewStatusAction = (action: ReviewStatusAction) => {
    if (state.step !== "reviewStatus") return;

    switch (action) {
      case "viewMetRequirements":
        setState({
          step: "browseMetRequirements",
          metRequirements: state.metRequirements,
        });
        break;
      case "viewComments":
        if (issues.data.length > 0) {
          setState({ step: "showIssues" });
        } else {
          setState({ step: "complete" });
          onComplete();
        }
        break;
      case "finish":
        setState({ step: "complete" });
        onComplete();
        break;
    }
  };

  const handleMetRequirementsComplete = () => {
    if (issues.data.length > 0) {
      setState({ step: "showIssues" });
    } else {
      setState({ step: "complete" });
      onComplete();
    }
  };

  const handleBackFromTriggerSpecReview = () => {
    setState({ step: "prompt" });
  };

  const handleBackFromUnmetRequirements = () => {
    setState({ step: "prompt" });
  };

  const handleBackFromReviewStatus = () => {
    if (state.step !== "reviewStatus") return;

    if (
      state.hasViewedUnmetRequirements &&
      state.unmetRequirements.length > 0
    ) {
      setState({
        step: "browseUnmetRequirements",
        unmetRequirements: state.unmetRequirements,
      });
    } else {
      setState({ step: "prompt" });
    }
  };

  const handleBackFromMetRequirements = () => {
    if (state.step !== "browseMetRequirements") return;

    const latestSpecReview = specReviews.data.at(-1);
    const unmetRequirements =
      latestSpecReview?.result?.requirements.filter(
        (req) => req.verdict !== "met",
      ) || [];

    setState({
      step: "reviewStatus",
      unmetRequirements,
      metRequirements: state.metRequirements,
      hasViewedUnmetRequirements: true,
    });
  };

  switch (state.step) {
    case "prompt":
      return (
        <PullRequestOverviewSelect
          pr={pr.data}
          issues={issues.data}
          specReviews={specReviews.data}
          onSelect={handlePromptSelect}
          onBack={onBack}
        />
      );
    case "specReviewInProgress":
      return (
        <StateMessage
          message="Spec review is currently in progress. Continuing to next step..."
          color="yellow"
          onComplete={handleTriggerSpecReviewComplete}
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
    case "browseUnmetRequirements":
      return (
        <SpecReviewBrowser
          unmetRequirements={state.unmetRequirements}
          onComplete={handleUnmetRequirementsComplete}
          onBack={handleBackFromUnmetRequirements}
        />
      );
    case "reviewStatus":
      return (
        <ReviewStatusPrompt
          unmetRequirementsCount={state.unmetRequirements.length}
          metRequirementsCount={state.metRequirements.length}
          unresolvedCommentsCount={issues.data.length}
          hasViewedUnmetRequirements={state.hasViewedUnmetRequirements}
          onSelect={handleReviewStatusAction}
          onBack={handleBackFromReviewStatus}
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
        <>
          <PullRequestOverview
            pr={pr.data}
            issues={issues.data}
            specReviews={specReviews.data}
          />

          <IssueBrowser
            issues={issues.data}
            prId={prId}
            repoId={repoId}
            onComplete={onComplete}
            onBack={onBack}
          />
        </>
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
          Enter to continue • ESC to go back • Ctrl+C to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default PullRequestReview;

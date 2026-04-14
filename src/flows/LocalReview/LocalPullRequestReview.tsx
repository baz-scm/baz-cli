import React, { useState, useCallback } from "react";
import ReviewMenu, {
  ReviewMenuAction,
  CompletedSteps,
} from "../Review/ReviewMenu.js";
import PRChat from "../../pages/PRChat/PRChat.js";
import { IssueType, CheckoutChatRequest } from "../../models/chat.js";

const LOCAL_WALKTHROUGH_PROMPT =
  "Please walk me through these changes. Start by showing me a very short description of what the changes do, followed by a brief summary of the sections. Do not include any section yet in your answer";

interface LocalPullRequestReviewProps {
  diffText: string;
  repoName: string;
  currentBranch: string | null;
  defaultBranch: string | null;
  onComplete: () => void;
  onBack: () => void;
}

type State =
  | ({ step: "menu" } & MenuStateData)
  | ({ step: "prWalkthrough" } & MenuStateData)
  | ({ step: "prChat" } & MenuStateData & { chatInput?: string })
  | { step: "complete" };

interface MenuStateData {
  completedSteps: CompletedSteps;
}

const LOCAL_PR_ID = "local";
const LOCAL_PR_NUMBER = 0;

const LocalPullRequestReview: React.FC<LocalPullRequestReviewProps> = ({
  diffText,
  repoName,
  currentBranch,
  defaultBranch,
  onComplete,
  onBack,
}) => {
  const initialCompletedSteps: CompletedSteps = {
    unmetRequirements: false,
    metRequirements: false,
    comments: false,
    prWalkthrough: false,
  };

  const [state, setState] = useState<State>({
    step: "menu",
    completedSteps: initialCompletedSteps,
  });

  const buildLocalChatRequest = useCallback(
    (freeText: string, conversationId?: string): CheckoutChatRequest => {
      return {
        mode: "local",
        repoName,
        diff: Buffer.from(diffText).toString("base64"),
        diffEncoding: "base64",
        issue: {
          type: IssueType.PR_WALKTHROUGH,
          data: { id: LOCAL_PR_ID },
        },
        freeText,
        conversationId,
      };
    },
    [repoName, diffText],
  );

  const handleMenuAction = (action: ReviewMenuAction, input?: string) => {
    if (state.step !== "menu") return;

    switch (action) {
      case "prWalkthrough":
        setState({ ...state, step: "prWalkthrough" });
        break;
      case "prChat":
        setState({ ...state, chatInput: input, step: "prChat" });
        break;
      case "finish":
        setState({ step: "complete" });
        onComplete();
        break;
    }
  };

  const handleBackFromWalkthrough = () => {
    if (state.step !== "prWalkthrough") return;
    setState({
      step: "menu",
      completedSteps: { ...state.completedSteps, prWalkthrough: true },
    });
  };

  const handleBackFromChat = () => {
    if (state.step !== "prChat") return;
    setState({ ...state, step: "menu" });
  };

  const handleBackFromMenu = () => {
    onBack();
  };

  switch (state.step) {
    case "menu":
      return (
        <ReviewMenu
          unmetRequirementsCount={0}
          metRequirementsCount={0}
          unresolvedCommentsCount={0}
          completedSteps={state.completedSteps}
          onSelect={handleMenuAction}
          onBack={handleBackFromMenu}
        />
      );
    case "prWalkthrough":
      return (
        <PRChat
          issueType={IssueType.PR_WALKTHROUGH}
          prId={LOCAL_PR_ID}
          fullRepoName={repoName}
          prNumber={LOCAL_PR_NUMBER}
          chatTitle={currentBranch ? `${currentBranch} vs ${defaultBranch}` : "Uncommitted Changes Walkthrough"}
          chatDescription={currentBranch ? `Walkthrough of changes on ${currentBranch} vs ${defaultBranch}. Press ESC to go back.` : "Walkthrough of uncommitted changes. Press ESC to go back."}
          chatInput={LOCAL_WALKTHROUGH_PROMPT}
          outputInitialMessage={false}
          buildChatRequestOverride={buildLocalChatRequest}
          onBack={handleBackFromWalkthrough}
        />
      );
    case "prChat":
      return (
        <PRChat
          issueType={IssueType.PR_CHAT}
          prId={LOCAL_PR_ID}
          fullRepoName={repoName}
          prNumber={LOCAL_PR_NUMBER}
          chatInput={state.chatInput}
          buildChatRequestOverride={buildLocalChatRequest}
          onBack={handleBackFromChat}
        />
      );
    case "complete":
      return null;
  }
};

export default LocalPullRequestReview;

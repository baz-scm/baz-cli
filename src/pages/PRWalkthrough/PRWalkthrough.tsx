import React from "react";
import PRChat from "../PRChat/PRChat.js";
import { IssueType } from "../../models/chat.js";

const INITIAL_PROMPT =
  "Please walk me through this pull request. Start by showing me a very short description on what the pull request do, followed by a brief summary of the sections. Do not include any section yet in your answer";

interface PRWalkthroughProps {
  prId: string;
  bazRepoId?: string;
  fullRepoName: string;
  prNumber: number;
  onBack: () => void;
}

const PRWalkthrough: React.FC<PRWalkthroughProps> = ({
  prId,
  bazRepoId,
  fullRepoName,
  prNumber,
  onBack,
}) => {
  return (
    <PRChat
      issueType={IssueType.PR_WALKTHROUGH}
      prId={prId}
      bazRepoId={bazRepoId}
      chatInput={INITIAL_PROMPT}
      fullRepoName={fullRepoName}
      prNumber={prNumber}
      chatTitle="PR Walkthrough"
      chatDescription="Walkthrough the pull request with Baz. Press ESC to go back."
      outputInitialMessage={false}
      onBack={onBack}
    />
  );
};

export default PRWalkthrough;

import React from "react";
import PRChat from "../PRChat/PRChat.js";

const INITIAL_PROMPT =
  "Please walk me through this pull request. Start by showing me a very short description on what the pull request do, followed by a brief summary of the sections. Do not include any section yet in your answer";

interface PRWalkthroughProps {
  prId: string;
  bazRepoId?: string;
  onBack: () => void;
}

const PRWalkthrough: React.FC<PRWalkthroughProps> = ({
  prId,
  bazRepoId,
  onBack,
}) => {
  return (
    <PRChat
      prId={prId}
      bazRepoId={bazRepoId}
      chatInput={INITIAL_PROMPT}
      chatTitle="PR Walkthrough"
      chatDescription="Walkthrough the pull request with Baz. Press ESC to go back."
      outputInitialMessage={false}
      onBack={onBack}
    />
  );
};

export default PRWalkthrough;

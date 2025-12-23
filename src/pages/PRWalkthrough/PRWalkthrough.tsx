import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import PRChat from "../PRChat/PRChat.js";
import {
  IssueType,
  ChatMessage,
  ensureMessageToolCallIds,
} from "../../models/chat.js";
import { useLatestConversation } from "../../hooks/useLatestConversation.js";
import { MAIN_COLOR } from "../../theme/colors.js";

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
  const session = useLatestConversation(prId, IssueType.PR_WALKTHROUGH);

  if (session.loading) {
    return (
      <Box>
        <Text color={MAIN_COLOR}>
          <Spinner type="dots" />
        </Text>
        <Text color={MAIN_COLOR}> Preparing PR walkthrough...</Text>
      </Box>
    );
  }

  const existingMessages = session.data?.messages.map(
    (msg: ChatMessage, index: number) => ensureMessageToolCallIds(msg, index),
  );

  return (
    <PRChat
      issueType={IssueType.PR_WALKTHROUGH}
      prId={prId}
      bazRepoId={bazRepoId}
      fullRepoName={fullRepoName}
      prNumber={prNumber}
      chatTitle="PR Walkthrough"
      chatDescription="Walkthrough the pull request with Baz. Press ESC to go back."
      chatInput={
        !(existingMessages && existingMessages.length > 0)
          ? INITIAL_PROMPT
          : undefined
      }
      outputInitialMessage={false}
      existingMessages={existingMessages}
      existingConversationId={session.data?.id}
      onBack={onBack}
    />
  );
};

export default PRWalkthrough;

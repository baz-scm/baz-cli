import React, { useState, useCallback, useMemo } from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../issues/types.js";
import { getIssueHandler } from "../issues/registry.js";
import ChatDisplay from "./ChatDisplay.js";
import { ChatMessage } from "../models/chat.js";
import { processStream } from "../lib/chat-stream.js";

interface IssueBrowserProps {
  issues: Issue[];
  prId: string;
  repoId: string;
  onComplete: () => void;
  onBack: () => void;
}

const IssueBrowser: React.FC<IssueBrowserProps> = ({
  issues,
  prId,
  repoId,
  onComplete,
  onBack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentIssue = issues[currentIndex];
  const hasNext = currentIndex < issues.length - 1;

  const handler = getIssueHandler(currentIssue.type);
  const ExplainComponent = handler.displayExplainComponent;
  const DisplayComponent = handler.displayComponent;

  const handleChatSubmit = useCallback(
    async (userInput: string) => {
      setChatMessages((prev) => [...prev, { role: "user", content: userInput }]);
      setIsLoading(true);

      try {
        await processStream(
          {
            repoId,
            prId,
            issue: {
              type: handler.getApiIssueType(currentIssue),
              data: { id: currentIssue.data.id },
            },
            freeText: userInput,
            conversationId,
          },
          {
            onConversationId: setConversationId,
            onFirstContent: () => setIsLoading(false),
            onUpdate: (content, toolCalls, isFirst) => {
              if (isFirst) {
                setChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content, toolCalls },
                ]);
              } else {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content,
                    toolCalls,
                  };
                  return updated;
                });
              }
            },
          },
        );
      } catch (error) {
        console.error("Failed to get chat response:", error);
        setIsLoading(false);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
    },
    [repoId, prId, handler, currentIssue, conversationId],
  );

  const context: IssueContext = useMemo(
    () => ({
      prId,
      repoId,
      currentIndex,
      totalIssues: issues.length,
      hasNext,
      conversationId,
      moveToNext: () => {
        if (hasNext) {
          setCurrentIndex((prev) => prev + 1);
          setConversationId(undefined);
          setChatMessages([]);
        } else {
          onComplete();
        }
      },
      complete: onComplete,
      setConversationId,
      onChatSubmit: handleChatSubmit,
    }),
    [
      prId,
      repoId,
      currentIndex,
      issues.length,
      hasNext,
      conversationId,
      onComplete,
      handleChatSubmit,
    ],
  );

  const handleSubmit = useCallback(
    async (message: string) => {
      if (message.startsWith("/")) {
        const spaceIndex = message.indexOf(" ");
        const command =
          spaceIndex === -1 ? message.slice(1) : message.slice(1, spaceIndex);
        const args = spaceIndex === -1 ? "" : message.slice(spaceIndex + 1);

        const result = await handler.handleCommand(
          command,
          args,
          currentIssue,
          context,
        );

        if (result.shouldMoveNext) {
          context.moveToNext();
        } else if (result.shouldComplete) {
          onComplete();
        }
        return;
      }

      await handleChatSubmit(message);
    },
    [handler, currentIssue, context, onComplete, handleChatSubmit],
  );

  const availableCommands = useMemo(
    () => handler.getCommands(currentIssue, context),
    [handler, currentIssue, context],
  );

  return (
    <Box flexDirection="column">
      <ExplainComponent issue={currentIssue} />

      <DisplayComponent issue={currentIssue} context={context} />

      <Box marginTop={1}>
        <ChatDisplay
          messages={chatMessages}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          availableCommands={availableCommands}
          prId={prId}
          enableMentions={currentIssue.type === "discussion"}
          onBack={onBack}
        />
      </Box>
    </Box>
  );
};

export default IssueBrowser;

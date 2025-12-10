import React, { useState, useCallback, useMemo } from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../issues/types.js";
import { getIssueHandler } from "../issues/registry.js";
import ChatDisplay from "./chat/ChatDisplay.js";
import { ChatMessage } from "../models/chat.js";
import { streamChatResponse } from "../lib/clients/baz.js";
import { RepoWriteAccess } from "../lib/providers/index.js";

interface IssueBrowserProps {
  issues: Issue[];
  prId: string;
  bazRepoId?: string;
  fullRepoName: string;
  prNumber: number;
  writeAccess: RepoWriteAccess;
  onComplete: () => void;
  onBack: () => void;
}

const IssueBrowser: React.FC<IssueBrowserProps> = ({
  issues,
  prId,
  bazRepoId,
  fullRepoName,
  prNumber,
  writeAccess,
  onComplete,
  onBack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [repoWriteAccess, setRepoWriteAccess] =
    useState<RepoWriteAccess>(writeAccess);
  const [isLoading, setIsLoading] = useState(false);

  const currentIssue = issues[currentIndex];
  const hasNext = currentIndex < issues.length - 1;

  const handler = getIssueHandler(currentIssue.type);
  const ExplainComponent = handler.displayExplainComponent;
  const DisplayComponent = handler.displayComponent;

  const handleChatSubmit = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
      };

      setChatMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
      };

      setChatMessages((prev) => [...prev, assistantMessage]);

      try {
        let accumulatedResponse = "";
        let firstChunk = true;

        for await (const chunk of streamChatResponse({
          repoId: bazRepoId ?? fullRepoName,
          prId,
          issue: {
            type: handler.getApiIssueType(currentIssue),
            data: {
              id: currentIssue.data.id,
            },
          },
          freeText: message,
          conversationId,
        })) {
          if (chunk.conversationId) {
            setConversationId(chunk.conversationId);
          }

          if (chunk.content) {
            if (firstChunk) {
              setIsLoading(false);
              firstChunk = false;
            }

            accumulatedResponse += chunk.content;

            setChatMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: accumulatedResponse,
              };
              return updated;
            });
          }
        }
      } catch (error) {
        console.error("Failed to get chat response:", error);
        setIsLoading(false);
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          };
          return updated;
        });
      }
    },
    [bazRepoId, fullRepoName, prId, handler, currentIssue, conversationId],
  );

  const context: IssueContext = useMemo(
    () => ({
      prId,
      fullRepoName,
      prNumber,
      currentIndex,
      totalIssues: issues.length,
      hasNext,
      conversationId,
      repoWriteAccess,
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
      setRepoWriteAccess,
      onChatSubmit: handleChatSubmit,
    }),
    [
      prId,
      fullRepoName,
      prNumber,
      currentIndex,
      issues.length,
      hasNext,
      conversationId,
      repoWriteAccess,
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

        if (result.errorMessage && result.errorMessage.length > 0) {
          const content = result.errorMessage;
          setChatMessages((prev) => {
            return [
              ...prev,
              {
                role: "error",
                content,
              },
            ];
          });
        } else if (result.shouldMoveNext) {
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
          fullRepoName={fullRepoName}
          prNumber={prNumber}
          enableMentions={currentIssue.type === "discussion"}
          onBack={onBack}
        />
      </Box>
    </Box>
  );
};

export default IssueBrowser;

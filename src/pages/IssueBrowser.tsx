import React, { useState, useCallback, useMemo, useRef } from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../issues/types.js";
import { getIssueHandler } from "../issues/registry.js";
import ChatDisplay from "./chat/ChatDisplay.js";
import {
  ChatMessage,
  CheckoutChatRequest,
  IssueType,
  toTokensDiscussion,
} from "../models/chat.js";
import type { Discussion } from "../lib/providers/types.js";
import { RepoWriteAccess } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/index.js";
import { processStream, StreamAbortError } from "../lib/chat-stream.js";

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
  const [isResponseActive, setIsResponseActive] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const appMode = useAppMode();

  const currentIssue = issues[currentIndex];
  const hasNext = currentIndex < issues.length - 1;

  const handler = getIssueHandler(currentIssue.type);
  const ExplainComponent = handler.displayExplainComponent;
  const DisplayComponent = handler.displayComponent;

  const buildChatRequest = useCallback(
    async (
      message: string,
      issue: Issue,
      convId?: string,
    ): Promise<CheckoutChatRequest> => {
      const issueType = handler.getApiIssueType(issue);
      const prContext = { prId, fullRepoName, prNumber };

      if (appMode.mode.name === "baz" && bazRepoId) {
        return {
          mode: "baz",
          repoId: bazRepoId,
          prId,
          issue: {
            type: issueType,
            data: { id: issue.data.id },
          },
          freeText: message,
          conversationId: convId,
        };
      }

      if (issue.type === "discussion") {
        const discussion = issue.data as Discussion;
        const files = discussion.file ? [discussion.file] : [];

        const diffData = await appMode.mode.dataProvider.fetchFileDiffs(
          prContext,
          discussion.commit_sha,
          files,
        );

        const tokensDiscussion = toTokensDiscussion(discussion);

        return {
          mode: "tokens",
          prContext,
          issue: {
            type: IssueType.DISCUSSION,
            data: {
              id: discussion.id,
              discussion: tokensDiscussion,
              diff: diffData,
            },
          },
          freeText: message,
          conversationId: convId,
        };
      }

      return {
        mode: "tokens",
        prContext,
        issue: {
          type: IssueType.PR_CHAT,
          data: { id: issue.data.id },
        },
        freeText: message,
        conversationId: convId,
      };
    },
    [appMode.mode, bazRepoId, prId, fullRepoName, prNumber, handler],
  );

  const handleChatSubmit = useCallback(
    async (message: string) => {
      setChatMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsLoading(true);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsResponseActive(true);

      try {
        const request = await buildChatRequest(
          message,
          currentIssue,
          conversationId,
        );

        await processStream(
          request,
          {
            onConversationId: setConversationId,
            onFirstTextContent: () => setIsLoading(false),
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
            onAbort: () => {
              setIsLoading(false);
              setIsResponseActive(false);
            },
          },
          abortController.signal,
        );
      } catch (error) {
        if (error instanceof StreamAbortError) {
          // User aborted - clear partial response
          setChatMessages((prev) => {
            const updated = [...prev];
            if (
              updated.length > 0 &&
              updated[updated.length - 1].role === "assistant"
            ) {
              updated.pop();
            }
            return updated;
          });
          return;
        }
        console.error("Failed to get chat response:", error);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      } finally {
        setIsResponseActive(false);
        abortControllerRef.current = null;
      }
    },
    [buildChatRequest, currentIssue, conversationId],
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
      appMode,
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
      appMode,
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

  const handleInterrupt = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

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
          onInterrupt={handleInterrupt}
          isResponseActive={isResponseActive}
        />
      </Box>
    </Box>
  );
};

export default IssueBrowser;

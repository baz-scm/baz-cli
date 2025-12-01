import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../issues/types.js";
import { getIssueHandler } from "../issues/registry.js";
import ChatDisplay from "./ChatDisplay.js";
import { ChatMessage } from "../models/chat.js";
import { streamChatResponse } from "../lib/clients/baz.js";

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

  const handler = useMemo(() => getIssueHandler(currentIssue.type), [currentIssue.type]);
  const ExplainComponent = handler.displayExplainComponent;
  const DisplayComponent = handler.displayComponent;

  const handleChatSubmit = useCallback(async (message: string) => {
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
        repoId,
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
  }, [repoId, prId, handler, currentIssue.type, currentIssue.data.id, conversationId]);

  const moveToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex((prev) => prev + 1);
      setConversationId(undefined);
      setChatMessages([]);
    } else {
      onComplete();
    }
  }, [hasNext, onComplete]);

  // Use refs to break circular dependencies
  const contextRef = useRef<IssueContext | null>(null);
  const handleSubmitRef = useRef<((message: string) => Promise<void>) | null>(null);

  const context: IssueContext = useMemo(() => ({
    prId,
    repoId,
    currentIndex,
    totalIssues: issues.length,
    hasNext,
    conversationId,
    moveToNext,
    complete: onComplete,
    setConversationId,
    onChatSubmit: handleChatSubmit,
  }), [prId, repoId, currentIndex, issues.length, hasNext, conversationId, moveToNext, onComplete, handleChatSubmit]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const handleSubmit = useCallback(async (message: string) => {
    if (message.startsWith("/")) {
      const spaceIndex = message.indexOf(" ");
      const command =
          spaceIndex === -1 ? message.slice(1) : message.slice(1, spaceIndex);
      const args = spaceIndex === -1 ? "" : message.slice(spaceIndex + 1);

      // Use current values from ref
      if (!contextRef.current) return;

      const result = await handler.handleCommand(
          command,
          args,
          issues[currentIndex],
          contextRef.current,
      );

      if (result.shouldMoveNext) {
        moveToNext();
      } else if (result.shouldComplete) {
        onComplete();
      }
      return;
    }

    await handleChatSubmit(message);
  }, [handler, issues, currentIndex, moveToNext, onComplete, handleChatSubmit]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Stable callback that never changes reference
  const stableHandleSubmit = useCallback(async (message: string) => {
    if (handleSubmitRef.current) {
      return handleSubmitRef.current(message);
    }
  }, []);

  const availableCommands = useMemo(
    () => handler.getCommands(issues[currentIndex], contextRef.current || context),
    [handler, issues, currentIndex]
  );

  return (
    <Box flexDirection="column">
      <ExplainComponent issue={currentIssue} />

      <DisplayComponent issue={currentIssue} context={context} />

      <Box marginTop={1}>
        <ChatDisplay
          messages={chatMessages}
          isLoading={isLoading}
          onSubmit={stableHandleSubmit}
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

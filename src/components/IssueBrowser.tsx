import React, { useState } from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../issues/types";
import { getIssueHandler } from "../issues/registry";
import ChatDisplay from "./ChatDisplay";
import { ChatMessage } from "../models/chat";
import { streamChatResponse } from "../lib/clients/baz";
import { IssueType } from "../models/chat";

interface IssueBrowserProps {
  issues: Issue[];
  prId: string;
  repoId: string;
  onComplete: () => void;
}

const IssueBrowser: React.FC<IssueBrowserProps> = ({
  issues,
  prId,
  repoId,
  onComplete,
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

  const handleChatSubmit = async (message: string) => {
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
          type: IssueType.DISCUSSION,
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
  };

  const handleSubmit = async (message: string) => {
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
  };

  const context: IssueContext = {
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
  };

  const availableCommands = handler.getCommands(currentIssue, context);

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
        />
      </Box>
    </Box>
  );
};

export default IssueBrowser;

import React, { useState } from "react";
import { Box, Text } from "ink";
import { Requirement } from "../../lib/clients/baz.js";
import { MAIN_COLOR } from "../../theme/colors.js";
import { renderMarkdown } from "../../lib/markdown.js";
import ChatDisplay from "../chat/ChatDisplay.js";
import { ChatMessage, IssueType } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import { processStream } from "../../lib/chat-stream.js";

interface SpecReviewBrowserProps {
  unmetRequirements: Requirement[];
  prId: string;
  repoId: string;
  onComplete: () => void;
  onBack: () => void;
}

type ViewState = "requirement" | "evidence";

const SpecReviewBrowser: React.FC<SpecReviewBrowserProps> = ({
  unmetRequirements,
  prId,
  repoId,
  onComplete,
  onBack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("requirement");
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentRequirement = unmetRequirements[currentIndex];

  // Guard against invalid state after completion
  if (!currentRequirement) {
    return null;
  }

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
      await processStream(
        {
          repoId,
          prId,
          issue: {
            type: IssueType.SPEC_REVIEW,
            data: {
              id: currentRequirement.id,
            },
          },
          freeText: message,
          conversationId,
        },
        {
          onConversationId: (id) => setConversationId(id),
          onFirstTextContent: () => setIsLoading(false),
          onUpdate: (content, toolCalls) => {
            setChatMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              };
              return updated;
            });
          },
        },
      );
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

  const handleNext = () => {
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;
      if (nextIndex < unmetRequirements.length) {
        // Move to next requirement
        setViewState("requirement");
        setConversationId(undefined);
        setChatMessages([]);
        return nextIndex;
      } else {
        // No more requirements, complete the review
        onComplete();
        return prev;
      }
    });
  };

  const handleExplain = () => {
    setViewState("evidence");
  };

  const handleSubmit = async (message: string) => {
    if (message.startsWith("/")) {
      const spaceIndex = message.indexOf(" ");
      const command =
        spaceIndex === -1 ? message.slice(1) : message.slice(1, spaceIndex);

      if (command === "next") {
        handleNext();
        return;
      } else if (command === "explain") {
        handleExplain();
        return;
      }
    }

    await handleChatSubmit(message);
  };

  const availableCommands: IssueCommand[] = [
    {
      command: "next",
      description:
        currentIndex + 1 >= unmetRequirements.length
          ? "Complete requirement review"
          : "Move to next requirement",
    },
    {
      command: "explain",
      description: "Show evidence for this requirement",
    },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          Unmet requirement ({currentIndex + 1}/{unmetRequirements.length})
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Requirement:</Text>
        <Text>{currentRequirement.title}</Text>
      </Box>

      {currentRequirement.description && (
        <Box marginBottom={1} flexDirection="column">
          <Text bold>Description:</Text>
          <Text>{currentRequirement.description}</Text>
        </Box>
      )}

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Verdict:</Text>
        <Text color="red">{currentRequirement.verdict}</Text>
        {currentRequirement.verdict_explanation && (
          <Text>{renderMarkdown(currentRequirement.verdict_explanation)}</Text>
        )}
      </Box>

      {viewState === "evidence" && (
        <Box marginBottom={1} flexDirection="column">
          <Text bold>Evidence:</Text>
          <Text>{currentRequirement.evidence}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <ChatDisplay
          messages={chatMessages}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          availableCommands={availableCommands}
          prId={prId}
          enableMentions={false}
          onBack={onBack}
          placeholder="Ask about this requirement..."
        />
      </Box>
    </Box>
  );
};

export default SpecReviewBrowser;

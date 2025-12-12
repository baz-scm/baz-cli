import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import ChatDisplay from "../chat/ChatDisplay.js";
import { ChatMessage, IssueType } from "../../models/chat.js";
import { processStream } from "../../lib/chat-stream.js";
import { MAIN_COLOR } from "../../theme/colors.js";

interface PRChatProps {
  prId: string;
  bazRepoId?: string;
  chatInput?: string;
  chatTitle?: string;
  chatDescription?: string;
  onBack: () => void;
}

const PRChat: React.FC<PRChatProps> = ({
  prId,
  bazRepoId,
  chatInput,
  chatTitle,
  chatDescription,
  onBack,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Send initial message on mount
  useEffect(() => {
    if (!chatInput) {
      setIsLoading(false);
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const sendInitialMessage = async () => {
      if (!bazRepoId) {
        setIsLoading(false);
        setChatMessages([
          {
            role: "assistant",
            content:
              "Repository ID not available. Chat is not available in this mode.",
          },
        ]);
        return;
      }

      try {
        await processStream(
          {
            repoId: bazRepoId,
            prId,
            issue: { type: IssueType.PULL_REQUEST, data: { id: prId } },
            freeText: chatInput,
            conversationId: undefined,
          },
          {
            onConversationId: setConversationId,
            onFirstTextContent: () => setIsLoading(false),
            onUpdate: (content, toolCalls, isFirst) => {
              if (isFirst) {
                setChatMessages([{ role: "assistant", content, toolCalls }]);
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
        console.error("Failed to get initial chat response:", error);
        setIsLoading(false);
        setChatMessages([
          {
            role: "assistant",
            content:
              "Sorry, I encountered an error loading the initial chat response. Please try asking again.",
          },
        ]);
      }
    };

    sendInitialMessage();
  }, [prId, bazRepoId]);

  const handleChatSubmit = useCallback(
    async (userInput: string) => {
      if (!bazRepoId) {
        setChatMessages((prev) => [
          ...prev,
          { role: "user", content: userInput },
          {
            role: "assistant",
            content:
              "Repository ID not available. Chat is not available in this mode.",
          },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: userInput },
      ]);
      setIsLoading(true);

      try {
        await processStream(
          {
            repoId: bazRepoId,
            prId,
            issue: { type: IssueType.PULL_REQUEST, data: { id: prId } },
            freeText: userInput,
            conversationId,
          },
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
    [prId, bazRepoId, conversationId],
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          {chatTitle ? chatTitle : "PR Chat"}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {chatDescription
            ? chatDescription
            : "Chat about the pull request with Baz. Press ESC to go back."}
        </Text>
      </Box>

      <ChatDisplay
        messages={chatMessages}
        isLoading={isLoading}
        onSubmit={handleChatSubmit}
        placeholder="Explain the changes in this PR"
        prId={prId}
        enableMentions={false}
        onBack={onBack}
      />
    </Box>
  );
};

export default PRChat;

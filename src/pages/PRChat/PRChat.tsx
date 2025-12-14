import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import ChatDisplay from "../chat/ChatDisplay.js";
import {
  ChatMessage,
  IssueType,
  CheckoutChatRequest,
} from "../../models/chat.js";
import { processStream } from "../../lib/chat-stream.js";
import { MAIN_COLOR } from "../../theme/colors.js";
import { useAppMode } from "../../lib/config/AppModeContext.js";

interface PRChatProps {
  prId: string;
  bazRepoId?: string;
  fullRepoName: string;
  prNumber: number;
  chatInput?: string;
  chatTitle?: string;
  chatDescription?: string;
  outputInitialMessage?: boolean;
  onBack: () => void;
}

const PRChat: React.FC<PRChatProps> = ({
  prId,
  bazRepoId,
  fullRepoName,
  prNumber,
  chatInput,
  chatTitle,
  chatDescription,
  outputInitialMessage = true,
  onBack,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const appMode = useAppMode();

  const buildChatRequest = useCallback(
    (freeText: string, convId?: string): CheckoutChatRequest => {
      const issue = {
        type: IssueType.PULL_REQUEST,
        data: { id: prId },
      } as const;

      if (appMode.mode.name === "baz" && bazRepoId) {
        return {
          mode: "baz",
          repoId: bazRepoId,
          prId,
          issue,
          freeText,
          conversationId: convId,
        };
      }

      return {
        mode: "tokens",
        prContext: { prId, fullRepoName, prNumber },
        issue,
        freeText,
        conversationId: convId,
      };
    },
    [appMode.mode.name, bazRepoId, prId, fullRepoName, prNumber],
  );

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const sendInitialMessage = async () => {
      if (!chatInput) {
        setIsLoading(false);
        return;
      }

      if (outputInitialMessage && chatInput) {
        setChatMessages([{ role: "user", content: chatInput }]);
      }

      try {
        await processStream(buildChatRequest(chatInput, undefined), {
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
        });
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
  }, [buildChatRequest, chatInput, outputInitialMessage]);

  const handleChatSubmit = useCallback(
    async (userInput: string) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: userInput },
      ]);
      setIsLoading(true);

      try {
        await processStream(buildChatRequest(userInput, conversationId), {
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
        });
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
    [buildChatRequest, conversationId],
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

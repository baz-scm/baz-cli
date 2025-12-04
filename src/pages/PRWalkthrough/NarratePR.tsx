import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import ChatDisplay from "./ChatDisplay.js";
import { ChatMessage, IssueType } from "../../models/chat.js";
import { streamChatResponse } from "../../lib/clients/baz.js";
import { MAIN_COLOR } from "../../theme/colors.js";

const INITIAL_PROMPT =
  "Please walk me through this pull request. Start by showing me a very short description on what the pull request do, followed by a brief summary of the sections. Do not include any section yet in your answer";

interface NarratePRProps {
  prId: string;
  repoId: string;
  onBack: () => void;
}

const NarratePR: React.FC<NarratePRProps> = ({ prId, repoId, onBack }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Send initial message on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const sendInitialMessage = async () => {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
      };
      setChatMessages([assistantMessage]);

      try {
        let accumulatedResponse = "";
        let firstChunk = true;

        for await (const chunk of streamChatResponse({
          repoId,
          prId,
          issue: {
            type: IssueType.PULL_REQUEST,
            data: {
              id: prId,
            },
          },
          freeText: INITIAL_PROMPT,
          conversationId: undefined,
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

            setChatMessages([
              {
                role: "assistant",
                content: accumulatedResponse,
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to get initial chat response:", error);
        setIsLoading(false);
        setChatMessages([
          {
            role: "assistant",
            content:
              "Sorry, I encountered an error loading the PR walkthrough. Please try asking a question.",
          },
        ]);
      }
    };

    sendInitialMessage();
  }, [prId, repoId]);

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
          repoId,
          prId,
          issue: {
            type: IssueType.PULL_REQUEST,
            data: {
              id: prId,
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
    [prId, repoId, conversationId],
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          Narrate change request
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          Walkthrough the pull request with Baz. Press ESC to go back.
        </Text>
      </Box>

      <ChatDisplay
        messages={chatMessages}
        isLoading={isLoading}
        onSubmit={handleChatSubmit}
        placeholder="Explain me about the pull request"
        prId={prId}
        enableMentions={false}
        onBack={onBack}
      />
    </Box>
  );
};

export default NarratePR;

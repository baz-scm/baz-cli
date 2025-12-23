import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import ChatDisplay from "../chat/ChatDisplay.js";
import {
  ChatMessage,
  IssueType,
  CheckoutChatRequest,
} from "../../models/chat.js";
import { processStream, StreamAbortError } from "../../lib/chat-stream.js";
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
  issueType: IssueType.PR_CHAT | IssueType.PR_WALKTHROUGH;
  existingMessages?: ChatMessage[];
  existingConversationId?: string;
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
  issueType,
  existingMessages,
  existingConversationId,
  onBack,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(
    existingConversationId,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    existingMessages || [],
  );
  const [isLoading, setIsLoading] = useState(!existingMessages);
  const [isResponseActive, setIsResponseActive] = useState(false);

  const hasInitialized = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const appMode = useAppMode();

  const buildChatRequest = useCallback(
    (freeText: string, convId?: string): CheckoutChatRequest => {
      const issue = {
        type: issueType,
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

  const runChatStream = useCallback(
    async (
      request: CheckoutChatRequest,
      options: { appendAssistantMessage: boolean },
    ) => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsLoading(true);
      setIsResponseActive(true);

      try {
        await processStream(
          request,
          {
            onConversationId: setConversationId,
            onFirstTextContent: () => setIsLoading(false),
            onUpdate: (content, toolCalls, isFirst) => {
              if (isFirst) {
                if (options.appendAssistantMessage) {
                  setChatMessages((prev) => [
                    ...prev,
                    { role: "assistant", content, toolCalls },
                  ]);
                } else {
                  setChatMessages([{ role: "assistant", content, toolCalls }]);
                }
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

        setIsResponseActive(false);
        abortControllerRef.current = null;
      } catch (error) {
        if (error instanceof StreamAbortError) {
          // Remove partial assistant message
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
          setIsLoading(false);
          setIsResponseActive(false);
          abortControllerRef.current = null;
          return;
        }

        console.error(
          options.appendAssistantMessage
            ? "Failed to get chat response:"
            : "Failed to get initial chat response:",
          error,
        );
        setIsLoading(false);
        setIsResponseActive(false);
        abortControllerRef.current = null;

        setChatMessages((prev) => {
          const updated = [...prev];
          updated.push({
            role: "assistant",
            content: options.appendAssistantMessage
              ? "Sorry, I encountered an error. Please try again."
              : "Sorry, I encountered an error loading the initial chat response. Please try asking again.",
          });
          return updated;
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // If existing messages are provided, skip sending initial message
    if (existingMessages) {
      return;
    }

    const sendInitialMessage = async () => {
      if (!chatInput) {
        setIsLoading(false);
        return;
      }

      if (outputInitialMessage) {
        setChatMessages([{ role: "user", content: chatInput }]);
      }

      await runChatStream(buildChatRequest(chatInput, undefined), {
        appendAssistantMessage: false,
      });
    };

    sendInitialMessage();
  }, [
    buildChatRequest,
    chatInput,
    outputInitialMessage,
    existingMessages,
    runChatStream,
  ]);

  const handleChatSubmit = useCallback(
    async (userInput: string) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: userInput },
      ]);

      await runChatStream(buildChatRequest(userInput, conversationId), {
        appendAssistantMessage: true,
      });
    },
    [buildChatRequest, conversationId, runChatStream],
  );

  const handleInterrupt = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          {chatTitle ?? "PR Chat"}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          {chatDescription ??
            "Chat about the pull request with Baz. Press ESC to go back."}
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
        onInterrupt={handleInterrupt}
        isResponseActive={isResponseActive}
      />
    </Box>
  );
};

export default PRChat;

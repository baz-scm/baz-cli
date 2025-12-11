import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import { ChatMessage } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import { renderMarkdown } from "../../lib/markdown.js";
import ChatInput from "./ChatInput.js";
import ToolCallDisplay from "./ToolCallDisplay.js";

const MemoizedMessageAuthor = memo(({ message }: { message: ChatMessage }) => {
  switch (message.role) {
    case "user":
      return (
        <Text bold color="cyan">
          You:
        </Text>
      );
    case "assistant":
      return (
        <Text bold color="yellow">
          Baz:
        </Text>
      );
    case "error":
      return (
        <Text bold color="red">
          Error:
        </Text>
      );
  }
});

interface MemoizedMessageProps {
  message: ChatMessage;
  isToolExpanded: boolean;
  showExpandHint: boolean;
}

const MemoizedMessage = memo<MemoizedMessageProps>(
  ({ message, isToolExpanded, showExpandHint }) => {
    const renderedContent = useMemo(
      () => renderMarkdown(message.content),
      [message.content],
    );

    return (
      <Box flexDirection="column" marginBottom={1}>
        <MemoizedMessageAuthor message={message} />
        <Box paddingLeft={2} flexDirection="column">
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Box flexDirection="column">
              {message.toolCalls.map((toolCall) => (
                <ToolCallDisplay
                  key={toolCall.id}
                  toolCall={toolCall}
                  isExpanded={isToolExpanded}
                  showExpandHint={showExpandHint}
                />
              ))}
            </Box>
          )}
          {message.content && <Text>{renderedContent}</Text>}
        </Box>
      </Box>
    );
  },
  (prevProps, nextProps) => {
    if (
      prevProps.message.content !== nextProps.message.content ||
      prevProps.message.role !== nextProps.message.role ||
      prevProps.isToolExpanded !== nextProps.isToolExpanded ||
      prevProps.showExpandHint !== nextProps.showExpandHint
    ) {
      return false;
    }

    // Check tool calls
    const prevToolCalls = prevProps.message.toolCalls;
    const nextToolCalls = nextProps.message.toolCalls;

    if (prevToolCalls?.length !== nextToolCalls?.length) {
      return false;
    }

    if (prevToolCalls && nextToolCalls) {
      for (let i = 0; i < prevToolCalls.length; i++) {
        const prev = prevToolCalls[i];
        const next = nextToolCalls[i];
        if (
          prev.id !== next.id ||
          prev.message !== next.message ||
          prev.result !== next.result
        ) {
          return false;
        }
      }
    }

    return true;
  },
);

interface ChatDisplayProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSubmit: (message: string) => void;
  placeholder?: string;
  availableCommands?: IssueCommand[];
  disabled?: boolean;
  prId?: string;
  fullRepoName?: string;
  prNumber?: number;
  enableMentions?: boolean;
  onBack: () => void;
  // onToggleToolCallExpansion?: (toolCallId: string) => void;
}

const ChatDisplay = memo<ChatDisplayProps>(
  ({
    messages,
    isLoading,
    onSubmit,
    placeholder = "How will it affect the code?",
    availableCommands = [],
    disabled = false,
    prId,
    fullRepoName,
    prNumber,
    enableMentions = false,
    onBack,
    // onToggleToolCallExpansion,
  }) => {
    const { stdout } = useStdout();
    const [terminalWidth, setTerminalWidth] = useState(stdout?.columns || 80);
    const [toolsExpanded, setToolsExpanded] = useState(false);

    // Get tool calls from the latest assistant message only
    const latestAssistantMessage = useMemo(() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          return messages[i];
        }
      }
      return null;
    }, [messages]);

    const activeToolCalls = latestAssistantMessage?.toolCalls ?? [];
    const hasPendingToolCalls = activeToolCalls.some((tc) => !tc.result);

    useEffect(() => {
      const handleResize = () => {
        if (stdout?.columns) {
          setTerminalWidth(stdout.columns);
        }
      };

      if (stdout) {
        stdout.on("resize", handleResize);

        return () => {
          stdout.off("resize", handleResize);
        };
      }
    }, [stdout]);

    const onToggleToolCallExpansion = useCallback(() => {
      setToolsExpanded((prev) => !prev);
    }, []);

    const handleSubmit = useCallback(
      (message: string) => {
        setToolsExpanded(false); // Collapse tools when submitting new question
        onSubmit(message);
      },
      [onSubmit],
    );

    return (
      <Box flexDirection="column">
        {messages.length > 0 && (
          <Box flexDirection="column" marginBottom={0}>
            {messages.map((message, index) => (
              <MemoizedMessage
                key={index}
                message={message}
                isToolExpanded={toolsExpanded}
                showExpandHint={!isLoading && !hasPendingToolCalls}
              />
            ))}
          </Box>
        )}

        {(isLoading || hasPendingToolCalls) && (
          <Box marginBottom={1}>
            <Text color="magenta">
              <Spinner type="dots" />
            </Text>
            <Text color="magenta"> Thinking...</Text>
          </Box>
        )}

        {!disabled && !isLoading && !hasPendingToolCalls && (
          <ChatInput
            onSubmit={handleSubmit}
            placeholder={placeholder}
            availableCommands={availableCommands}
            enableMentions={enableMentions}
            prId={prId}
            fullRepoName={fullRepoName}
            prNumber={prNumber}
            onBack={onBack}
            terminalWidth={terminalWidth}
            onToggleToolCallExpansion={onToggleToolCallExpansion}
            toolsExist={activeToolCalls.length > 0}
          />
        )}
      </Box>
    );
  },
);

export default ChatDisplay;

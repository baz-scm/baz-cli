import React, { useState, useEffect, useMemo, memo } from "react";
import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import { ChatMessage } from "../models/chat.js";
import { IssueCommand } from "../issues/types.js";
import { renderMarkdown } from "../lib/markdown.js";
import ChatInput from "./ChatInput.js";

const MemoizedMessage = memo<{ message: ChatMessage }>(
  ({ message }) => {
    const renderedContent = useMemo(
      () => renderMarkdown(message.content),
      [message.content],
    );

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={message.role === "user" ? "cyan" : "yellow"}>
          {message.role === "user" ? "You:" : "Baz:"}
        </Text>
        <Box paddingLeft={2}>
          <Text>{renderedContent}</Text>
        </Box>
      </Box>
    );
  },
  (prevProps, nextProps) =>
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.role === nextProps.message.role,
);

interface ChatDisplayProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSubmit: (message: string) => void;
  placeholder?: string;
  availableCommands?: IssueCommand[];
  disabled?: boolean;
  prId?: string;
  enableMentions?: boolean;
  onBack: () => void;
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
    enableMentions = false,
    onBack,
  }) => {
    const { stdout } = useStdout();
    const [terminalWidth, setTerminalWidth] = useState(stdout?.columns || 80);

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

    return (
      <Box flexDirection="column">
        {messages.length > 0 && (
          <Box flexDirection="column" marginBottom={0}>
            {messages.map((message, index) => (
              <MemoizedMessage key={index} message={message} />
            ))}
          </Box>
        )}

        {isLoading && (
          <Box marginBottom={1}>
            <Text color="magenta">
              <Spinner type="dots" />
            </Text>
            <Text color="magenta"> Thinking...</Text>
          </Box>
        )}

        {!disabled && !isLoading && (
          <ChatInput
            onSubmit={onSubmit}
            placeholder={placeholder}
            availableCommands={availableCommands}
            enableMentions={enableMentions}
            prId={prId}
            onBack={onBack}
            terminalWidth={terminalWidth}
          />
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Don't re-render if only the messages array reference changed
    // but the actual message contents are the same
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false; // Re-render if message count changed
    }

    // Check if any message content actually changed
    for (let i = 0; i < prevProps.messages.length; i++) {
      if (
        prevProps.messages[i].content !== nextProps.messages[i].content ||
        prevProps.messages[i].role !== nextProps.messages[i].role
      ) {
        return false; // Re-render if message content changed
      }
    }

    // Check other props
    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.prId === nextProps.prId &&
      prevProps.enableMentions === nextProps.enableMentions &&
      prevProps.availableCommands?.length ===
        nextProps.availableCommands?.length
      // Intentionally skip onSubmit and onBack as they change on every render
      // but don't affect the visual output when input isn't shown
    );
  },
);

export default ChatDisplay;

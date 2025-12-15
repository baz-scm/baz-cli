import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import { ChatMessage } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import { renderMarkdown } from "../../lib/markdown.js";
import ChatInput from "./ChatInput.js";
import ToolCallDisplay from "./ToolCallDisplay.js";

const MessageAuthor = memo(({ role }: { role: ChatMessage["role"] }) => {
  if (role === "user") return <Text bold color="cyan">You:</Text>;
  if (role === "assistant") return <Text bold color="yellow">Baz:</Text>;
  return <Text bold color="red">Error:</Text>;
});

const MessageRow = memo(
  ({
    message,
    isToolExpanded,
    showExpandHint,
  }: {
    message: ChatMessage;
    isToolExpanded: boolean;
    showExpandHint: boolean;
  }) => {
    // Split content into lines
    const lines = useMemo(() => {
      if (!message.content) return [];
      return renderMarkdown(message.content)
        .split("\n")
        .map((line, i) => ({ line, key: i }));
    }, [message.content]);

    return (
      <Box flexDirection="column" marginBottom={1}>
        <MessageAuthor role={message.role} />
        <Box paddingLeft={2} flexDirection="column">
          {message.toolCalls?.map((toolCall) => (
            <ToolCallDisplay
              key={toolCall.id}
              toolCall={toolCall}
              isExpanded={isToolExpanded}
              showExpandHint={showExpandHint}
            />
          ))}
          {lines.map(({ line, key }) => (
            <Text key={key}>{line}</Text>
          ))}
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
  }) => {
    const { stdout } = useStdout();
    const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);
    const [toolsExpanded, setToolsExpanded] = useState(false);

    useEffect(() => {
      if (!stdout) return;
      const onResize = () => {
        setTerminalWidth(stdout.columns ?? 80);
      };
      stdout.on("resize", onResize);
      return () => {
        stdout.off("resize", onResize);
      };
    }, [stdout]);

    /* tool calls */
    const latestAssistant = useMemo(() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") return messages[i];
      }
      return null;
    }, [messages]);

    const activeToolCalls = latestAssistant?.toolCalls ?? [];
    const hasPendingToolCalls = activeToolCalls.some((t) => !t.result);

    const toggleTools = useCallback(() => {
      setToolsExpanded((v) => !v);
    }, []);

    const handleSubmit = useCallback(
      (value: string) => {
        setToolsExpanded(false);
        onSubmit(value);
      },
      [onSubmit],
    );

    return (
      <Box flexDirection="column">
        <Box flexDirection="column">
          {messages.map((msg, i) => (
            <MessageRow
              key={i}
              message={msg}
              isToolExpanded={toolsExpanded}
              showExpandHint={!isLoading && !hasPendingToolCalls}
            />
          ))}
        </Box>

        {(isLoading || hasPendingToolCalls) && (
          <Box marginBottom={1}>
            <Text color="magenta">
              <Spinner type="dots" /> Thinking...
            </Text>
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
            toolsExist={activeToolCalls.length > 0}
            onToggleToolCallExpansion={toggleTools}
          />
        )}
      </Box>
    );
  },
);

export default ChatDisplay;

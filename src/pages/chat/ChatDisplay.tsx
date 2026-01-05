import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Box, Text, useStdout, useInput } from "ink";
import Spinner from "ink-spinner";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import { ChatMessage } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import { renderMarkdown } from "../../lib/markdown.js";
import ChatInput from "./ChatInput.js";
import ToolCallDisplay from "./ToolCallDisplay.js";

const MessageAuthor = memo(({ role }: { role: ChatMessage["role"] }) => {
  if (role === "user")
    return (
      <Text bold color="cyan">
        You:
      </Text>
    );
  if (role === "assistant")
    return (
      <Text bold color="yellow">
        Baz:
      </Text>
    );
  return (
    <Text bold color="red">
      Error:
    </Text>
  );
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
  onInterrupt?: () => void;
  isResponseActive?: boolean;
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
    onInterrupt,
    isResponseActive = false,
  }) => {
    const { stdout } = useStdout();
    const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);
    const [terminalHeight, setTerminalHeight] = useState(stdout?.rows ?? 24);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const scrollViewRef = useRef<ScrollViewRef>(null);
    const previousMessagesLengthRef = useRef(messages.length);
    const userScrolledRef = useRef(false);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
      if (!stdout) return;
      const onResize = () => {
        setTerminalWidth(stdout.columns ?? 80);
        setTerminalHeight(stdout.rows ?? 24);
        scrollViewRef.current?.remeasure();
      };
      stdout.on("resize", onResize);
      return () => {
        stdout.off("resize", onResize);
      };
    }, [stdout]);

    const latestAssistant = useMemo(() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") return messages[i];
      }
      return null;
    }, [messages]);

    const activeToolCalls = latestAssistant?.toolCalls ?? [];
    const hasPendingToolCalls = activeToolCalls.some((t) => !t.result);

    // Calculate available height for scroll view
    // Reserve space for: loading indicator (2-3 lines), chat input (4-6 lines), margins, scroll indicators
    const scrollViewHeight = useMemo(() => {
      const reservedHeight = isLoading || hasPendingToolCalls ? 3 : 6; // Loading takes less space
      const indicatorHeight = messages.length > 3 ? 2 : 0; // Reserve space for scroll indicators if needed
      const available = Math.max(5, terminalHeight - reservedHeight - indicatorHeight - 2); // Min 5 lines, 2 for margins
      return Math.max(3, Math.floor(available * 0.7)); // Min 3 lines after reduction
    }, [terminalHeight, isLoading, hasPendingToolCalls, messages.length]);

    const scrollToBottom = useCallback(() => {
      if (scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToBottom();
        }, 0);
      }
    }, []);

    useEffect(() => {
      if (scrollViewRef.current) {
        setTimeout(() => {
          if (scrollViewRef.current) {
            const height = scrollViewRef.current.getContentHeight();
            if (height > 0) {
              setContentHeight(height);
            } else {
              const estimatedHeight = messages.length * 4;
              setContentHeight(estimatedHeight);
            }
          }
        }, 100);
      }
    }, [messages.length, messages]);

    useEffect(() => {
      const wasEmpty = previousMessagesLengthRef.current === 0;
      const nowHasMessages = messages.length > 0;
      
      if ((!hasInitializedRef.current && nowHasMessages) || (wasEmpty && nowHasMessages)) {
        hasInitializedRef.current = true;
        userScrolledRef.current = false;
        scrollToBottom();
        previousMessagesLengthRef.current = messages.length;
        return;
      }

      const hasNewMessages = messages.length > previousMessagesLengthRef.current;
      if (hasNewMessages && !userScrolledRef.current) {
        scrollToBottom();
      }
      previousMessagesLengthRef.current = messages.length;
    }, [messages.length, scrollToBottom]);

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

    useInput(
      (_input, key) => {
        if (key.escape && isResponseActive && onInterrupt) {
          onInterrupt();
          return;
        }
        
        if (scrollViewRef.current) {
          if (key.upArrow) {
            userScrolledRef.current = true;
            scrollViewRef.current.scrollBy(-1);
          } else if (key.downArrow) {
            userScrolledRef.current = true;
            scrollViewRef.current.scrollBy(1);
          } else if (key.pageUp) {
            userScrolledRef.current = true;
            const scrollAmount = Math.max(1, scrollViewHeight - 3);
            scrollViewRef.current.scrollBy(-scrollAmount);
          } else if (key.pageDown) {
            userScrolledRef.current = true;
            const scrollAmount = Math.max(1, scrollViewHeight - 3);
            scrollViewRef.current.scrollBy(scrollAmount);
          } else if ((key.ctrl || key.meta) && _input === "a") {
            userScrolledRef.current = true;
            scrollViewRef.current.scrollToTop();
          } else if ((key.ctrl || key.meta) && _input === "e") {
            userScrolledRef.current = false;
            scrollViewRef.current.scrollToBottom();
          }
        }
      },
      { isActive: !disabled && !isLoading && !hasPendingToolCalls },
    );

    const canScrollUp = useMemo(() => {
      return scrollOffset > 0;
    }, [scrollOffset]);

    const canScrollDown = useMemo(() => {
      if (contentHeight > 0 && scrollViewHeight > 0) {
        return scrollOffset + scrollViewHeight < contentHeight;
      }
      return messages.length > 3;
    }, [scrollOffset, contentHeight, scrollViewHeight, messages.length]);

    return (
      <Box flexDirection="column">
        <ScrollView
          ref={scrollViewRef}
          height={scrollViewHeight}
          width={terminalWidth}
          onScroll={(offset) => {
            setScrollOffset(offset);
            if (scrollViewRef.current) {
              const height = scrollViewRef.current.getContentHeight();
              if (height > 0) {
                setContentHeight(height);
              }
            }
          }}
        >
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
        </ScrollView>

        {(isLoading || hasPendingToolCalls) && (
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            <Box>
              <Text color="magenta">
                <Spinner type="dots" /> Thinking...
              </Text>
            </Box>
            {isResponseActive && (
              <Box marginTop={1}>
                <Text dimColor>Press ESC to stop response</Text>
              </Box>
            )}
          </Box>
        )}

        {!disabled && !isLoading && !hasPendingToolCalls && (
          <>
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
              onInterrupt={onInterrupt}
              isResponseActive={isResponseActive}
            />
            
            {(canScrollUp || canScrollDown) && (
              <Box marginTop={1}>
                <Text dimColor>
                  {canScrollUp && canScrollDown
                    ? "↑↓ Scroll: ↑↓ arrows, Page Up/Down, Ctrl+A (top), Ctrl+E (bottom)"
                    : canScrollUp
                      ? "↑ More above - Use ↑↓ arrows, Page Up/Down, Ctrl+A (top), Ctrl+E (bottom)"
                      : "↓ More below - Use ↑↓ arrows, Page Up/Down, Ctrl+A (top), Ctrl+E (bottom)"}
                </Text>
              </Box>
            )}
          </>
        )}
      </Box>
    );
  },
);

export default ChatDisplay;

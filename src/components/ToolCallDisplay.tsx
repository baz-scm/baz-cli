import React, { memo, useMemo, useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { ChatToolCall } from "../models/chat.js";
import { renderMarkdown } from "../lib/markdown.js";
import { MAIN_COLOR } from "../theme/colors.js";

const MIN_LOADER_TIME_MS = 3000;

interface ToolCallDisplayProps {
  toolCall: ChatToolCall;
  isExpanded?: boolean;
  showExpandHint?: boolean;
}

const ToolCallDisplay = memo<ToolCallDisplayProps>(
  ({ toolCall, isExpanded = false, showExpandHint = false }) => {
    const { toolName, message, result } = toolCall;

    // Ensure loader shows for minimum time even if result arrives quickly
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        setMinTimeElapsed(true);
      }, MIN_LOADER_TIME_MS);

      return () => clearTimeout(timer);
    }, []);

    // Show loader if no result yet, OR if result arrived but min time hasn't passed
    const showLoader = !result || !minTimeElapsed;

    const formattedToolName = toolName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const renderedResult = useMemo(
      () => (result ? renderMarkdown("```diff\n" + result + "\n```") : null),
      [result],
    );

    return (
      <Box
        flexDirection="column"
        marginY={1}
        paddingLeft={1}
        borderStyle="single"
        borderColor={isExpanded ? MAIN_COLOR : "gray"}
      >
        <Box>
          {showLoader ? (
            <>
              <Text color="magenta">
                <Spinner type="arrow3" />
              </Text>
              <Text color="cyan" bold>
                {" "}
                {formattedToolName}
              </Text>
              {message && <Text color="gray"> ({message})</Text>}
            </>
          ) : (
            <>
              <Text color="cyan" bold>
                🔧 {formattedToolName}
              </Text>
              {message && <Text color="gray"> ({message})</Text>}
              {!isExpanded && showExpandHint && (
                <Text dimColor italic>
                  {" "}
                  - Press Ctrl+o to expand
                </Text>
              )}
            </>
          )}
        </Box>

        {isExpanded && !showLoader && result && (
          <Box
            flexDirection="column"
            marginTop={1}
            paddingLeft={2}
            borderStyle="single"
            borderColor="gray"
          >

            <Box paddingLeft={1}>
              <Text>{renderedResult}</Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) =>
    prevProps.toolCall.id === nextProps.toolCall.id &&
    prevProps.toolCall.message === nextProps.toolCall.message &&
    prevProps.toolCall.result === nextProps.toolCall.result &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.showExpandHint === nextProps.showExpandHint,
);

export default ToolCallDisplay;

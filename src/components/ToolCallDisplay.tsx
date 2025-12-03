import React, { memo } from "react";
import { Box, Text } from "ink";
import { ChatToolCall } from "../models/chat.js";
import { MAIN_COLOR } from "../theme/colors.js";

interface ToolCallDisplayProps {
  toolCall: ChatToolCall;
  isExpanded?: boolean;
}

const ToolCallDisplay = memo<ToolCallDisplayProps>(
  ({ toolCall, isExpanded = false }) => {
    const { toolName, message, result } = toolCall;

    // Format tool name for display (e.g., get_pull_request_diff -> Get Pull Request Diff)
    const formattedToolName = toolName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return (
      <Box
        flexDirection="column"
        marginY={1}
        paddingLeft={1}
        borderStyle="single"
        borderColor={isExpanded ? MAIN_COLOR : "gray"}
      >
        <Box>
          <Text color="cyan" bold>
            ⚡
          </Text>
          <Text color="cyan" bold>
            {" "}
            {formattedToolName}
          </Text>
          {!isExpanded && result && (
            <Text dimColor> (Press Ctrl+o to expand)</Text>
          )}
        </Box>

        {message && (
          <Box paddingLeft={2}>
            <Text dimColor>{message}</Text>
          </Box>
        )}

        {isExpanded && result && (
          <Box
            flexDirection="column"
            marginTop={1}
            paddingLeft={2}
            borderStyle="single"
            borderColor="gray"
          >
            <Text color="gray" bold>
              Result:
            </Text>
            <Box paddingLeft={1}>
              <Text wrap="wrap">{result}</Text>
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
    prevProps.isExpanded === nextProps.isExpanded,
);

export default ToolCallDisplay;


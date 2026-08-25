import React from "react";
import { Box, Text } from "ink";
import { getTheme } from "../theme/theme.js";
import { useCompactChrome } from "../hooks/useTerminalSize.js";

const theme = getTheme();

const TITLE = "Baz Checkout";
const TAGLINE = "Review and approve your PRs with Baz's AI Code Review Agent";

/**
 * The banner drops to a single line in short windows, where the four rows of
 * the bordered version cost more than they are worth.
 */
const HeaderDisplay: React.FC = () => {
  const compact = useCompactChrome();

  if (compact) {
    return (
      <Box key="static-header">
        <Text color={theme.main} bold>
          {TITLE}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      key="static-header"
      borderColor={theme.main}
      borderStyle="round"
      flexDirection="column"
    >
      <Text>{TITLE}</Text>
      <Text>{TAGLINE}</Text>
    </Box>
  );
};

export default HeaderDisplay;

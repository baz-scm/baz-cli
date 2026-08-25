import React from "react";
import { Box, Text } from "ink";
import { getTheme } from "../../theme/theme.js";

const theme = getTheme();

interface CredentialsFlowProps {
  providerName: string;
  onComplete: () => void;
}

const CredentialsFlow: React.FC<CredentialsFlowProps> = ({ providerName }) => {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.warning} bold>
          ℹ️ Credentials Flow Not Yet Implemented
        </Text>
      </Box>
      <Text>
        The credentials-based authentication flow for {providerName} is coming
        soon.
      </Text>
      <Box marginTop={1}>
        <Text dimColor italic>
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

export default CredentialsFlow;

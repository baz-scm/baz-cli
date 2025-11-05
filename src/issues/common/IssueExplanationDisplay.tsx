import React from "react";
import { Box, Text } from "ink";
import { MAIN_COLOR } from "../../theme/colors.js";

interface IssueExplanationDisplayProps {
  title: string;
  body: React.ReactNode;
}

const IssueExplanationDisplay: React.FC<IssueExplanationDisplayProps> = ({
  title,
  body,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={MAIN_COLOR}>● Issue found: {title}</Text>

      {body}
    </Box>
  );
};

export default IssueExplanationDisplay;

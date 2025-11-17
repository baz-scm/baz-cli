import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { MAIN_COLOR } from "../theme/colors.js";

interface LoadingSpinnerProps {
  message?: string;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
  color = MAIN_COLOR,
}) => {
  return (
    <Box>
      <Text color={color}>
        <Spinner type="dots" />
      </Text>
      <Text color={color}> {message}</Text>
    </Box>
  );
};

export default LoadingSpinner;

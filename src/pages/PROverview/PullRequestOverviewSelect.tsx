import React from "react";
import { Box, Text, useInput } from "ink";
import { PullRequestDetails, SpecReview } from "../../lib/clients/baz.js";
import { Issue } from "../../issues/types.js";
import PullRequestOverview from "./PullRequestOverview.js";

interface PullRequestOverviewSelectProps {
  pr: PullRequestDetails;
  issues: Issue[];
  specReviews: SpecReview[];
  onContinue: () => void;
  onBack: () => void;
}

const PullRequestOverviewSelect: React.FC<PullRequestOverviewSelectProps> = ({
  pr,
  issues,
  specReviews,
  onContinue,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.return) {
      onContinue();
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <>
      <PullRequestOverview pr={pr} issues={issues} specReviews={specReviews} />

      <Box>
        <Text dimColor italic>
          ↵ To start the review • ESC to go back
        </Text>
      </Box>
    </>
  );
};

export default PullRequestOverviewSelect;

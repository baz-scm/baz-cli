import React from "react";
import { Box, Text, useInput } from "ink";
import { PullRequestDetails } from "../lib/clients/baz.js";
import { Issue } from "../issues/types.js";
import PullRequestOverview from "./PullRequestOverview.js";

interface PullRequestOverviewSelectProps {
  pr: PullRequestDetails;
  issues: Issue[];
  onSelect: () => void;
}

const PullRequestOverviewSelect: React.FC<PullRequestOverviewSelectProps> = ({
  pr,
  issues,
  onSelect,
}) => {
  useInput((_input, key) => {
    if (key.return) {
      onSelect();
    }
  });

  return (
    <>
      <PullRequestOverview pr={pr} issues={issues} />

      <Box>
        <Text>↵ To start the review</Text>
      </Box>
    </>
  );
};

export default PullRequestOverviewSelect;

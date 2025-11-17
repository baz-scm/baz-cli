import React from "react";
import { Box, Text } from "ink";
import { MAIN_COLOR } from "../theme/colors.js";
import { REVIEW_HEADLINE_TEXT } from "../theme/banners.js";
import { PullRequestDetails, SpecReview } from "../lib/clients/baz.js";
import { Issue } from "../issues/types.js";

const CHECKBOX_PLACEHOLDER = " □ ";

interface PullRequestOverviewProps {
  pr: PullRequestDetails;
  issues: Issue[];
  specReviews: SpecReview[];
}

const PullRequestOverview: React.FC<PullRequestOverviewProps> = ({
  pr,
  issues,
  specReviews,
}) => {
  const filesChanged = `${pr.files_viewed.length} files changed`;

  let specReviewSummary = "No requirements were identified";
  const latestSpecReview = specReviews.at(-1);
  if (
    latestSpecReview?.result &&
    latestSpecReview.result.requirements_found > 0
  ) {
    specReviewSummary = `${latestSpecReview.result.requirements_met}/${latestSpecReview.result.requirements_found} met requirements in this CR`;
  }

  let discussionSummary = "No unresolved comments";
  const openDiscussions = issues.filter(
    (issue) => issue.type === "discussion",
  ).length;
  if (openDiscussions > 0) {
    discussionSummary = `${openDiscussions} unresolved comments`;
  }

  return (
    <>
      <Box key="pr-overview-headline">
        <Text color={MAIN_COLOR}>{REVIEW_HEADLINE_TEXT}</Text>
      </Box>
      <Box key="pr-overview-details" flexDirection="column" marginBottom={1}>
        <Text>CR Overview</Text>
        <Text>
          {CHECKBOX_PLACEHOLDER}
          {filesChanged}
        </Text>
        <Text>
          <Text>{CHECKBOX_PLACEHOLDER}</Text>
          <Text color="green">+{pr.lines_added} lines added</Text>
          <Text> / </Text>
          <Text color="red">-{pr.lines_deleted} lines removed</Text>
        </Text>
        <Text>
          {CHECKBOX_PLACEHOLDER}
          {specReviewSummary}
        </Text>
        <Text>
          {CHECKBOX_PLACEHOLDER}
          {discussionSummary}
        </Text>
      </Box>
    </>
  );
};

export default PullRequestOverview;

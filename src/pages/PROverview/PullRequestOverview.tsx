import React from "react";
import { Box, Text } from "ink";
import { MAIN_COLOR } from "../../theme/colors.js";
import { REVIEW_HEADLINE_TEXT } from "../../theme/banners.js";
import type {
  PullRequestDetails,
  SpecReview,
} from "../../lib/providers/index.js";
import { Issue } from "../../issues/types.js";

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
  return (
    <>
      <Box key="pr-overview-headline">
        <Text color={MAIN_COLOR}>{REVIEW_HEADLINE_TEXT}</Text>
      </Box>
      <Box key="pr-overview-details" flexDirection="column" marginBottom={1}>
        <Text>CR Overview</Text>
        <FilesSummary pr={pr} />
        <LinesSummary pr={pr} />
        <SpecReviewSummary specReviews={specReviews} />
        <DiscussionsSummary issues={issues} />
      </Box>
    </>
  );
};

const FilesSummary: React.FC<{
  pr: PullRequestDetails;
}> = ({ pr }) => {
  const filesChanged = pr.files_changed
    ? `${pr.files_changed} files changed`
    : undefined;
  const filesAdded = pr.files_added
    ? `${pr.files_added} files added`
    : undefined;
  const filesDeleted = pr.files_deleted
    ? `${pr.files_deleted} files deleted`
    : undefined;

  const filesSummary =
    [filesChanged, filesAdded, filesDeleted].filter(Boolean).join(" / ") ||
    "No files changed";

  return (
    <Text>
      {CHECKBOX_PLACEHOLDER}
      {filesSummary}
    </Text>
  );
};

const LinesSummary: React.FC<{
  pr: PullRequestDetails;
}> = ({ pr }) => {
  return (
    <Text>
      <Text>{CHECKBOX_PLACEHOLDER}</Text>
      <Text color="green">+{pr.lines_added} lines added</Text>
      <Text> / </Text>
      <Text color="red">-{pr.lines_deleted} lines removed</Text>
    </Text>
  );
};

const SpecReviewSummary: React.FC<{
  specReviews: SpecReview[];
}> = ({ specReviews }) => {
  let specReviewSummary = "No requirements were identified";
  const latestSpecReview = specReviews.at(-1);
  if (
    latestSpecReview?.requirementsFound &&
    latestSpecReview.requirementsFound > 0
  ) {
    specReviewSummary = `${latestSpecReview.requirementsMet}/${latestSpecReview.requirementsFound} met requirements in this CR`;
  }

  return (
    <Text>
      {CHECKBOX_PLACEHOLDER}
      {specReviewSummary}
    </Text>
  );
};

const DiscussionsSummary: React.FC<{
  issues: Issue[];
}> = ({ issues }) => {
  let discussionsSummary = "No unresolved comments";
  const openDiscussions = issues.filter(
    (issue) => issue.type === "discussion",
  ).length;
  if (openDiscussions > 0) {
    discussionsSummary = `${openDiscussions} unresolved comments`;
  }

  return (
    <Text>
      {CHECKBOX_PLACEHOLDER}
      {discussionsSummary}
    </Text>
  );
};

export default PullRequestOverview;

import React from "react";
import { Box, Text } from "ink";
import type {
  PullRequest,
  PRRun,
  CodeChangeReview,
} from "../../lib/providers/index.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { isBazReviewer } from "../../lib/reviewer.js";
import { getTheme } from "../../theme/theme.js";

const theme = getTheme();

interface PullRequestCardProps {
  pr: PullRequest;
  isSelected: boolean;
  canMerge: boolean;
  currentUserLogin?: string;
}

type CIStatus = "success" | "pending" | "failure" | "none";

type ReviewStatus =
  | "waiting_review"
  | "reviewed"
  | "reviewed_by_me"
  | "approved"
  | "approved_by_me";

function getCIStatus(runs: PRRun[]): CIStatus {
  if (!runs || runs.length === 0) return "none";
  const hasFailure = runs.some((run) => run.status === "failure");
  if (hasFailure) return "failure";
  const hasPending = runs.some(
    (run) =>
      run.status === "pending" ||
      run.status === "in_progress" ||
      run.status === "queued",
  );
  if (hasPending) return "pending";
  const allSuccess = runs.every((run) => run.status === "success");
  if (allSuccess) return "success";
  return "none";
}

function getCIIcon(status: CIStatus):
  | {
      text: string;
      icon: string;
      color?: string;
    }
  | undefined {
  if (status === "success") {
    return { text: "passed", icon: "✓", color: theme.success };
  }
  if (status === "pending") {
    return { text: "pending", icon: "●", color: theme.warning };
  }
  if (status === "failure") {
    return { text: "failed", icon: "✗", color: theme.error };
  }
  return undefined;
}

function getBazReviewerStatus(
  reviews: CodeChangeReview[],
): "approved" | "reviewed" | "none" {
  const bazReviews = reviews.filter((r) => isBazReviewer(r.assignee));

  if (bazReviews.length === 0) {
    return "none";
  }

  const hasApproval = bazReviews.some((r) => r.review_state === "approved");
  if (hasApproval) {
    return "approved";
  }

  return "reviewed";
}

/**
 * Determines the review status from human reviewers, excluding baz-reviewer.
 * Prioritizes showing if the current user has reviewed/approved.
 *
 * @param reviews - Array of code change reviews for the pull request
 * @param currentUserLogin - Optional login name of the current user
 * @returns The calculated review status for human reviewers only
 */
function getReviewStatus(
  reviews: CodeChangeReview[],
  currentUserLogin?: string,
): ReviewStatus {
  const humanReviews = reviews.filter((r) => !isBazReviewer(r.assignee));

  if (humanReviews.length === 0) {
    return "waiting_review";
  }
  const hasApprovals = humanReviews.some((r) => r.review_state === "approved");
  const userReview = humanReviews.find(
    (r) => currentUserLogin && r.assignee === currentUserLogin,
  );
  if (userReview && userReview.review_state !== "assigned") {
    if (userReview.review_state === "approved") {
      return "approved_by_me";
    }
    return "reviewed_by_me";
  }
  if (hasApprovals) {
    return "approved";
  }
  return "reviewed";
}

function getReviewStatusDisplay(status: ReviewStatus): {
  text: string;
  color?: string;
} {
  switch (status) {
    case "waiting_review":
      return { text: "● Awaiting review", color: theme.text };
    case "reviewed":
      return { text: "◐ Reviewed", color: theme.warning };
    case "reviewed_by_me":
      return { text: "◐ Reviewed by me", color: theme.warning };
    case "approved":
      return { text: "✓ Approved", color: theme.success };
    case "approved_by_me":
      return { text: "✓ Approved by me", color: theme.success };
  }
}

function getBazBadge(status: "approved" | "reviewed" | "none"): {
  text: string;
  color?: string;
} | null {
  switch (status) {
    case "approved":
      return { text: "[✓ baz]", color: theme.main };
    case "reviewed":
      return { text: "[◐ baz]", color: theme.warning };
    case "none":
      return null;
  }
}

export const PullRequestCard: React.FC<PullRequestCardProps> = ({
  pr,
  isSelected,
  currentUserLogin,
  canMerge,
}) => {
  const ciStatus = getCIStatus(pr.runs);
  const ciIcon = getCIIcon(ciStatus);
  const reviewStatus = getReviewStatus(pr.reviews, currentUserLogin);
  const reviewDisplay = getReviewStatusDisplay(reviewStatus);
  const bazStatus = getBazReviewerStatus(pr.reviews);
  const bazBadge = getBazBadge(bazStatus);
  const updatedTime = pr.updatedAt;

  const titleColor = isSelected ? theme.main : theme.text;
  const metadataColor = isSelected ? theme.main : theme.text;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold={isSelected} color={titleColor}>
          {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}#{pr.prNumber}{" "}
          {pr.title} <Text dimColor>[{pr.repositoryName}]</Text>{" "}
          {ciIcon?.icon && (
            <Text bold color={ciIcon.color}>
              {ciIcon.icon}
            </Text>
          )}
        </Text>
      </Box>
      <Text dimColor={!isSelected} color={metadataColor}>
        {"    "}by {pr.authorName}
        {" • "}
        {updatedTime}
        {" • "}
        <Text dimColor={!isSelected} color={reviewDisplay.color}>
          {reviewDisplay.text}
        </Text>
        {bazBadge && (
          <>
            {" • "}
            <Text dimColor={!isSelected} color={bazBadge.color}>
              {bazBadge.text}
            </Text>
          </>
        )}
        {ciIcon?.text && <Text> • CI {ciIcon.text}</Text>}
      </Text>
      {canMerge && (
        <Text bold color={theme.success}>
          {"    "}Want to merge? Ctrl+G and let's go!
        </Text>
      )}
    </Box>
  );
};

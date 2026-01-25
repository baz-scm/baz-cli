import React from "react";
import { Box, Text } from "ink";
import type {
  PullRequest,
  PRRun,
  CodeChangeReview,
} from "../../lib/providers/index.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { MAIN_COLOR } from "../../theme/colors.js";
const BAZ_REVIEWER_PATTERN =
  /^(https:\/\/github\.com\/apps\/)?baz-reviewer(\[bot])?$/i;

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
      color: string;
    }
  | undefined {
  if (status === "success") {
    return { text: "passed", icon: "✓", color: "green" };
  }
  if (status === "pending") {
    return { text: "pending", icon: "●", color: "yellow" };
  }
  if (status === "failure") {
    return { text: "failed", icon: "✗", color: "red" };
  }
  return undefined;
}

function isBazReviewer(review: CodeChangeReview): boolean {
  return BAZ_REVIEWER_PATTERN.test(review.assignee);
}

function getBazReviewerStatus(
  reviews: CodeChangeReview[],
): "approved" | "reviewed" | "none" {
  const bazReviews = reviews.filter((r) => isBazReviewer(r));

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
  const humanReviews = reviews.filter((r) => !isBazReviewer(r));

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
  color: string;
} {
  switch (status) {
    case "waiting_review":
      return { text: "● Awaiting review", color: "black" };
    case "reviewed":
      return { text: "◐ Reviewed", color: "yellow" };
    case "reviewed_by_me":
      return { text: "◐ Reviewed by me", color: "yellow" };
    case "approved":
      return { text: "✓ Approved", color: "green" };
    case "approved_by_me":
      return { text: "✓ Approved by me", color: "green" };
  }
}

function getBazBadge(status: "approved" | "reviewed" | "none"): {
  text: string;
  color: string;
} | null {
  switch (status) {
    case "approved":
      return { text: "[✓ baz]", color: "cyan" };
    case "reviewed":
      return { text: "[◐ baz]", color: "yellow" };
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

  const titleColor = isSelected ? "cyan" : "white";
  const metadataColor = isSelected ? MAIN_COLOR : "white";

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold={isSelected} color={titleColor}>
          {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}#{pr.prNumber}{" "}
          {pr.title} <Text color="gray">[{pr.repositoryName}]</Text>{" "}
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
        <Text bold color="green">
          {"    "}Want to merge? Ctrl+G and let's go!
        </Text>
      )}
    </Box>
  );
};

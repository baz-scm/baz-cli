import React from "react";
import { Box, Text } from "ink";
import type {
  PullRequest,
  PRRun,
  CodeChangeReview,
} from "../../lib/providers/index.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";
import { MAIN_COLOR } from "../../theme/colors.js";

interface PullRequestCardProps {
  pr: PullRequest;
  isSelected: boolean;
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

function getCIIcon(status: CIStatus): { icon: string; color: string } {
  switch (status) {
    case "success":
      return { icon: "✓", color: "green" };
    case "pending":
      return { icon: "●", color: "yellow" };
    case "failure":
      return { icon: "✗", color: "red" };
    case "none":
      return { icon: "", color: "gray" };
  }
}

function getReviewStatus(
  reviews: CodeChangeReview[],
  currentUserLogin?: string,
): ReviewStatus {
  if (!reviews || reviews.length === 0) {
    return "waiting_review";
  }
  const hasApprovals = reviews.some((r) => r.review_state === "approved");
  const userReview = reviews.find(
    (r) => currentUserLogin && r.assignee === currentUserLogin,
  );
  if (userReview) {
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

function getReviewStatusText(status: ReviewStatus): string {
  switch (status) {
    case "waiting_review":
      return "⏳ Waiting review";
    case "reviewed":
      return "📝 Reviewed";
    case "reviewed_by_me":
      return "📝 Reviewed by me";
    case "approved":
      return "✅ Approved";
    case "approved_by_me":
      return "✅ Approved by me";
  }
}

function getReviewStatusColor(status: ReviewStatus): string {
  switch (status) {
    case "waiting_review":
      return "gray";
    case "reviewed":
    case "reviewed_by_me":
      return "yellow";
    case "approved":
    case "approved_by_me":
      return "green";
  }
}

function formatTimeShort(timeStr: string): string {
  // Convert time strings to short format
  return timeStr
    .replace(/(\d+)\s*days?\s*ago/, "$1d")
    .replace(/(\d+)\s*hours?\s*ago/, "$1h")
    .replace(/(\d+)\s*minutes?\s*ago/, "$1m")
    .replace(/(\d+)\s*seconds?\s*ago/, "$1s")
    .replace("just now", "now")
    .replace("updated ", "");
}

export const PullRequestCard: React.FC<PullRequestCardProps> = ({
  pr,
  isSelected,
  currentUserLogin,
}) => {
  const ciStatus = getCIStatus(pr.runs);
  const ciIcon = getCIIcon(ciStatus);
  const reviewStatus = getReviewStatus(pr.reviews, currentUserLogin);
  const reviewText = getReviewStatusText(reviewStatus);
  const reviewColor = getReviewStatusColor(reviewStatus);
  const timeShort = formatTimeShort(pr.updatedAt);

  const titleColor = isSelected ? "cyan" : "white";
  const metadataColor = isSelected ? MAIN_COLOR : "white";

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={titleColor}>
          {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}#{pr.prNumber}{" "}
          {pr.title}
        </Text>
        {ciIcon.icon && <Text color={ciIcon.color}>{ciIcon.icon}</Text>}
      </Box>
      <Text color={metadataColor}>
        {"         "}
        <Text color="gray">{pr.repositoryName}</Text>
        {" • "}
        {pr.authorName}
        {" • "}
        {timeShort}
        {" • "}
        <Text color={reviewColor}>{reviewText}</Text>
      </Text>
    </Box>
  );
};

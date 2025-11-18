import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { usePullRequest } from "../hooks/usePullRequest.js";
import { useFetchUser } from "../hooks/useFetchUser.js";
import { approvePR, mergePR } from "../lib/clients/baz.js";
import { useFetchMergeStatus } from "../hooks/useFetchMergeStatus.js";
import LoadingSpinner from "./LoadingSpinner.js";

export type PostReviewAction =
  | "approve"
  | "merge"
  | "reviewSameRepo"
  | "reviewDifferentRepo"
  | "exit";

interface PostReviewPromptProps {
  onSelect: (action: PostReviewAction) => void;
  prId: string;
}

interface SelectItem {
  label: string;
  value: PostReviewAction;
}

const PostReviewPrompt: React.FC<PostReviewPromptProps> = ({
  onSelect,
  prId,
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pr = usePullRequest(prId);
  const user = useFetchUser();
  const mergeStatus = useFetchMergeStatus(prId);

  const canApprove = useMemo(() => {
    if (!pr.data || !user.data) return false;

    const isAuthor = user?.data.login === pr?.data.author_name;
    const hasAlreadyApproved = pr?.data.reviews.some(
      (review) =>
        review.assignee === user?.data?.login &&
        review.review_state === "approved",
    );

    return !isAuthor && !hasAlreadyApproved;
  }, [pr.data, user.data]);

  const canMerge = useMemo(() => {
    if (!mergeStatus.data) return false;
    return mergeStatus?.data.is_mergeable;
  }, [mergeStatus.data]);

  const items: SelectItem[] = [
    ...(canApprove
      ? [{ label: "Approve this PR", value: "approve" as PostReviewAction }]
      : []),
    ...(canMerge
      ? [{ label: "Merge this PR", value: "merge" as PostReviewAction }]
      : []),
    { label: "Review another PR in this repository", value: "reviewSameRepo" },
    {
      label: "Review a PR in a different repository",
      value: "reviewDifferentRepo",
    },
    { label: "Exit", value: "exit" },
  ];

  async function handleApprovePR() {
    setIsApproving(true);
    setActionError(null);
    try {
      await approvePR(prId);
      await pr.refetch();
      setIsSelected(false);
    } catch (_) {
      setActionError("Failed to approve PR. Please try again.");
      setIsSelected(false);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleMerge() {
    setIsMerging(true);
    setActionError(null);
    try {
      await mergePR(prId);
      await pr.refetch();
      setIsSelected(false);
    } catch (_) {
      setActionError("Failed to merge PR. Please try again.");
      setIsSelected(false);
    } finally {
      setIsMerging(false);
    }
  }

  const handleSelect = async (item: SelectItem) => {
    setIsSelected(true);

    if (item.value === "approve") {
      await handleApprovePR();
    } else if (item.value === "merge") {
      await handleMerge();
    } else {
      onSelect(item.value);
    }
  };

  const loading = pr.loading || user.loading || mergeStatus.loading;

  if (isSelected && !isApproving && !actionError && !isMerging) {
    return null;
  }

  if (loading) {
    return <LoadingSpinner message="Fetching details..." />;
  }

  if (isApproving) {
    return <LoadingSpinner message="Approving PR..." />;
  }

  if (isMerging) {
    return <LoadingSpinner message="Merging PR..." />;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        {actionError && (
          <Box marginBottom={1}>
            <Text color="red">✗ {actionError}</Text>
          </Box>
        )}
        <Text bold color="cyan">
          What would you like to do next?
        </Text>
      </Box>
      <SelectInput
        items={items}
        onSelect={handleSelect}
        indicatorComponent={({ isSelected }) => (
          <Text color={isSelected ? "green" : "gray"}>
            {isSelected ? "❯" : " "}
          </Text>
        )}
        itemComponent={({ isSelected, label }) => (
          <Text color={isSelected ? "cyan" : "white"}>{label}</Text>
        )}
      />
      <Box marginTop={1}>
        <Text dimColor italic>
          Use ↑↓ arrows and Enter to select
        </Text>
      </Box>
    </Box>
  );
};

export default PostReviewPrompt;

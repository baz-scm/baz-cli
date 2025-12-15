import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { usePullRequest } from "../../hooks/usePullRequest.js";
import { useFetchUser } from "../../hooks/useFetchUser.js";
import { useFetchMergeStatus } from "../../hooks/useFetchMergeStatus.js";
import LoadingSpinner from "../../components/LoadingSpinner.js";
import { PRContext } from "../../lib/providers/index.js";
import { useAppMode } from "../../lib/config/AppModeContext.js";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../../theme/symbols.js";

export type PostReviewAction =
  | "approve"
  | "merge"
  | "reviewSameRepo"
  | "reviewDifferentRepo"
  | "exit";

interface PostReviewPromptProps {
  onSelect: (action: PostReviewAction) => void;
  prContext: PRContext;
}

interface SelectItem {
  label: string;
  value: PostReviewAction;
}

const PostReviewPrompt: React.FC<PostReviewPromptProps> = ({
  onSelect,
  prContext,
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pr = usePullRequest(prContext);
  const user = useFetchUser();
  const mergeStatus = useFetchMergeStatus(prContext);
  const appMode = useAppMode();

  const dataProvider = appMode.mode.dataProvider;

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
    { label: "Review another PR", value: "reviewSameRepo" },
    { label: "Exit", value: "exit" },
  ];

  async function handleApprovePR() {
    setIsApproving(true);
    setActionError(null);
    try {
      await dataProvider.approvePR(prContext);
      const userLogin = user.data?.login;
      if (userLogin) {
        pr.updateData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            reviews: [
              ...prev.reviews,
              { assignee: userLogin, review_state: "approved" },
            ],
          };
        });
      }
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
      const mergeStrategy = mergeStatus.data?.merge_strategy ?? "merge";
      await dataProvider.mergePR(prContext, mergeStrategy);
      mergeStatus.updateData(() => ({
        is_mergeable: false,
        merge_strategy: mergeStrategy,
      }));
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
            {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}
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

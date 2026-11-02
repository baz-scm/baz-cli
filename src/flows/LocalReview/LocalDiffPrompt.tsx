import React, { useEffect } from "react";
import {
  getCurrentBranch,
  getDiff,
  getBranchDiff,
  getDiffAgainstRef,
  isOnNonDefaultBranch,
  resolveBaseRef,
} from "../../lib/git.js";

export interface DiffResult {
  diffText: string;
  currentBranch: string | null;
  defaultBranch: string | null;
  hasUncommittedChanges: boolean;
}

interface LocalDiffPromptProps {
  baseBranch?: string;
  onReady: (result: DiffResult) => void;
  onError: (message: string) => void;
}

const LocalDiffPrompt: React.FC<LocalDiffPromptProps> = ({
  baseBranch,
  onReady,
  onError,
}) => {
  useEffect(() => {
    try {
      if (baseBranch !== undefined) {
        const currentBranch = getCurrentBranch();
        const diff = getDiffAgainstRef(resolveBaseRef(baseBranch));
        if (!diff) {
          onError(
            `No changes found between ${currentBranch} and ${baseBranch}.`,
          );
          return;
        }
        onReady({
          diffText: diff,
          currentBranch,
          defaultBranch: baseBranch,
          hasUncommittedChanges: !!getDiff(),
        });
        return;
      }

      const info = isOnNonDefaultBranch();
      const hasUncommitted = !!getDiff();

      if (info.onFeatureBranch && info.defaultBranch) {
        const diff = getBranchDiff(info.defaultBranch);
        if (!diff) {
          onError(
            `No changes found between ${info.currentBranch} and ${info.defaultBranch}.`,
          );
          return;
        }
        onReady({
          diffText: diff,
          currentBranch: info.currentBranch,
          defaultBranch: info.defaultBranch,
          hasUncommittedChanges: hasUncommitted,
        });
        return;
      }

      // Default branch or detection failed — use uncommitted diff
      if (!hasUncommitted) {
        onError(
          "No changes detected. Stage some changes with `git add` and try again.",
        );
        return;
      }
      onReady({
        diffText: getDiff(),
        currentBranch: null,
        defaultBranch: null,
        hasUncommittedChanges: false,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to read git state");
    }
  }, []);

  return null;
};

export default LocalDiffPrompt;

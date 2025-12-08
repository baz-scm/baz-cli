import React from "react";
import { Box } from "ink";
import { Issue, IssueContext } from "../types.js";
import DiffDisplayContainer from "../../components/DiffDisplayContainer.js";
import type { PRContext } from "../../lib/providers/data-provider.js";

interface DiscussionIssueDisplayProps {
  issue: Issue & { type: "discussion" };
  context: IssueContext;
}

const DiscussionIssueDisplay: React.FC<DiscussionIssueDisplayProps> = ({
  issue,
  context,
}) => {
  const discussion = issue.data;

  const prContext: PRContext = {
    prId: context.prId,
    repoId: context.repoId,
    prNumber: context.prNumber,
  };

  return (
    <Box flexDirection="column">
      <DiffDisplayContainer
        key={discussion.id}
        prContext={prContext}
        commit={discussion.commit_sha}
        fileSelectionLines={
          new Map([
            [
              discussion.file ?? "",
              {
                start: discussion.original_start_line,
                end: discussion.original_end_line,
                side: discussion.side,
              },
            ],
          ])
        }
        outdated={discussion.outdated}
      />
    </Box>
  );
};

export default DiscussionIssueDisplay;

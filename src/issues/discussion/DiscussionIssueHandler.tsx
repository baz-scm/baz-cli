import React from "react";
import { Issue, IssueTypeHandler, IssueCommand } from "../types.js";
import DiscussionIssueDisplay from "./DiscussionIssueDisplay.js";
import {
  fetchRepoWriteAccess,
  postDiscussionReply,
  updateDiscussionState,
} from "../../lib/clients/baz.js";
import IssueExplanationDisplay from "../common/IssueExplanationDisplay.js";
import { parseHtmlToMarkdown } from "../../lib/parser.js";
import { Box, Text } from "ink";
import { IssueType } from "../../models/chat.js";
import { renderMarkdown } from "../../lib/markdown.js";
import { RepoWriteAccessReason } from "../../lib/providers/index.js";
import { env } from "../../lib/env-schema.js";

export const discussionIssueHandler: IssueTypeHandler<
  Issue & { type: "discussion" }
> = {
  displayExplainComponent: (props) => {
    const { issue } = props;

    const body = issue.data.comments.flatMap((comment) => {
      const user =
        comment.author_user && comment.author_user.display_name
          ? comment.author_user.display_name
          : comment.author.split("/").pop() || comment.author;
      const commentBody = renderMarkdown(
        comment.body_content_type === "html"
          ? parseHtmlToMarkdown(comment.comment_body)
          : comment.comment_body,
      );

      const textBody = commentBody.split("\n").map((line, idx) => (
        // `<Newline>` creates a too big gap between lines
        <Text key={`${comment.id}-${idx}`}>{line || " "}</Text>
      ));

      return (
        <Box key={comment.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold>{`${user}: `}</Text>
            {textBody[0]}
          </Text>
          {textBody.slice(1)}
        </Box>
      );
    });

    return <IssueExplanationDisplay title="Unresolved comment" body={body} />;
  },

  displayComponent: (props) => {
    const { issue, context } = props;

    return <DiscussionIssueDisplay issue={issue} context={context} />;
  },

  getCommands: (_issue, context): IssueCommand[] => {
    return [
      {
        command: "/comment <text>",
        description: "Post a reply comment to this discussion",
      },
      {
        command: "/resolve",
        description: "Close and resolve this discussion",
      },
      {
        command: "/next",
        description: context.hasNext
          ? "Move to the next issue"
          : "Complete the review (no more issues)",
      },
    ];
  },

  handleCommand: async (command, args, issue, context) => {
    switch (command) {
      case "comment":
        if (!args.trim()) {
          console.error("Usage: /comment <text>");
          return {};
        }
        try {
          if (!context.repoWriteAccess.hasAccess) {
            const access = await fetchRepoWriteAccess(context.fullRepoName);
            if (!access.hasAccess) {
              return {
                shouldMoveNext: false,
                shouldComplete: false,
                errorMessages: commentErrorMessage(access.reason),
              };
            } else {
              context.setRepoWriteAccess(access);
            }
          }
          await postDiscussionReply(issue.data.id, args, context.prId);
          return {
            shouldMoveNext: context.hasNext,
            shouldComplete: !context.hasNext,
          };
        } catch (error) {
          console.error("Failed to reply to discussion:", error);
          return {};
        }

      case "resolve":
        try {
          await updateDiscussionState(issue.data.id);
          return {
            shouldMoveNext: context.hasNext,
            shouldComplete: !context.hasNext,
          };
        } catch (error) {
          console.error("Failed to close discussion:", error);
          return {};
        }

      case "next":
        return {
          shouldMoveNext: context.hasNext,
          shouldComplete: !context.hasNext,
        };

      default:
        console.error(`Unknown command: /${command}`);
        return {};
    }
  },

  getApiIssueType: (_issue) => {
    return IssueType.DISCUSSION;
  },
};

function commentErrorMessage(reason: RepoWriteAccessReason | null) {
  switch (reason) {
    case RepoWriteAccessReason.MISSING_USER_INSTALLATION:
      return (
        "Write access is required to post comments. Please grant access in Baz.\n" +
        `${env.BAZ_BASE_URL}/privilege`
      );
    case RepoWriteAccessReason.MISSING_ORG_INSTALLATION:
    case RepoWriteAccessReason.REPO_NOT_CONFIGURED:
      return (
        "Baz needs write access at the organization level. Please ask your GitHub admin to grant this permission.\n" +
        `${env.BAZ_BASE_URL}/settings/integrations/github`
      );
    default:
      return undefined;
  }
}

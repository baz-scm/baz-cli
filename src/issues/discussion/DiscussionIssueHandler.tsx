import React from "react";
import { Issue, IssueTypeHandler, IssueCommand } from "../types.js";
import DiscussionIssueDisplay from "./DiscussionIssueDisplay.js";
import {
  postDiscussionReply,
  updateDiscussionState,
} from "../../lib/clients/baz.js";
import IssueExplanationDisplay from "../common/IssueExplanationDisplay.js";
import { parseHtmlToMarkdown } from "../../lib/parser.js";
import { Box, Text } from "ink";
import { IssueType } from "../../models/chat.js";

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
      const commentBody =
        comment.body_content_type === "html"
          ? parseHtmlToMarkdown(comment.comment_body)
          : comment.comment_body;

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
        command: "/reply <text>",
        description: "Post a reply comment to this discussion",
        aliases: ["/r"],
      },
      {
        command: "/close",
        description: "Close and resolve this discussion",
        aliases: ["/c"],
      },
      {
        command: "/next",
        description: context.hasNext
          ? "Move to the next issue"
          : "Complete the review (no more issues)",
        aliases: ["/n"],
      },
    ];
  },

  handleCommand: async (command, args, issue, context) => {
    switch (command) {
      case "reply":
      case "r":
        if (!args.trim()) {
          console.error("Usage: /reply <text>");
          return {};
        }
        try {
          await postDiscussionReply(issue.data.id, args, context.prId);
          return {
            shouldMoveNext: context.hasNext,
            shouldComplete: !context.hasNext,
          };
        } catch (error) {
          console.error("Failed to reply to discussion:", error);
          return {};
        }

      case "close":
      case "c":
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
      case "n":
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

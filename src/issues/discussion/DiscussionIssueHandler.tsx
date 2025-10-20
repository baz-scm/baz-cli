import React from "react";
import { Issue, IssueTypeHandler } from "../types";
import DiscussionIssueDisplay from "./DiscussionIssueDisplay";
import {
  postDiscussionReply,
  updateDiscussionState,
} from "../../lib/clients/baz";
import IssueExplanationDisplay from "../common/IssueExplanationDisplay";
import { parseHtmlToMarkdown } from "../../lib/parser";
import { Box, Text } from "ink";

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

    const handleReply = async (replyText: string) => {
      try {
        await postDiscussionReply(issue.data.id, replyText, context.prId);
        context.setIssueMode("view");
        if (context.hasNext) {
          context.moveToNext();
        } else {
          context.complete();
        }
      } catch (error) {
        console.error("Failed to reply to discussion:", error);
      }
    };

    return (
      <DiscussionIssueDisplay
        issue={issue}
        context={context}
        onReply={handleReply}
      />
    );
  },

  handleInput: async (input, issue, context) => {
    switch (input) {
      case "r":
        // Enter reply mode
        if (context.mode === "view") {
          context.setIssueMode("reply");
          return { handled: true };
        }
        return { handled: false };

      case "c":
        // Close/resolve discussion
        try {
          await updateDiscussionState(issue.data.id);
          return {
            handled: true,
            shouldMoveNext: context.hasNext,
            shouldComplete: !context.hasNext,
          };
        } catch (error) {
          console.error("Failed to resolve discussion:", error);
          return { handled: true };
        }

      case "n":
        // Next discussion
        return {
          handled: true,
          shouldMoveNext: context.hasNext,
          shouldComplete: !context.hasNext,
        };

      default:
        return { handled: false };
    }
  },
};

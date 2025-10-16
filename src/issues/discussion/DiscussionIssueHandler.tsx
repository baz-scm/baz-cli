import React from "react";
import { Issue, IssueTypeHandler } from "../types";
import DiscussionIssueDisplay from "./DiscussionIssueDisplay";
import {
  postDiscussionReply,
  updateDiscussionState,
} from "../../lib/clients/baz";

export const discussionIssueHandler: IssueTypeHandler<
  Issue & { type: "discussion" }
> = {
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

import React from "react";
import {
  Issue,
  IssueTypeHandler,
  IssueContext,
  IssueInputResult,
} from "../types";
import DiscussionIssueDisplay from "./DiscussionIssueDisplay";
import {
  postDiscussionReply,
  updateDiscussionState,
} from "../../lib/clients/baz";

interface DiscussionHandlerState {
  onReply: (text: string) => void;
  enterReplyMode: () => void;
}

// Store handlers for each discussion being displayed
const handlerStateMap = new Map<string, DiscussionHandlerState>();

export const discussionIssueHandler: IssueTypeHandler<
  Issue & { type: "discussion" }
> = {
  displayComponent: (props) => {
    const { issue, context } = props;

    // Get or create handler state for this discussion
    let state = handlerStateMap.get(issue.data.id);
    if (!state) {
      state = {
        onReply: async (replyText: string) => {
          try {
            await postDiscussionReply(
              issue.data.id,
              replyText,
              context.prId,
            );
            if (context.hasNext) {
              context.moveToNext();
            } else {
              context.complete();
            }
          } catch (error) {
            console.error("Failed to reply to discussion:", error);
          }
        },
        enterReplyMode: () => {}, // Will be set by the display component
      };
      handlerStateMap.set(issue.data.id, state);
    }

    return (
      <DiscussionIssueDisplay
        issue={issue}
        context={context}
        onReply={state.onReply}
        onEnterReplyMode={(callback) => {
          state!.enterReplyMode = callback;
        }}
      />
    );
  },

  handleInput: async (input, issue, context) => {
    const state = handlerStateMap.get(issue.data.id);

    switch (input) {
      case "r":
        // Enter reply mode
        if (state?.enterReplyMode) {
          state.enterReplyMode();
        }
        return { handled: true };

      case "c":
        // Close/resolve discussion
        try {
          await updateDiscussionState(issue.data.id);
          if (context.hasNext) {
            return { handled: true, shouldMoveNext: true };
          } else {
            return { handled: true, shouldComplete: true };
          }
        } catch (error) {
          console.error("Failed to resolve discussion:", error);
          return { handled: true };
        }

      case "n":
        // Next discussion
        if (context.hasNext) {
          return { handled: true, shouldMoveNext: true };
        }
        return { handled: true, shouldComplete: true };

      default:
        return { handled: false };
    }
  },
};

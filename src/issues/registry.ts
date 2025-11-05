import { Issue, IssueTypeHandler } from "./types.js";
import { discussionIssueHandler } from "./discussion/DiscussionIssueHandler.js";

// Registry mapping issue types to their handlers
const issueTypeRegistry: Record<Issue["type"], IssueTypeHandler> = {
  discussion: discussionIssueHandler,
  // Future issue types can be added here:
  // task: taskIssueHandler,
  // bug: bugIssueHandler,
};

export function getIssueHandler(issueType: Issue["type"]): IssueTypeHandler {
  const handler = issueTypeRegistry[issueType];
  if (!handler) {
    throw new Error(`No handler registered for issue type: ${issueType}`);
  }
  return handler;
}

export default issueTypeRegistry;

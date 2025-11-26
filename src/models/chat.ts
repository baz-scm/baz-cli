export enum IssueType {
  DISCUSSION = "discussion",
  PULL_REQUEST = "pull_request",
}

export interface IssueDiscussion {
  type: IssueType.DISCUSSION;
  data: {
    id: string;
  };
}

export interface IssuePullRequest {
  type: IssueType.PULL_REQUEST;
  data: {
    id: string;
  };
}

export type ChatIssue = IssueDiscussion | IssuePullRequest;

export interface CheckoutChatRequest {
  repoId: string;
  prId: string;
  issue: ChatIssue;
  freeText: string;
  conversationId?: string;
}

export interface MessageStart {
  type: "message_start";
  content: string;
  conversationId?: string;
}

export interface MessageDelta {
  type: "message_delta";
  content: string;
}

export interface MessageEnd {
  type: "message_end";
  content: string;
}

export type ChatStreamMessage = MessageStart | MessageDelta | MessageEnd;

export interface ChatStreamChunk {
  content?: string;
  conversationId?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MentionableUser {
  id: string;
  name: string;
  login: string;
}

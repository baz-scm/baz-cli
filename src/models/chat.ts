export enum IssueType {
  DISCUSSION = "discussion",
  PULL_REQUEST = "pull_request",
  SPEC_REVIEW = "spec_review",
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

export interface IssueSpecReview {
  type: IssueType.SPEC_REVIEW;
  data: {
    id: string;
  };
}

export type ChatIssue = IssueDiscussion | IssuePullRequest | IssueSpecReview;

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

export interface ToolCall {
  type: "tool_call";
  content: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolCallId: string;
  conversationId: string;
}

export interface ToolCallMessage {
  type: "tool_call_message";
  content: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  conversationId: string;
}

export interface ToolResult {
  type: "tool_result";
  content: string;
  toolName: string;
  toolCallId: string;
  conversationId: string;
}

export type ChatStreamMessage =
  | MessageStart
  | MessageDelta
  | MessageEnd
  | ToolCall
  | ToolCallMessage
  | ToolResult;

export interface ToolCallData {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolCallId: string;
  message?: string;
}

export interface ToolResultData {
  toolCallId: string;
  content: string;
}

export interface ChatStreamChunk {
  content?: string;
  conversationId?: string;
  toolCall?: ToolCallData;
  toolResult?: ToolResultData;
}

export interface ChatToolCall {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  message?: string;
  result?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCall[];
}

export interface MentionableUser {
  id: string;
  name: string;
  login: string;
}

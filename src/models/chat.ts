import type {
  Discussion,
  FileDiff,
  PRContext,
} from "../lib/providers/types.js";

export enum IssueType {
  DISCUSSION = "discussion",
  SPEC_REVIEW = "spec_review",
  PR_CHAT = "pr_chat",
  PR_WALKTHROUGH = "pr_walkthrough",
}

export interface IssueDiscussion {
  type: IssueType.DISCUSSION;
  data: {
    id: string;
  };
}

export interface IssuePRChat {
  type: IssueType.PR_CHAT;
  data: {
    id: string;
  };
}

export interface IssuePRWalkthrough {
  type: IssueType.PR_WALKTHROUGH;
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

export type ChatIssue =
  | IssueDiscussion
  | IssueSpecReview
  | IssuePRChat
  | IssuePRWalkthrough;

export interface TokensDiscussion
  extends Omit<Discussion, "author_user" | "comments"> {
  author_user?: { name: string; login?: string; avatarUrl?: string };
  comments: Array<{
    id: string;
    author: string;
    body: string;
    createdAt: string;
  }>;
}

export interface IssueDiscussionWithContext {
  type: IssueType.DISCUSSION;
  data: {
    id: string;
    discussion: TokensDiscussion;
    diff: FileDiff[];
  };
}

export type TokensChatIssue =
  | IssueDiscussionWithContext
  | IssuePRChat
  | IssuePRWalkthrough;

export function toTokensDiscussion(discussion: Discussion): TokensDiscussion {
  return {
    ...discussion,
    author_user: discussion.author_user
      ? { name: discussion.author_user.display_name }
      : undefined,
    comments: discussion.comments.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.comment_body,
      createdAt: c.createdAt ?? new Date().toISOString(),
    })),
  };
}

export interface BazChatRequest {
  mode: "baz";
  repoId: string;
  prId: string;
  issue: ChatIssue;
  freeText: string;
  conversationId?: string;
}

export interface TokensChatRequest {
  mode: "tokens";
  prContext: PRContext;
  issue: TokensChatIssue;
  freeText: string;
  conversationId?: string;
}

export type CheckoutChatRequest = BazChatRequest | TokensChatRequest;

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
  toolCallId?: string;
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
  toolCallId?: string;
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
  role: "user" | "assistant" | "error";
  id?: string;
  content: string;
  toolCalls?: ChatToolCall[];
}

export interface MentionableUser {
  id: string;
  name: string;
  login: string;
}

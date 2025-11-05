import { Discussion } from "../lib/clients/baz.js";
import { IssueType } from "../models/chat.js";

export type Issue = {
  type: "discussion";
  data: Discussion;
};
// Future issue types can be added here:
// | { type: "ImplementationMisalignment"; data: ImplementationMisalignment }

export interface IssueCommand {
  command: string;
  description: string;
  aliases?: string[];
}

export interface IssueContext {
  prId: string;
  repoId: string;
  currentIndex: number;
  totalIssues: number;
  hasNext: boolean;
  conversationId?: string;
  moveToNext: () => void;
  complete: () => void;
  setConversationId: (id: string) => void;
  onChatSubmit: (message: string) => Promise<void>;
}

export interface CommandResult {
  shouldMoveNext?: boolean;
  shouldComplete?: boolean;
}

export interface IssueTypeHandler<T extends Issue = Issue> {
  displayExplainComponent: React.ComponentType<{
    issue: T;
  }>;
  displayComponent: React.ComponentType<{
    issue: T;
    context: IssueContext;
  }>;
  getCommands: (issue: T, context: IssueContext) => IssueCommand[];
  handleCommand: (
    command: string,
    args: string,
    issue: T,
    context: IssueContext,
  ) => Promise<CommandResult>;
  getApiIssueType: (issue: T) => IssueType;
}

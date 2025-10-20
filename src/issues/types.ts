import { Discussion } from "../lib/clients/baz";

export type IssueMode = "view" | "reply";

export type Issue = {
  type: "discussion";
  data: Discussion;
};
// Future issue types can be added here:
// | { type: "ImplementationMisalignment"; data: ImplementationMisalignment }
export interface IssueContext {
  prId: string;
  currentIndex: number;
  totalIssues: number;
  hasNext: boolean;
  mode: IssueMode;
  moveToNext: () => void;
  complete: () => void;
  setIssueMode: (mode: IssueMode) => void;
}

export interface IssueInputResult {
  handled: boolean;
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
  handleInput: (
    input: string,
    issue: T,
    context: IssueContext,
  ) => Promise<IssueInputResult>;
}

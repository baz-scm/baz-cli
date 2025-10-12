import { Discussion } from "../lib/clients/baz";

// Discriminated union for type-safe issue data
export type Issue = { type: "discussion"; data: Discussion };
// Future issue types can be added here:
// | { type: "task"; data: Task }
// | { type: "bug"; data: Bug }

// Context provided to issue handlers during interaction
export interface IssueContext {
  prId: string;
  currentIndex: number;
  totalIssues: number;
  hasNext: boolean;
  moveToNext: () => void;
  complete: () => void;
}

// Result of handling input for an issue
export interface IssueInputResult {
  handled: boolean;
  shouldMoveNext?: boolean;
  shouldComplete?: boolean;
}

// Handler for a specific issue type
export interface IssueTypeHandler<T extends Issue = Issue> {
  // Component to display this issue type
  displayComponent: React.ComponentType<{
    issue: T;
    context: IssueContext;
  }>;

  // Handle keyboard input for this issue type
  // Returns whether the input was handled
  handleInput: (
    input: string,
    issue: T,
    context: IssueContext,
  ) => Promise<IssueInputResult>;
}

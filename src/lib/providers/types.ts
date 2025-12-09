export interface PullRequest {
  id: string;
  prNumber: number;
  title: string;
  description: string;
  repoId: string;
  repositoryName: string;
  updatedAt?: string;
}

export interface PullRequestDetails {
  id: string;
  pr_number: number;
  title: string;
  description?: string;
  lines_added: number;
  lines_deleted: number;
  files_changed: number;
  files_added: number;
  files_deleted: number;
  files_viewed: FileViewed[];
  spec_reviews: SpecReview[];
  author_name: string;
  reviews: CodeChangeReview[];
  repository_id: string;
}

export interface CodeChangeReview {
  review_state: string;
  assignee: string;
}

export interface FileViewed {
  path: string;
}

export interface Discussion {
  id: string;
  author: string;
  author_user?: AuthorUser;
  commit_sha: string;
  outdated: boolean;
  file?: string;
  start_line?: number;
  end_line?: number;
  comments: Comment[];
  side?: "left" | "right";
  commented_code?: string;
  original_start_line?: number;
  original_end_line?: number;
}

export interface AuthorUser {
  display_name: string;
}

export interface Comment {
  id: string;
  comment_body: string;
  body_content_type: "html" | "markdown";
  author: string;
  author_user?: AuthorUser;
}

export interface SpecReview {
  id: string;
  commitSha: string;
  status: "success" | "failed" | "in_progress" | "user_canceled";
  requirementsFound: number;
  requirementsMet: number;
  requirements: Requirement[];
  commentId: string;
  createdAt: string;
  checkRunId: string;
}

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  verdict: Verdict;
  verdict_explanation: string | null;
  evidence: string;
}

export type Verdict = "met" | "partially met" | "not met";

export type IntegrationType = "jira" | "linear" | "youtrack";

export interface Integration {
  id: string;
  integrationType: IntegrationType;
  status: string;
  updatedAt: string;
  updatedBy: string;
}

export interface User {
  login: string | undefined;
}

export interface ChangeReviewer {
  id: string;
  reviewer_type: string;
  name: string;
  login?: string;
  avatar_url?: string;
  group_members_count?: number;
}

export interface MergeStatus {
  is_mergeable: boolean;
}

export interface Line {
  number?: number;
  content?: string;
  new_line_number?: number;
  new_content?: string;
  line_type: "Added" | "Changed" | "Deleted" | "Unchanged";
}

export interface Chunk {
  lines: Line[];
  after_lines: Line[];
  before_lines: Line[];
}

export interface Diff {
  chunks: Chunk[];
  old_relative_path?: string;
  file_relative_path: string;
}

export interface FileDiff {
  prFileId: string;
  diff: Diff;
}

export interface PRContext {
  prId: string;
  fullRepoName: string;
  prNumber: number;
}

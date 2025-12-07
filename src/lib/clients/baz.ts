import { createAxiosClient } from "./axios/axios-client.js";
import { logger } from "../logger.js";
import { env } from "../env-schema.js";
import {
  ChatStreamChunk,
  ChatStreamMessage,
  CheckoutChatRequest,
} from "../../models/chat.js";

const COMMENTS_URL = `${env.BAZ_BASE_URL}/api/v1/comments`;
const PULL_REQUESTS_URL = `${env.BAZ_BASE_URL}/api/v2/changes`;
const REPOSITORIES_URL = `${env.BAZ_BASE_URL}/api/v2/repositories`;
const CHAT_URL = `${env.BAZ_BASE_URL}/api/v2/checkout/chat`;
const INTEGRATIONS_URL = `${env.BAZ_BASE_URL}/api/v2/integrations`;
const OAUTH_STATE_URL = `${env.BAZ_BASE_URL}/api/v2/integrations/state`;
const SPEC_REVIEWS_URL = `${env.BAZ_BASE_URL}/api/v2/spec-reviews`;
const USER_URL = `${env.BAZ_BASE_URL}/api/v1/auth/user`;

const getDiffUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v2/changes/${prId}/diff`;
const getDiscussionsUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}/discussions`;
const getDiscussionUrl = (discussionId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/discussions/${discussionId}`;
const getEligibleReviewersUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}/eligible-reviewers`;
const getPullRequestUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}`;

const getApprovalUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}/approve`;

const getMergeUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v2/changes/${prId}/merge`;

const axiosClient = createAxiosClient(env.BAZ_BASE_URL);

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

export interface IntegrationsResponse {
  integrations: Integration[];
}

export interface OAuthState {
  state: string;
}

export interface Repository {
  id: string;
  fullName: string;
  description?: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
}

export async function fetchUser() {
  const response = await axiosClient.get(USER_URL, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
}
export async function fetchIntegrations(): Promise<Integration[]> {
  const response = await axiosClient
    .get<IntegrationsResponse>(INTEGRATIONS_URL, {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug({ error }, "Axios error while fetching integrations");
      throw error;
    });

  return response.integrations;
}

export async function fetchOAuthState(
  integrationType: IntegrationType,
): Promise<OAuthState> {
  const response = await axiosClient.get<OAuthState>(
    `${OAUTH_STATE_URL}/${integrationType}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
}

export async function fetchRepositories(): Promise<Repository[]> {
  const repos = await axiosClient
    .get<RepositoriesResponse>(REPOSITORIES_URL, {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug({ error }, "Axios error while fetching repositories");
      throw error;
    });

  return repos.repositories;
}

export interface PullRequest {
  id: string;
  prNumber: number;
  title: string;
  description: string;
  repoId: string;
  repositoryName: string;
}

export interface PullRequestsResponse {
  changes: PullRequest[];
}

export async function fetchPRs(): Promise<PullRequest[]> {
  const repos = await axiosClient
    .get<PullRequestsResponse>(PULL_REQUESTS_URL, {
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        state: "open",
      },
      paramsSerializer: {
        indexes: null,
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching pull requests: ${error}`);
      throw error;
    });

  return repos.changes;
}

// there are more fields, if needed
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

export interface SpecReviewResult {
  summary: string;
  requirements: Requirement[];
  requirements_met: number;
  requirements_found: number;
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

export interface SpecReviewsResponse {
  specReviews: SpecReview[];
}

export async function fetchPRDetails(
  prId: string,
): Promise<PullRequestDetails> {
  return await axiosClient
    .get<PullRequestDetails>(getPullRequestUrl(prId), {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching pull requests: ${error}`);
      throw error;
    });
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

export interface DiscussionsResponse {
  discussions: Discussion[];
}

export interface ChangeReviewer {
  id: string;
  reviewer_type: string;
  name: string;
  login?: string;
  avatar_url?: string;
  group_members_count?: number;
}

export interface CodeChangeReviewersResponse {
  reviewers: ChangeReviewer[];
}

export interface MergeStatus {
  is_mergeable: boolean;
}

export async function fetchDiscussions(prId: string): Promise<Discussion[]> {
  const repos = await axiosClient
    .get<DiscussionsResponse>(getDiscussionsUrl(prId), {
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        state: "pending",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching discussions: ${error}`);
      throw error;
    });

  return repos.discussions;
}

export async function fetchEligibleReviewers(
  prId: string,
): Promise<ChangeReviewer[]> {
  const response = await axiosClient
    .get<CodeChangeReviewersResponse>(getEligibleReviewersUrl(prId), {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching eligible reviewers: ${error}`);
      throw error;
    });

  return response.reviewers;
}

export async function postDiscussionReply(
  discussionId: string,
  body: string,
  prId: string,
) {
  await axiosClient
    .post(
      COMMENTS_URL,
      {
        discussion_id: discussionId,
        body_content_type: "html",
        code_change_id: prId,
        body,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
    .catch((error: unknown) => {
      logger.debug(`Axios error while posting discussion reply: ${error}`);
      throw error;
    });
}

export async function updateDiscussionState(discussionId: string) {
  await axiosClient
    .patch(
      getDiscussionUrl(discussionId),
      {
        state: "resolved",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
    .catch((error: unknown) => {
      logger.debug(`Axios error while resolving discussion: ${error}`);
      throw error;
    });
}

export async function approvePR(prId: string) {
  await axiosClient
    .post(
      getApprovalUrl(prId),
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
    .catch((error: unknown) => {
      logger.debug(`Axios error while approving pr: ${error}`);
      throw error;
    });
}

export async function mergePR(prId: string) {
  await axiosClient
    .post(
      getMergeUrl(prId),
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
    .catch((error: unknown) => {
      logger.debug(`Axios error while merging pr: ${error}`);
      throw error;
    });
}

export async function fetchMergeStatus(prId: string): Promise<MergeStatus> {
  return await axiosClient
    .get(`${env.BAZ_BASE_URL}/api/v1/changes/${prId}/merge-status`, {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching merge status: ${error}`);
      throw error;
    });
}

export async function fetchIssues(prId: string) {
  const discussions = await fetchDiscussions(prId);
  const discussionIssues = discussions.map((discussion) => ({
    type: "discussion" as const,
    data: discussion,
  }));

  return [...discussionIssues];
}

export async function fetchSpecReviews(prId: string): Promise<SpecReview[]> {
  const response = await axiosClient
    .get<SpecReviewsResponse>(SPEC_REVIEWS_URL, {
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        prId,
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching spec reviews: ${error}`);
      throw error;
    });

  return response.specReviews;
}

export async function triggerSpecReview(
  prId: string,
  repoId: string,
): Promise<void> {
  await axiosClient
    .post(
      `${SPEC_REVIEWS_URL}/run`,
      {
        prId,
        repoId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
    .catch((error: unknown) => {
      logger.debug(`Axios error while triggering spec review: ${error}`);
      throw error;
    });
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

export interface FileDiffsResponse {
  fileDiffs: FileDiff[];
}

export async function fetchFileDiffs(
  prId: string,
  commit: string,
  files: string[],
): Promise<FileDiff[]> {
  const repos = await axiosClient
    .get<FileDiffsResponse>(getDiffUrl(prId), {
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        commit,
        files,
      },
      paramsSerializer: {
        indexes: null,
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      console.error("Axios error while fetching file diffs:", error);
      throw error;
    });

  return repos.fileDiffs;
}

function* processStreamMessage(
  message: ChatStreamMessage,
): Generator<ChatStreamChunk, void, unknown> {
  switch (message.type) {
    case "message_start":
      if (message.conversationId) {
        yield { conversationId: message.conversationId };
      }
      if (message.content) {
        yield { content: message.content };
      }
      break;
    case "message_delta":
      if (message.content) {
        yield { content: message.content };
      }
      break;
    case "message_end":
      if (message.content) {
        yield { content: message.content };
      }
      break;
    case "tool_call":
      yield {
        conversationId: message.conversationId,
        toolCall: {
          toolName: message.toolName,
          toolArgs: message.toolArgs,
          toolCallId: message.toolCallId,
        },
      };
      break;
    case "tool_call_message":
      yield {
        conversationId: message.conversationId,
        toolCall: {
          toolName: message.toolName,
          toolArgs: message.toolArgs,
          toolCallId: message.toolCallId,
          message: message.content,
        },
      };
      break;
    case "tool_result":
      yield {
        conversationId: message.conversationId,
        toolResult: {
          toolCallId: message.toolCallId,
          content: message.content,
        },
      };
      break;
  }
}

export async function* streamChatResponse(
  request: CheckoutChatRequest,
): AsyncGenerator<ChatStreamChunk, void, unknown> {
  try {
    const response = await axiosClient.post(CHAT_URL, request, {
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "stream",
    });

    let buffer = "";

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line) as ChatStreamMessage;
          yield* processStreamMessage(message);
        } catch (parseError) {
          logger.debug({ parseError, line }, "Failed to parse NDJSON line");
        }
      }
    }

    if (buffer.trim()) {
      try {
        const message = JSON.parse(buffer) as ChatStreamMessage;
        yield* processStreamMessage(message);
      } catch (parseError) {
        logger.debug({ parseError, buffer }, "Failed to parse final buffer");
      }
    }
  } catch (error: unknown) {
    logger.error({ error }, "Error streaming chat response");
    throw error;
  }
}

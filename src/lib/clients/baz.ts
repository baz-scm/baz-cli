import { createAxiosClient } from "./axios/axios-client.js";
import { logger } from "../logger.js";
import { env } from "../env-schema.js";
import {
  ChatStreamChunk,
  ChatStreamMessage,
  CheckoutChatRequest,
  ChatMessage,
  IssueType,
} from "../../models/chat.js";
import {
  ChangeReviewer,
  CodeChangeReview,
  Discussion,
  FileDiff,
  Integration,
  IntegrationType,
  MergeMethod,
  MergeStatus,
  PRRun,
  PRRunStatus,
  PullRequest,
  PullRequestDetails,
  RepoWriteAccess,
  Requirement,
  SpecReview,
} from "../providers/types.js";
import { StreamAbortError } from "../chat-stream.js";

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
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}/merge`;
const getRepoWriteAccessUrl = (fullRepoName: string) =>
  `${env.BAZ_BASE_URL}/api/v2/installations/write-access/${encodeURIComponent(fullRepoName)}`;

const axiosClient = createAxiosClient(env.BAZ_BASE_URL);

// API Response wrapper types (baz-specific)
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

export interface LatestConversation {
  id: string;
  conversationType: string;
  createdAt: string;
  userId: string;
  pullRequestId: string;
  relatedEntityId: string;
  messageCount: number;
  messages: ChatMessage[];
  newDataAvailable?: boolean;
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

export interface PullRequestsResponse {
  changes: BazPullRequest[];
  hasMore: boolean;
  page: number;
}

export interface BazPullRequest {
  id: string;
  prNumber: number;
  title: string;
  description: string;
  repositoryName: string;
  authorName: string;
  updatedAt: string;
  isMergeable: boolean | null;
  runs: PRRunResponse[];
  reviews: CodeChangeReviewResponse[];
}

export interface PRRunResponse {
  ciName: string;
  name: string;
  status: string;
  link?: string;
}

export interface CodeChangeReviewResponse {
  state: string;
  reviewer: string;
}

function mapBazRunsToPRRuns(runs: PRRunResponse[]): PRRun[] {
  return runs.map((run) => ({
    name: run.name,
    status: mapBazRunStatus(run.status),
  }));
}

function mapBazRunStatus(status: string): PRRunStatus {
  const normalized = status.toLowerCase();

  if (normalized === "skipped") {
    return "unknown";
  }

  const validStatuses: PRRunStatus[] = [
    "success",
    "failure",
    "cancelled",
    "pending",
    "unknown",
    "expected",
    "in_progress",
    "queued",
  ];

  if (validStatuses.includes(normalized as PRRunStatus)) {
    return normalized as PRRunStatus;
  }

  return "unknown";
}

function mapBazReviewsToCodeChangeReviews(
  reviews: CodeChangeReviewResponse[],
): CodeChangeReview[] {
  return reviews.map((review) => ({
    review_state: review.state.toLowerCase(),
    assignee: review.reviewer,
  }));
}

export async function fetchPRs(): Promise<PullRequest[]> {
  const changes: PullRequest[] = [];
  let resp: PullRequestsResponse = {
    changes: [],
    hasMore: false,
    page: 0,
  };
  do {
    resp = await axiosClient
      .get<PullRequestsResponse>(PULL_REQUESTS_URL, {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          state: "open",
          page: resp.page + 1,
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
    changes.push(
      ...resp.changes.map((change) => ({
        id: change.id,
        prNumber: change.prNumber,
        title: change.title,
        description: change.description,
        repoId: change.repositoryName,
        repositoryName: change.repositoryName,
        authorName: change.authorName,
        updatedAt: change.updatedAt,
        mergeable: change.isMergeable,
        runs: mapBazRunsToPRRuns(change.runs ?? []),
        reviews: mapBazReviewsToCodeChangeReviews(change.reviews),
      })),
    );
  } while (resp.hasMore);

  return changes;
}

// API Response wrapper types
export interface SpecReviewResult {
  summary: string;
  requirements: Requirement[];
  requirements_met: number;
  requirements_found: number;
}

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

export interface DiscussionsResponse {
  discussions: Discussion[];
}

export interface CodeChangeReviewersResponse {
  reviewers: ChangeReviewer[];
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

export async function mergePR(prId: string, mergeStrategy: MergeMethod) {
  await axiosClient
    .post(
      getMergeUrl(prId),
      {
        merge_strategy: mergeStrategy,
      },
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
    .then((value) => ({
      is_mergeable: value.data.is_mergeable,
      merge_strategy: value.data.default_merge_strategy,
    }))
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

export async function fetchLatestConversation(
  prId: string,
  conversationType: IssueType,
): Promise<LatestConversation | null> {
  try {
    const response = await axiosClient.get<LatestConversation>(
      `${env.BAZ_BASE_URL}/api/v2/checkout/conversations/latest`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          prId,
          conversationType,
        },
      },
    );
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
    }
    logger.debug(`Error while fetching latest conversation: ${error}`);
    return null;
  }
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

export async function fetchRepoWriteAccess(
  fullRepoName: string,
): Promise<RepoWriteAccess> {
  const resp = await axiosClient
    .get<RepoWriteAccess>(getRepoWriteAccessUrl(fullRepoName), {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      logger.debug(`Axios error while fetching repo write access: ${error}`);
      throw error;
    });

  return resp;
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
  abortSignal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk, void, unknown> {
  try {
    const response = await axiosClient.post(CHAT_URL, request, {
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "stream",
      signal: abortSignal,
    });

    let buffer = "";

    for await (const chunk of response.data) {
      // Check if aborted before processing chunk
      if (abortSignal?.aborted) {
        throw new StreamAbortError();
      }

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
    // Don't log abort errors as errors - they're expected
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "CanceledError"
    ) {
      logger.debug("Chat stream aborted by user");
      throw error; // Re-throw so processStream can handle it
    }
    logger.error({ error }, "Error streaming chat response");
    throw error;
  }
}

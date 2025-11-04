import { createAxiosClient } from "./axios/axios-client";
import { logger } from "../logger";
import { env } from "../env-schema";
import {
  CheckoutChatRequest,
  ChatStreamMessage,
  ChatStreamChunk,
} from "../../models/chat";

const COMMENTS_URL = `${env.BAZ_BASE_URL}/api/v1/comments`;
const PULL_REQUESTS_URL = `${env.BAZ_BASE_URL}/api/v2/changes`;
const REPOSITORIES_URL = `${env.BAZ_BASE_URL}/api/v2/repositories`;
const CHAT_URL = `${env.BAZ_BASE_URL}/api/v2/checkout/chat`;

const getDiffUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v2/changes/${prId}/diff`;
const getDiscussionsUrl = (prId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/changes/${prId}/discussions`;
const getDiscussionUrl = (discussionId: string) =>
  `${env.BAZ_BASE_URL}/api/v1/discussions/${discussionId}`;

const axiosClient = createAxiosClient(env.BAZ_BASE_URL);
export interface Repository {
  id: string;
  fullName: string;
  description?: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
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
  description?: string;
}

export interface PullRequestsResponse {
  changes: PullRequest[];
}

export async function fetchPRs(repoId: string): Promise<PullRequest[]> {
  const repos = await axiosClient
    .get<PullRequestsResponse>(PULL_REQUESTS_URL, {
      headers: {
        "Content-Type": "application/json",
      },
      // TODO: fix the extra repo ID needed here or adjust the API to allow both string and array of strings
      params: {
        repositories: ["00000000-0000-0000-0000-000000000000", repoId],
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

export async function fetchIssues(prId: string) {
  const discussions = await fetchDiscussions(prId);
  const discussionIssues = discussions.map((discussion) => ({
    type: "discussion" as const,
    data: discussion,
  }));

  return [...discussionIssues];
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

          if (message.type === "message_start" && message.conversationId) {
            yield { conversationId: message.conversationId };
          } else if (message.type === "message_delta" && message.content) {
            yield { content: message.content };
          }
        } catch (parseError) {
          logger.debug({ parseError, line }, "Failed to parse NDJSON line");
        }
      }
    }

    if (buffer.trim()) {
      try {
        const message = JSON.parse(buffer) as ChatStreamMessage;
        if (message.type === "message_start" && message.conversationId) {
          yield { conversationId: message.conversationId };
        } else if (message.type === "message_delta" && message.content) {
          yield { content: message.content };
        }
      } catch (parseError) {
        logger.debug({ parseError, buffer }, "Failed to parse final buffer");
      }
    }
  } catch (error: unknown) {
    logger.error({ error }, "Error streaming chat response");
    throw error;
  }
}

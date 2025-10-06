import axios from "axios";
import axiosRetry from "axios-retry";
import { OAuthFlow } from "../../auth/oauth-flow";

const BASE_URL = process.env.BASE_URL
  ? process.env.BASE_URL
  : "https://main.baz.ninja";
const COMMENTS_URL = `${BASE_URL}/api/v1/comments`;
const PULL_REQUESTS_URL = `${BASE_URL}/api/v2/changes`;
const REPOSITORIES_URL = `${BASE_URL}/api/v2/repositories`;

const getDiscussionsUrl = (prId: string) =>
  `${BASE_URL}/api/v1/changes/${prId}/discussions`;
const getDiscussionUrl = (discussionId: string) =>
  `${BASE_URL}/api/v1/discussions/${discussionId}`;

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export interface Repository {
  id: string;
  fullName: string;
  description?: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
}

export async function fetchRepositories(): Promise<Repository[]> {
  const token = OAuthFlow.getInstance().getAccessToken();

  const repos = await axios
    .get<RepositoriesResponse>(REPOSITORIES_URL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      console.error("Axios error while fetching repositories:", error);
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
  const token = OAuthFlow.getInstance().getAccessToken();

  const repos = await axios
    .get<PullRequestsResponse>(PULL_REQUESTS_URL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
      console.error("Axios error while fetching pull requests:", error);
      throw error;
    });

  return repos.changes;
}

export interface Discussion {
  id: string;
  author: string;
  author_user?: AuthorUser;
  outdated: boolean;
  file?: string;
  start_line?: number;
  end_line?: number;
  comments: Comment[];
  side?: "left" | "right";
  commented_code?: string;
}

export interface AuthorUser {
  display_name: string;
}

export interface Comment {
  id: string;
  comment_body: string;
  author: string;
  author_user?: AuthorUser;
}

export interface DiscussionsResponse {
  discussions: Discussion[];
}

export async function fetchDiscussions(prId: string): Promise<Discussion[]> {
  const token = OAuthFlow.getInstance().getAccessToken();

  const repos = await axios
    .get<DiscussionsResponse>(getDiscussionsUrl(prId), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      params: {
        state: "pending",
      },
    })
    .then((value) => value.data)
    .catch((error: unknown) => {
      console.error("Axios error while fetching discussions:", error);
      throw error;
    });

  return repos.discussions;
}

export async function postDiscussionReply(
  discussionId: string,
  body: string,
  prId: string,
) {
  const token = OAuthFlow.getInstance().getAccessToken();

  await axios
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
          Authorization: `Bearer ${token}`,
        },
      },
    )
    .catch((error: unknown) => {
      console.error("Axios error while posting discussion reply:", error);
      throw error;
    });
}

export async function updateDiscussionState(discussionId: string) {
  const token = OAuthFlow.getInstance().getAccessToken();

  await axios
    .patch(
      getDiscussionUrl(discussionId),
      {
        state: "resolved",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    )
    .catch((error: unknown) => {
      console.error("Axios error while resolving discussion:", error);
      throw error;
    });
}

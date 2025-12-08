import { Octokit } from "octokit";
import { env } from "../env-schema.js";
import { logger } from "../logger.js";
import type { PullRequestData } from "../providers/types.js";

let octokitClient: Octokit | null = null;

function getOctokitClient(): Octokit {
  if (!octokitClient) {
    if (!env.GH_TOKEN) {
      throw new Error("GH_TOKEN is required for GitHub API calls");
    }
    octokitClient = new Octokit({ auth: env.GH_TOKEN });
  }
  return octokitClient;
}

export async function fetchOpenPullRequests(): Promise<PullRequestData[]> {
  const octokit = getOctokitClient();

  try {
    // Step 1: Fetch all repositories the user has access to
    const repos = await octokit.paginate(
      octokit.rest.repos.listForAuthenticatedUser,
      {
        visibility: "all",
        sort: "updated",
        per_page: 100,
      },
    );

    const pullRequests: PullRequestData[] = [];

    // Step 2: Fetch open PRs from each repository
    for (const repo of repos) {
      try {
        const prs = await octokit.paginate(octokit.rest.pulls.list, {
          owner: repo.owner.login,
          repo: repo.name,
          state: "open",
          sort: "updated",
          direction: "desc",
          per_page: 100,
        });

        for (const pr of prs) {
          pullRequests.push({
            id: pr.id.toString(),
            prNumber: pr.number,
            title: pr.title,
            description: pr.body ?? "",
            repoId: `${repo.owner.login}/${repo.name}`,
            repositoryName: repo.full_name,
            updatedAt: pr.updated_at,
          });
        }
      } catch (repoError) {
        // Log but continue if we fail to fetch PRs for a specific repo
        logger.warn(
          { repo: repo.full_name, error: repoError },
          "Failed to fetch PRs for repository",
        );
      }
    }

    // Sort all PRs by updated date (most recent first)
    pullRequests.sort(
      (a, b) => b.updatedAt?.localeCompare(a.updatedAt ?? "") ?? 0,
    );

    return pullRequests;
  } catch (error) {
    logger.error({ error }, "Error fetching pull requests from GitHub");
    throw error;
  }
}

export function resetOctokitClient(): void {
  octokitClient = null;
}

function parseRepoId(repoId: string): { owner: string; repo: string } {
  const [owner, repo] = repoId.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repoId format: ${repoId}. Expected "owner/repo"`);
  }
  return { owner, repo };
}

export interface GitHubPullRequestDetails {
  id: number;
  number: number;
  title: string;
  body: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  files_added: number;
  files_deleted: number;
  user: { login: string } | null;
  mergeable: boolean | null;
  reviews: Array<{
    state: string;
    user: { login: string } | null;
  }>;
}

export async function fetchPullRequestDetails(
  repoId: string,
  prNumber: number,
): Promise<GitHubPullRequestDetails> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(repoId);

  try {
    const [prResponse, reviewsResponse, files] = await Promise.all([
      octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      }),
      octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      }),
      octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      }),
    ]);

    // Count files by status
    const filesAdded = files.filter((f) => f.status === "added").length;
    const filesDeleted = files.filter((f) => f.status === "removed").length;

    return {
      id: prResponse.data.id,
      number: prResponse.data.number,
      title: prResponse.data.title,
      body: prResponse.data.body,
      additions: prResponse.data.additions,
      deletions: prResponse.data.deletions,
      changed_files: prResponse.data.changed_files,
      files_added: filesAdded,
      files_deleted: filesDeleted,
      user: prResponse.data.user,
      mergeable: prResponse.data.mergeable,
      reviews: reviewsResponse.data.map((review) => ({
        state: review.state,
        user: review.user,
      })),
    };
  } catch (error) {
    logger.error({ error, repoId, prNumber }, "Error fetching PR details from GitHub");
    throw error;
  }
}

export interface GitHubReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: "LEFT" | "RIGHT";
  comments: Array<{
    id: string;
    body: string;
    author: string | null;
    createdAt: string;
  }>;
}

interface GraphQLReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{
          id: string;
          isResolved: boolean;
          isOutdated: boolean;
          path: string;
          line: number | null;
          startLine: number | null;
          diffSide: "LEFT" | "RIGHT";
          comments: {
            nodes: Array<{
              id: string;
              body: string;
              author: { login: string } | null;
              createdAt: string;
            }>;
          };
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    };
  };
}

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $prNumber: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100, after: $cursor) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            startLine
            diffSide
            comments(first: 100) {
              nodes {
                id
                body
                author { login }
                createdAt
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export async function fetchUnresolvedReviewThreads(
  repoId: string,
  prNumber: number,
): Promise<GitHubReviewThread[]> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(repoId);

  try {
    const allThreads: GitHubReviewThread[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response: GraphQLReviewThreadsResponse = await octokit.graphql(
        REVIEW_THREADS_QUERY,
        {
          owner,
          repo,
          prNumber,
          cursor,
        },
      );

      const threads = response.repository.pullRequest.reviewThreads.nodes;

      for (const thread of threads) {
        if (!thread.isResolved) {
          allThreads.push({
            id: thread.id,
            isResolved: thread.isResolved,
            isOutdated: thread.isOutdated,
            path: thread.path,
            line: thread.line,
            startLine: thread.startLine,
            diffSide: thread.diffSide,
            comments: thread.comments.nodes.map((comment) => ({
              id: comment.id,
              body: comment.body,
              author: comment.author?.login ?? null,
              createdAt: comment.createdAt,
            })),
          });
        }
      }

      hasNextPage = response.repository.pullRequest.reviewThreads.pageInfo.hasNextPage;
      cursor = response.repository.pullRequest.reviewThreads.pageInfo.endCursor;
    }

    return allThreads;
  } catch (error) {
    logger.error({ error, repoId, prNumber }, "Error fetching review threads from GitHub");
    throw error;
  }
}

export async function approvePullRequest(
  repoId: string,
  prNumber: number,
): Promise<void> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(repoId);

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "APPROVE",
    });
  } catch (error) {
    logger.error({ error, repoId, prNumber }, "Error approving PR on GitHub");
    throw error;
  }
}

export async function mergePullRequest(
  repoId: string,
  prNumber: number,
): Promise<void> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(repoId);

  try {
    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
    });
  } catch (error) {
    logger.error({ error, repoId, prNumber }, "Error merging PR on GitHub");
    throw error;
  }
}

export interface GitHubMergeStatus {
  mergeable: boolean | null;
  mergeable_state: string;
}

export async function fetchMergeStatus(
  repoId: string,
  prNumber: number,
): Promise<GitHubMergeStatus> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(repoId);

  try {
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      mergeable: response.data.mergeable,
      mergeable_state: response.data.mergeable_state,
    };
  } catch (error) {
    logger.error({ error, repoId, prNumber }, "Error fetching merge status from GitHub");
    throw error;
  }
}

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
}

export async function fetchAuthenticatedUser(): Promise<GitHubUser> {
  const octokit = getOctokitClient();

  try {
    const response = await octokit.rest.users.getAuthenticated();
    return {
      login: response.data.login,
      id: response.data.id,
      name: response.data.name,
    };
  } catch (error) {
    logger.error({ error }, "Error fetching authenticated user from GitHub");
    throw error;
  }
}

import { Octokit } from "octokit";
import { env } from "../env-schema.js";
import { logger } from "../logger.js";
import type {
  PullRequest,
  Line,
  Chunk,
  FileDiff,
  MergeMethod,
  MergeStatus,
} from "../providers/types.js";

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

export async function fetchOpenPullRequests(): Promise<PullRequest[]> {
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

    const pullRequests: PullRequest[] = [];

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

function parseRepoId(fullRepoName: string): { owner: string; repo: string } {
  const [owner, repo] = fullRepoName.split("/");
  if (!owner || !repo) {
    throw new Error(
      `Invalid fullRepoName format: ${fullRepoName}. Expected "owner/repo"`,
    );
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
  fullRepoName: string,
  prNumber: number,
): Promise<GitHubPullRequestDetails> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

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
    logger.error(
      { error, fullRepoName, prNumber },
      "Error fetching PR details from GitHub",
    );
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
  originalCommitOid: string;
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
              originalCommit: { oid: string } | null;
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
                originalCommit { oid }
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
  fullRepoName: string,
  prNumber: number,
): Promise<GitHubReviewThread[]> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

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
          // Get the commit from the first comment (where the thread was originally created)
          const firstComment = thread.comments.nodes[0];
          allThreads.push({
            id: thread.id,
            isResolved: thread.isResolved,
            isOutdated: thread.isOutdated,
            path: thread.path,
            line: thread.line,
            startLine: thread.startLine,
            diffSide: thread.diffSide,
            originalCommitOid: firstComment?.originalCommit?.oid ?? "",
            comments: thread.comments.nodes.map((comment) => ({
              id: comment.id,
              body: comment.body,
              author: comment.author?.login ?? null,
              createdAt: comment.createdAt,
            })),
          });
        }
      }

      hasNextPage =
        response.repository.pullRequest.reviewThreads.pageInfo.hasNextPage;
      cursor = response.repository.pullRequest.reviewThreads.pageInfo.endCursor;
    }

    return allThreads;
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber },
      "Error fetching review threads from GitHub",
    );
    throw error;
  }
}

export async function postReviewThreadReply(
  fullRepoName: string,
  prNumber: number,
  threadId: string,
  body: string,
) {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    await octokit.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      body,
      in_reply_to: Number(threadId),
      commit_id: "", // values are required but ignored
      path: "", // values are required but ignored
    });
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber },
      "Error replying to review comment on GitHub",
    );
    throw error;
  }
}

export async function approvePullRequest(
  fullRepoName: string,
  prNumber: number,
): Promise<void> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "APPROVE",
    });
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber },
      "Error approving PR on GitHub",
    );
    throw error;
  }
}

async function getRepoAllowedMergeMethod(
  owner: string,
  repo: string,
): Promise<MergeMethod> {
  const octokit = getOctokitClient();

  const response = await octokit.rest.repos.get({ owner, repo });
  const repoData = response.data;

  if (repoData.allow_squash_merge) {
    return "squash";
  }
  if (repoData.allow_merge_commit) {
    return "merge";
  }
  if (repoData.allow_rebase_merge) {
    return "rebase";
  }

  return "merge";
}

export async function mergePullRequest(
  fullRepoName: string,
  prNumber: number,
  mergeStrategy: MergeMethod,
): Promise<void> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: mergeStrategy,
    });
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber },
      "Error merging PR on GitHub",
    );
    throw error;
  }
}

export async function fetchMergeStatus(
  fullRepoName: string,
  prNumber: number,
): Promise<MergeStatus> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    const [prResponse, mergeStrategy] = await Promise.all([
      octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      }),
      getRepoAllowedMergeMethod(owner, repo),
    ]);

    return {
      is_mergeable: prResponse.data.mergeable ?? false,
      merge_strategy: mergeStrategy,
    };
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber },
      "Error fetching merge status from GitHub",
    );
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

/**
 * Parse a unified diff patch string into structured chunks
 */
function parsePatch(patch: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = patch.split("\n");

  let currentChunk: Chunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let inBeforeContext = true;
  let beforeContextLines: Line[] = [];
  let afterContextLines: Line[] = [];

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      // Save previous chunk
      if (currentChunk) {
        currentChunk.after_lines = afterContextLines;
        chunks.push(currentChunk);
      }

      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[2], 10);
      currentChunk = {
        lines: [],
        before_lines: [],
        after_lines: [],
      };
      inBeforeContext = true;
      beforeContextLines = [];
      afterContextLines = [];
      continue;
    }

    if (!currentChunk) continue;

    const prefix = line[0];
    const content = line.slice(1);

    if (prefix === "-") {
      // Deleted line
      inBeforeContext = false;
      currentChunk.before_lines = beforeContextLines;
      beforeContextLines = [];

      currentChunk.lines.push({
        number: oldLineNum,
        content: content,
        line_type: "Deleted",
      });
      oldLineNum++;
    } else if (prefix === "+") {
      // Added line
      inBeforeContext = false;
      currentChunk.before_lines = beforeContextLines;
      beforeContextLines = [];

      currentChunk.lines.push({
        new_line_number: newLineNum,
        new_content: content,
        line_type: "Added",
      });
      newLineNum++;
    } else if (prefix === " " || prefix === undefined) {
      // Context line (unchanged)
      const contextLine: Line = {
        number: oldLineNum,
        content: content,
        new_line_number: newLineNum,
        new_content: content,
        line_type: "Unchanged",
      };

      if (inBeforeContext) {
        beforeContextLines.push(contextLine);
      } else if (currentChunk.lines.length > 0) {
        // After the changed lines, collect as after_lines
        afterContextLines.push(contextLine);
      }

      oldLineNum++;
      newLineNum++;
    }
  }

  // Save the last chunk
  if (currentChunk) {
    currentChunk.after_lines = afterContextLines;
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Fetch file diffs for specific files at a specific commit.
 * Uses the compare API to get diffs between the PR's base branch and the commit,
 * which ensures we get file diffs even if the file wasn't modified in that specific commit.
 */
export async function fetchFileDiffs(
  fullRepoName: string,
  prNumber: number,
  commit: string,
  files: string[],
): Promise<FileDiff[]> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    // First, get the PR to find the base branch
    const prResponse = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const baseBranch = prResponse.data.base.ref;

    // Use compare API to get diffs between base branch and the commit
    // This includes all files that differ, not just files changed in that specific commit
    const response = await octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${baseBranch}...${commit}`,
    });

    const fileDiffs: FileDiff[] = [];

    for (const file of response.data.files ?? []) {
      // Only include requested files
      if (!files.includes(file.filename)) {
        continue;
      }

      const chunks = file.patch ? parsePatch(file.patch) : [];

      fileDiffs.push({
        prFileId: `${commit}-${file.filename}`,
        diff: {
          chunks,
          file_relative_path: file.filename,
          old_relative_path:
            file.previous_filename !== file.filename
              ? file.previous_filename
              : undefined,
        },
      });
    }

    return fileDiffs;
  } catch (error) {
    logger.error(
      { error, fullRepoName, prNumber, commit, files },
      "Error fetching file diffs from GitHub",
    );
    throw error;
  }
}

export interface GitHubAssignee {
  id: number;
  login: string;
  avatar_url: string;
  type: string;
}

/**
 * Fetch users who can be assigned to issues/PRs in a repository
 */
export async function fetchAssignees(
  fullRepoName: string,
): Promise<GitHubAssignee[]> {
  const octokit = getOctokitClient();
  const { owner, repo } = parseRepoId(fullRepoName);

  try {
    const assignees = await octokit.paginate(
      octokit.rest.issues.listAssignees,
      {
        owner,
        repo,
        per_page: 100,
      },
    );

    return assignees.map((assignee) => ({
      id: assignee.id,
      login: assignee.login,
      avatar_url: assignee.avatar_url,
      type: assignee.type ?? "User",
    }));
  } catch (error) {
    logger.error(
      { error, fullRepoName },
      "Error fetching assignees from GitHub",
    );
    throw error;
  }
}

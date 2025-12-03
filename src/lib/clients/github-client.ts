import { Octokit } from "@octokit/rest";
import { logger } from "../logger.js";
import { env } from "../env-schema.js";
import {
  Repository,
  PullRequest,
  PullRequestDetails,
  Discussion,
  ChangeReviewer,
  FileDiff,
  MergeStatus,
  Diff,
  Chunk,
  Line,
} from "./baz.js";

let octokitInstance: Octokit | null = null;

// Cache to store PR metadata for routing GitHub API calls
interface PRMetadata {
  owner: string;
  repo: string;
  prNumber: number;
  repoId: string;
}

const prMetadataCache = new Map<string, PRMetadata>();

export function cachePRMetadata(prId: string, metadata: PRMetadata): void {
  prMetadataCache.set(prId, metadata);
}

export function getPRMetadata(prId: string): PRMetadata | undefined {
  return prMetadataCache.get(prId);
}

function getOctokit(): Octokit {
  if (!env.GITHUB_PAT) {
    throw new Error("GITHUB_PAT is not set");
  }

  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: env.GITHUB_PAT,
    });
  }

  return octokitInstance;
}

export async function fetchRepositoriesFromGitHub(): Promise<Repository[]> {
  try {
    const octokit = getOctokit();

    // Fetch all repositories accessible with the PAT
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
    });

    return repos.map((repo) => ({
      id: repo.id.toString(),
      fullName: repo.full_name,
      description: repo.description || undefined,
    }));
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching repositories");
    throw error;
  }
}

export async function fetchPRsFromGitHub(): Promise<PullRequest[]> {
  try {
    const octokit = getOctokit();
    const repos = await fetchRepositoriesFromGitHub();

    const allPRs: PullRequest[] = [];

    // Fetch open PRs for each repository
    for (const repo of repos) {
      try {
        const [owner, repoName] = repo.fullName.split("/");
        const { data: pulls } = await octokit.rest.pulls.list({
          owner,
          repo: repoName,
          state: "open",
          per_page: 100,
        });

        const prs = pulls.map((pr) => {
          const prData = {
            id: pr.id.toString(),
            prNumber: pr.number,
            title: pr.title,
            description: pr.body || "",
            repoId: repo.id,
            repositoryName: repo.fullName,
          };

          // Cache the PR metadata for later use
          cachePRMetadata(prData.id, {
            owner,
            repo: repoName,
            prNumber: pr.number,
            repoId: repo.id,
          });

          return prData;
        });

        allPRs.push(...prs);
      } catch (repoError: unknown) {
        // Skip repos where we can't fetch PRs (might not have access)
        logger.debug({ error: repoError, repo: repo.fullName }, "Failed to fetch PRs for repo");
      }
    }

    return allPRs;
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching pull requests");
    throw error;
  }
}

export async function fetchPRDetailsFromGitHub(
  prId: string,
): Promise<PullRequestDetails> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}. Call fetchPRsFromGitHub first.`);
    }

    const { owner, repo, prNumber } = metadata;

    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      id: prId,
      pr_number: pr.number,
      title: pr.title,
      description: pr.body || undefined,
      lines_added: pr.additions,
      lines_deleted: pr.deletions,
      files_changed: pr.changed_files,
      files_added: files.filter((f) => f.status === "added").length,
      files_deleted: files.filter((f) => f.status === "removed").length,
      files_viewed: files.map((f) => ({ path: f.filename })),
      spec_reviews: [], // Not available via GitHub API
      author_name: pr.user?.login || "unknown",
      reviews: reviews.map((r) => ({
        review_state: r.state,
        assignee: r.user?.login || "unknown",
      })),
      repository_id: prId, // Using prId as placeholder
    };
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching PR details");
    throw error;
  }
}

export async function fetchDiscussionsFromGitHub(
  prId: string,
): Promise<Discussion[]> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo, prNumber } = metadata;

    // Fetch review comments (inline code comments)
    const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Transform review comments to Discussion format
    const discussions: Discussion[] = reviewComments.map((comment) => ({
      id: comment.id.toString(),
      author: comment.user?.login || "unknown",
      author_user: comment.user?.login
        ? { display_name: comment.user.login }
        : undefined,
      commit_sha: comment.commit_id,
      outdated: comment.position === null, // Outdated if position is null
      file: comment.path,
      start_line: comment.start_line || comment.line || undefined,
      end_line: comment.line || undefined,
      side: comment.side === "LEFT" ? "left" : "right",
      commented_code: undefined,
      original_start_line: comment.original_start_line || undefined,
      original_end_line: comment.original_line || undefined,
      comments: [
        {
          id: comment.id.toString(),
          comment_body: comment.body,
          body_content_type: "markdown",
          author: comment.user?.login || "unknown",
          author_user: comment.user?.login
            ? { display_name: comment.user.login }
            : undefined,
        },
      ],
    }));

    return discussions;
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching discussions");
    throw error;
  }
}

export async function fetchEligibleReviewersFromGitHub(
  prId: string,
): Promise<ChangeReviewer[]> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo } = metadata;

    // Fetch collaborators who can review
    const { data: collaborators } = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
      per_page: 100,
    });

    return collaborators.map((user) => ({
      id: user.id.toString(),
      reviewer_type: "user",
      name: user.login,
      login: user.login,
      avatar_url: user.avatar_url,
    }));
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching eligible reviewers");
    throw error;
  }
}

export async function fetchFileDiffsFromGitHub(
  prId: string,
  commit: string,
  files: string[],
): Promise<FileDiff[]> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo } = metadata;
    const fileDiffs: FileDiff[] = [];

    for (const file of files) {
      try {
        // Fetch the file comparison
        const { data: comparison } = await octokit.rest.repos.compareCommits({
          owner,
          repo,
          base: `${commit}^`,
          head: commit,
        });

        const fileData = comparison.files?.find((f) => f.filename === file);
        if (!fileData) continue;

        // Parse the patch to create chunks
        const chunks: Chunk[] = [];
        if (fileData.patch) {
          const lines: Line[] = fileData.patch.split("\n").map((line, idx) => {
            let line_type: "Added" | "Changed" | "Deleted" | "Unchanged";
            if (line.startsWith("+")) {
              line_type = "Added";
            } else if (line.startsWith("-")) {
              line_type = "Deleted";
            } else {
              line_type = "Unchanged";
            }

            return {
              number: idx + 1,
              content: line,
              line_type,
            };
          });

          chunks.push({
            lines,
            before_lines: [],
            after_lines: [],
          });
        }

        const diff: Diff = {
          file_relative_path: fileData.filename,
          old_relative_path: fileData.previous_filename,
          chunks,
        };

        fileDiffs.push({
          prFileId: file,
          diff,
        });
      } catch (fileError: unknown) {
        logger.debug({ error: fileError, file }, "Failed to fetch diff for file");
      }
    }

    return fileDiffs;
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching file diffs");
    throw error;
  }
}

export async function fetchMergeStatusFromGitHub(
  prId: string,
): Promise<MergeStatus> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo, prNumber } = metadata;

    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      is_mergeable: pr.mergeable ?? false,
    };
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while fetching merge status");
    throw error;
  }
}

export async function postDiscussionReplyToGitHub(
  discussionId: string,
  body: string,
  prId: string,
): Promise<void> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo, prNumber } = metadata;

    await octokit.rest.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: parseInt(discussionId),
      body,
    });
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while posting discussion reply");
    throw error;
  }
}

export async function approvePROnGitHub(
  prId: string,
): Promise<void> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo, prNumber } = metadata;

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "APPROVE",
    });
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while approving PR");
    throw error;
  }
}

export async function mergePROnGitHub(
  prId: string,
): Promise<void> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo, prNumber } = metadata;

    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
    });
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while merging PR");
    throw error;
  }
}

export async function updateDiscussionStateOnGitHub(
  discussionId: string,
  prId: string,
): Promise<void> {
  try {
    const octokit = getOctokit();
    const metadata = getPRMetadata(prId);

    if (!metadata) {
      throw new Error(`PR metadata not found for prId: ${prId}`);
    }

    const { owner, repo } = metadata;

    // GitHub doesn't have a direct "resolve" API for review comments
    // We can use reactions to indicate resolution
    await octokit.rest.reactions.createForPullRequestReviewComment({
      owner,
      repo,
      comment_id: parseInt(discussionId),
      content: "+1",
    });
  } catch (error: unknown) {
    logger.error({ error }, "GitHub API error while resolving discussion");
    throw error;
  }
}

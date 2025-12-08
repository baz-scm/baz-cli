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

export interface GitHubPullRequestDetails {
  id: number;
  number: number;
  title: string;
  url: string;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

export async function fetchPullRequestDetails(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubPullRequestDetails> {
  const octokit = getOctokitClient();

  try {
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      url: response.data.html_url,
      filesChanged: response.data.changed_files ?? 0,
      linesAdded: response.data.additions ?? 0,
      linesDeleted: response.data.deletions ?? 0,
    };
  } catch (error) {
    logger.error(
      { error, owner, repo, pullNumber },
      "Error fetching pull request details from GitHub",
    );
    throw error;
  }
}

export function resetOctokitClient(): void {
  octokitClient = null;
}

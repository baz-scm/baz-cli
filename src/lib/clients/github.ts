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

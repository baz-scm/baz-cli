import {
  AppConfig,
  AppMode,
  getAppConfig,
} from "../lib/config/app-mode.js";
import { fetchPRDetails } from "../lib/clients/baz.js";
import { fetchPullRequestDetails } from "../lib/clients/github.js";
import { PullRequestData } from "../lib/providers/types.js";

export type HeadlessRunMode = "baz" | "tokens";

export interface HeadlessRunOptions {
  repo?: string; // "owner/name"
  prNumber?: number;
  runSpec: boolean;
  runSummary: boolean;
  mode: HeadlessRunMode; // derived from getAppConfig
}

export interface HeadlessSpecSummary {
  supported: boolean;
  latestStatus?: "success" | "in_progress" | "failed" | "not_found";
  unmetRequirements: number;
  metRequirements: number;
}

export interface HeadlessSummary {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface HeadlessReviewResult {
  pr: {
    id: string;
    number: number;
    title: string;
    url?: string;
    repository: string; // "owner/name"
  };
  spec?: HeadlessSpecSummary;
  summary?: HeadlessSummary;
}

export interface HeadlessReviewDependencies {
  fetchBazPRDetails?: typeof fetchPRDetails;
  fetchGithubPRDetails?: typeof fetchPullRequestDetails;
}

function sortByMostRecent(pullRequests: PullRequestData[]): PullRequestData[] {
  return [...pullRequests].sort((a, b) => {
    if (a.updatedAt && b.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }

    if (a.updatedAt) {
      return -1;
    }

    if (b.updatedAt) {
      return 1;
    }

    return 0;
  });
}

function parseRepoIdentifier(pr: PullRequestData): string {
  if (pr.repositoryName?.includes("/")) {
    return pr.repositoryName;
  }

  if (pr.repoId.includes("/")) {
    return pr.repoId;
  }

  return pr.repoId;
}

function selectPullRequests(
  pullRequests: PullRequestData[],
  repo?: string,
  prNumber?: number,
): PullRequestData[] {
  const sorted = sortByMostRecent(pullRequests);

  const repoFiltered = repo
    ? sorted.filter(
        (pr) => pr.repositoryName === repo || pr.repoId === repo,
      )
    : sorted;

  const prFiltered =
    prNumber !== undefined
      ? repoFiltered.filter((pr) => pr.prNumber === prNumber)
      : repoFiltered;

  if (prFiltered.length === 0) {
    const scopeDescription = repo
      ? `repository ${repo}${prNumber ? ` and PR #${prNumber}` : ""}`
      : prNumber
        ? `PR #${prNumber}`
        : "any open pull requests";
    throw new Error(`No matching pull requests found for ${scopeDescription}`);
  }

  if (!repo && prNumber === undefined) {
    const seen = new Map<string, PullRequestData>();

    for (const pr of prFiltered) {
      const repoKey = pr.repositoryName ?? pr.repoId;
      if (!seen.has(repoKey)) {
        seen.set(repoKey, pr);
      }
    }

    return Array.from(seen.values());
  }

  return [prFiltered[0]];
}

function mapSpecStatus(status: string): HeadlessSpecSummary["latestStatus"] {
  if (status === "success" || status === "in_progress") {
    return status;
  }

  if (status === "failed") {
    return "failed";
  }

  return "failed";
}

async function fetchBazModeResult(
  options: HeadlessRunOptions,
  mode: AppMode,
  fetchBazDetails: typeof fetchPRDetails,
): Promise<HeadlessReviewResult[]> {
  const pullRequests = await mode.dataProvider.fetchPRs();
  const targets = selectPullRequests(
    pullRequests,
    options.repo,
    options.prNumber,
  );

  const results: HeadlessReviewResult[] = [];

  for (const pullRequest of targets) {
    const prDetails = await fetchBazDetails(pullRequest.id);

    const result: HeadlessReviewResult = {
      pr: {
        id: prDetails.id,
        number: prDetails.pr_number,
        title: prDetails.title,
        repository: parseRepoIdentifier(pullRequest),
      },
    };

    if (options.runSummary) {
      result.summary = {
        filesChanged: prDetails.files_changed,
        linesAdded: prDetails.lines_added,
        linesDeleted: prDetails.lines_deleted,
      };
    }

    if (options.runSpec) {
      const specReviews = await mode.dataProvider.fetchSpecReviews(prDetails.id);

      if (!specReviews) {
        result.spec = {
          supported: false,
          latestStatus: "not_found",
          unmetRequirements: 0,
          metRequirements: 0,
        };
      } else {
        const latestSpecReview = specReviews.at(-1);

        if (!latestSpecReview) {
          result.spec = {
            supported: true,
            latestStatus: "not_found",
            unmetRequirements: 0,
            metRequirements: 0,
          };
        } else {
          const unmetRequirements = latestSpecReview.requirements.filter(
            (req) => req.verdict !== "met",
          ).length;
          const metRequirements = latestSpecReview.requirements.filter(
            (req) => req.verdict === "met",
          ).length;

          result.spec = {
            supported: true,
            latestStatus: mapSpecStatus(latestSpecReview.status),
            unmetRequirements,
            metRequirements,
          };
        }
      }
    }

    results.push(result);
  }

  return results;
}

async function fetchTokensModeResult(
  options: HeadlessRunOptions,
  dataProvider: AppMode["dataProvider"],
  fetchGithubDetails: typeof fetchPullRequestDetails,
): Promise<HeadlessReviewResult[]> {
  const pullRequests = await dataProvider.fetchPRs();
  const targets = selectPullRequests(
    pullRequests,
    options.repo,
    options.prNumber,
  );

  const results: HeadlessReviewResult[] = [];

  for (const pullRequest of targets) {
    const repoIdentifier = parseRepoIdentifier(pullRequest);
    const [owner, repo] = repoIdentifier.split("/");
    const details = await fetchGithubDetails(owner, repo, pullRequest.prNumber);

    const result: HeadlessReviewResult = {
      pr: {
        id: details.id.toString(),
        number: details.number,
        title: details.title,
        repository: repoIdentifier,
        url: details.url,
      },
    };

    if (options.runSummary) {
      result.summary = {
        filesChanged: details.filesChanged,
        linesAdded: details.linesAdded,
        linesDeleted: details.linesDeleted,
      };
    }

    if (options.runSpec) {
      result.spec = {
        supported: false,
        latestStatus: "not_found",
        unmetRequirements: 0,
        metRequirements: 0,
      };
    }

    results.push(result);
  }

  return results;
}

export async function runHeadlessReview(
  options: HeadlessRunOptions,
  appConfig?: AppConfig,
  dependencies?: HeadlessReviewDependencies,
): Promise<HeadlessReviewResult[]> {
  const config: AppConfig = appConfig ?? getAppConfig();
  const fetchBazPRDetails = dependencies?.fetchBazPRDetails ?? fetchPRDetails;
  const fetchGithubPRDetails =
    dependencies?.fetchGithubPRDetails ?? fetchPullRequestDetails;

  if (config.mode.name !== options.mode) {
    throw new Error("App config mode mismatch");
  }

  if (options.mode === "baz") {
    return fetchBazModeResult(options, config.mode, fetchBazPRDetails);
  }

  return fetchTokensModeResult(options, config.mode.dataProvider, fetchGithubPRDetails);
}

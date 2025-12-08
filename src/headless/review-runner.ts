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
  repo: string; // "owner/name"
  prNumber: number;
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

function findMatchingPullRequest(
  pullRequests: PullRequestData[],
  repo: string,
  prNumber: number,
): PullRequestData | undefined {
  return pullRequests.find(
    (pr) =>
      pr.prNumber === prNumber &&
      (pr.repositoryName === repo || pr.repoId === repo),
  );
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
): Promise<HeadlessReviewResult> {
  const pullRequests = await mode.dataProvider.fetchPRs();
  const pullRequest = findMatchingPullRequest(
    pullRequests,
    options.repo,
    options.prNumber,
  );

  if (!pullRequest) {
    throw new Error(
      `Pull request #${options.prNumber} not found in repository ${options.repo}`,
    );
  }

  const prDetails = await fetchBazDetails(pullRequest.id);

  const result: HeadlessReviewResult = {
    pr: {
      id: prDetails.id,
      number: prDetails.pr_number,
      title: prDetails.title,
      repository: options.repo,
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

  return result;
}

async function fetchTokensModeResult(
  options: HeadlessRunOptions,
  fetchGithubDetails: typeof fetchPullRequestDetails,
): Promise<HeadlessReviewResult> {
  const [owner, repo] = options.repo.split("/");
  const details = await fetchGithubDetails(owner, repo, options.prNumber);

  const result: HeadlessReviewResult = {
    pr: {
      id: details.id.toString(),
      number: details.number,
      title: details.title,
      repository: options.repo,
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

  return result;
}

export async function runHeadlessReview(
  options: HeadlessRunOptions,
  appConfig?: AppConfig,
  dependencies?: HeadlessReviewDependencies,
): Promise<HeadlessReviewResult> {
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

  return fetchTokensModeResult(options, fetchGithubPRDetails);
}

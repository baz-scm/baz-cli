import type {
  PullRequest,
  SpecReview,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
  FileDiff,
  ChangeReviewer,
  PRContext,
} from "./types.js";

export interface IDataProvider {
  fetchPRs(): Promise<PullRequest[]>;

  fetchSpecReviews(prId: string): Promise<SpecReview[] | null>;

  fetchIntegrations(): Promise<Integration[]>;

  fetchPRDetails(ctx: PRContext): Promise<PullRequestDetails>;

  fetchDiscussions(ctx: PRContext): Promise<Discussion[]>;

  approvePR(ctx: PRContext): Promise<void>;

  mergePR(ctx: PRContext): Promise<void>;

  fetchMergeStatus(ctx: PRContext): Promise<MergeStatus>;

  fetchUser(): Promise<User>;

  fetchFileDiffs(
    ctx: PRContext,
    commit: string,
    files: string[],
  ): Promise<FileDiff[]>;

  fetchEligibleReviewers(ctx: PRContext): Promise<ChangeReviewer[]>;
}

export type {
  PullRequest,
  SpecReview,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
} from "../clients/baz.js";

import type {
  SpecReview,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
} from "../clients/baz.js";
import { PullRequestData } from "./types.js";

export interface PRContext {
  prId: string;
  repoId: string;
  prNumber: number;
}

export interface IDataProvider {
  fetchPRs(): Promise<PullRequestData[]>;

  fetchSpecReviews(prId: string): Promise<SpecReview[] | null>;

  fetchIntegrations(): Promise<Integration[]>;

  fetchPRDetails(ctx: PRContext): Promise<PullRequestDetails>;

  fetchDiscussions(ctx: PRContext): Promise<Discussion[]>;

  approvePR(ctx: PRContext): Promise<void>;

  mergePR(ctx: PRContext): Promise<void>;

  fetchMergeStatus(ctx: PRContext): Promise<MergeStatus>;

  fetchUser(): Promise<User>;
}

import {
  fetchPRs as bazFetchPRs,
  fetchSpecReviews as bazFetchSpecReviews,
  fetchIntegrations as bazFetchIntegrations,
  fetchPRDetails as bazFetchPRDetails,
  fetchDiscussions as bazFetchDiscussions,
  approvePR as bazApprovePR,
  mergePR as bazMergePR,
  fetchMergeStatus as bazFetchMergeStatus,
  fetchUser as bazFetchUser,
  fetchFileDiffs as bazFetchFileDiffs,
  fetchEligibleReviewers as bazFetchEligibleReviewers,
} from "../clients/baz.js";
import type {
  PRContext,
  PullRequest,
  SpecReview,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
  FileDiff,
  ChangeReviewer,
} from "./types.js";
import { IDataProvider } from "./data-provider.js";

export class BazDataProvider implements IDataProvider {
  async fetchPRs(): Promise<PullRequest[]> {
    return bazFetchPRs();
  }

  async fetchSpecReviews(prId: string): Promise<SpecReview[]> {
    return bazFetchSpecReviews(prId);
  }

  async fetchIntegrations(): Promise<Integration[]> {
    return bazFetchIntegrations();
  }

  async fetchPRDetails(ctx: PRContext): Promise<PullRequestDetails> {
    return bazFetchPRDetails(ctx.prId);
  }

  async fetchDiscussions(ctx: PRContext): Promise<Discussion[]> {
    return bazFetchDiscussions(ctx.prId);
  }

  async approvePR(ctx: PRContext): Promise<void> {
    return bazApprovePR(ctx.prId);
  }

  async mergePR(ctx: PRContext): Promise<void> {
    return bazMergePR(ctx.prId);
  }

  async fetchMergeStatus(ctx: PRContext): Promise<MergeStatus> {
    return bazFetchMergeStatus(ctx.prId);
  }

  async fetchUser(): Promise<User> {
    const userData = await bazFetchUser();
    const firstLogin = userData.user_logins?.[0];
    return {
      login: firstLogin?.login,
    };
  }

  async fetchFileDiffs(
    ctx: PRContext,
    commit: string,
    files: string[],
  ): Promise<FileDiff[]> {
    return bazFetchFileDiffs(ctx.prId, commit, files);
  }

  async fetchEligibleReviewers(ctx: PRContext): Promise<ChangeReviewer[]> {
    return bazFetchEligibleReviewers(ctx.prId);
  }
}

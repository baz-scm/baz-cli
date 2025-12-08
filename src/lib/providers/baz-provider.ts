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
} from "../clients/baz.js";
import type {
  IDataProvider,
  PRContext,
  SpecReview,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
} from "./data-provider.js";
import { PullRequestData } from "./types.js";

export class BazDataProvider implements IDataProvider {
  async fetchPRs(): Promise<PullRequestData[]> {
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
}

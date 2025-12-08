import {
  fetchPRs as bazFetchPRs,
  fetchSpecReviews as bazFetchSpecReviews,
  fetchIntegrations as bazFetchIntegrations,
} from "../clients/baz.js";
import type {
  IDataProvider,
  SpecReview,
  Integration,
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
}

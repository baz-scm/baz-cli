import { Integration } from "../clients/baz.js";
import { IDataProvider } from "./data-provider.js";
import { fetchOpenPullRequests } from "../clients/github.js";
import { PullRequestData } from "./types.js";

export class TokensDataProvider implements IDataProvider {
  async fetchPRs(): Promise<PullRequestData[]> {
    return fetchOpenPullRequests();
  }

  async fetchSpecReviews(_prId: string): Promise<null> {
    return null;
  }

  async fetchIntegrations(): Promise<Integration[]> {
    return [];
  }
}

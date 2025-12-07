export type { PullRequest, SpecReview, Integration } from "../clients/baz.js";

import type { SpecReview, Integration } from "../clients/baz.js";
import { PullRequestData } from "./types.js";

export interface IDataProvider {
  fetchPRs(): Promise<PullRequestData[]>;

  fetchSpecReviews(prId: string): Promise<SpecReview[] | null>;

  fetchIntegrations(): Promise<Integration[] | null>;
}

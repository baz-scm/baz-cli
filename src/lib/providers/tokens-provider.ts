import type {
  IDataProvider,
  PRContext,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
} from "./data-provider.js";
import {
  fetchOpenPullRequests,
  fetchPullRequestDetails,
  fetchUnresolvedReviewThreads,
  approvePullRequest,
  mergePullRequest,
  fetchMergeStatus as ghFetchMergeStatus,
  fetchAuthenticatedUser,
} from "../clients/github.js";
import { PullRequestData } from "./types.js";

export class TokensDataProvider implements IDataProvider {
  async fetchPRs(): Promise<PullRequestData[]> {
    return fetchOpenPullRequests();
  }

  async fetchSpecReviews(_prId: string): Promise<null> {
    // Spec reviews are not supported in tokens mode
    return null;
  }

  async fetchIntegrations(): Promise<Integration[]> {
    // Integrations are not supported in tokens mode
    return [];
  }

  async fetchPRDetails(ctx: PRContext): Promise<PullRequestDetails> {
    const ghDetails = await fetchPullRequestDetails(ctx.repoId, ctx.prNumber);

    // Map GitHub response to PullRequestDetails type
    return {
      id: ghDetails.id.toString(),
      pr_number: ghDetails.number,
      title: ghDetails.title,
      description: ghDetails.body ?? undefined,
      lines_added: ghDetails.additions,
      lines_deleted: ghDetails.deletions,
      files_changed: ghDetails.changed_files,
      files_added: ghDetails.files_added,
      files_deleted: ghDetails.files_deleted,
      files_viewed: [], // Not tracked in GitHub API
      spec_reviews: [], // Not supported in tokens mode
      author_name: ghDetails.user?.login ?? "",
      reviews: ghDetails.reviews.map((review) => ({
        review_state: review.state.toLowerCase(),
        assignee: review.user?.login ?? "",
      })),
      repository_id: ctx.repoId,
    };
  }

  async fetchDiscussions(ctx: PRContext): Promise<Discussion[]> {
    // Fetch only unresolved review threads (matching baz behavior of fetching "pending" discussions)
    const threads = await fetchUnresolvedReviewThreads(ctx.repoId, ctx.prNumber);

    return threads.map((thread) => {
      const firstComment = thread.comments[0];
      return {
        id: thread.id,
        author: firstComment?.author ?? "",
        author_user: firstComment?.author
          ? { display_name: firstComment.author }
          : undefined,
        commit_sha: "",
        outdated: thread.isOutdated,
        file: thread.path,
        start_line: thread.startLine ?? thread.line ?? undefined,
        end_line: thread.line ?? undefined,
        side: thread.diffSide === "LEFT" ? "left" : "right",
        comments: thread.comments.map((c) => ({
          id: c.id,
          comment_body: c.body,
          body_content_type: "markdown" as const,
          author: c.author ?? "",
          author_user: c.author ? { display_name: c.author } : undefined,
        })),
      };
    });
  }

  async approvePR(ctx: PRContext): Promise<void> {
    await approvePullRequest(ctx.repoId, ctx.prNumber);
  }

  async mergePR(ctx: PRContext): Promise<void> {
    await mergePullRequest(ctx.repoId, ctx.prNumber);
  }

  async fetchMergeStatus(ctx: PRContext): Promise<MergeStatus> {
    const ghStatus = await ghFetchMergeStatus(ctx.repoId, ctx.prNumber);
    return {
      is_mergeable: ghStatus.mergeable ?? false,
    };
  }

  async fetchUser(): Promise<User> {
    const ghUser = await fetchAuthenticatedUser();
    return {
      login: ghUser.login,
    };
  }
}

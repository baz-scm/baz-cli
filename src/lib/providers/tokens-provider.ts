import { IDataProvider } from "./data-provider.js";
import type {
  PRContext,
  PullRequest,
  Integration,
  PullRequestDetails,
  Discussion,
  MergeStatus,
  User,
  FileDiff,
  ChangeReviewer,
  RepoWriteAccess,
  MergeMethod,
} from "./types.js";
import {
  fetchOpenPullRequests,
  fetchPullRequestDetails,
  fetchUnresolvedReviewThreads,
  approvePullRequest,
  mergePullRequest,
  fetchMergeStatus as ghFetchMergeStatus,
  fetchAuthenticatedUser,
  fetchFileDiffs as ghFetchFileDiffs,
  fetchAssignees,
  postReviewThreadReply,
  resolveReviewThread,
} from "../clients/github.js";

export class TokensDataProvider implements IDataProvider {
  async fetchPRs(): Promise<PullRequest[]> {
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
    const ghDetails = await fetchPullRequestDetails(
      ctx.fullRepoName,
      ctx.prNumber,
    );

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
      repository_id: ctx.fullRepoName,
    };
  }

  async fetchDiscussions(ctx: PRContext): Promise<Discussion[]> {
    // Fetch only unresolved review threads (matching baz behavior of fetching "pending" discussions)
    const threads = await fetchUnresolvedReviewThreads(
      ctx.fullRepoName,
      ctx.prNumber,
    );

    return threads.map((thread) => {
      const firstComment = thread.comments[0];
      return {
        id: thread.id,
        author: firstComment?.author ?? "",
        author_user: firstComment?.author
          ? { display_name: firstComment.author }
          : undefined,
        commit_sha: thread.originalCommitOid,
        outdated: thread.isOutdated,
        file: thread.path,
        start_line: thread.startLine ?? thread.line ?? undefined,
        end_line: thread.line ?? undefined,
        side: thread.diffSide === "LEFT" ? "left" : "right",
        original_start_line: thread.startLine ?? thread.line ?? undefined,
        original_end_line: thread.line ?? undefined,
        comments: thread.comments.map((c) => ({
          id: c.id,
          comment_body: c.body,
          body_content_type: "markdown" as const,
          author: c.author ?? "",
          author_user: c.author ? { display_name: c.author } : undefined,
          createdAt: c.createdAt,
        })),
      };
    });
  }

  async postDiscussionReply(
    ctx: PRContext,
    discussionId: string,
    body: string,
  ): Promise<void> {
    await postReviewThreadReply(
      ctx.fullRepoName,
      ctx.prNumber,
      discussionId,
      body,
    );
  }

  async resolveDiscussion(ctx: PRContext, discussionId: string): Promise<void> {
    await resolveReviewThread(ctx.fullRepoName, discussionId);
  }

  async approvePR(ctx: PRContext): Promise<void> {
    await approvePullRequest(ctx.fullRepoName, ctx.prNumber);
  }

  async mergePR(ctx: PRContext, mergeStrategy: MergeMethod): Promise<void> {
    await mergePullRequest(ctx.fullRepoName, ctx.prNumber, mergeStrategy);
  }

  async fetchMergeStatus(ctx: PRContext): Promise<MergeStatus> {
    return await ghFetchMergeStatus(ctx.fullRepoName, ctx.prNumber);
  }

  async fetchUser(): Promise<User> {
    const ghUser = await fetchAuthenticatedUser();
    return {
      login: ghUser.login,
    };
  }

  async fetchFileDiffs(
    ctx: PRContext,
    commit: string,
    files: string[],
  ): Promise<FileDiff[]> {
    return ghFetchFileDiffs(ctx.fullRepoName, ctx.prNumber, commit, files);
  }

  async fetchEligibleReviewers(ctx: PRContext): Promise<ChangeReviewer[]> {
    const assignees = await fetchAssignees(ctx.fullRepoName);

    return assignees.map((assignee) => ({
      id: assignee.id.toString(),
      reviewer_type: assignee.type.toLowerCase(),
      name: assignee.login, // GitHub doesn't return display name in assignees endpoint
      login: assignee.login,
      avatar_url: assignee.avatar_url,
    }));
  }

  async fetchRepoWriteAccess(_ctx: PRContext): Promise<RepoWriteAccess> {
    // if the user uses a fine-grained PAT, then we can't determine repo access therefore,
    // let's assume we have it and fail on writing
    return {
      hasAccess: true,
      reason: null,
    };
  }
}

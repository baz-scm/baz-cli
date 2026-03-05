import {
  getAppConfig,
  AppConfigError,
  type AppConfig,
} from "../lib/config/index.js";
import { OAuthFlow } from "../auth/oauth-flow.js";
import {
  IssueType,
  type CheckoutChatRequest,
} from "../models/chat.js";
import { processStream } from "../lib/chat-stream.js";
import { fetchPRs, fetchPRDetails, fetchSpecReviews } from "../lib/clients/baz.js";
import { fetchPullRequestDetails } from "../lib/clients/github.js";

const WALKTHROUGH_INITIAL_PROMPT =
  "Please walk me through this pull request. Start by showing me a very short description on what the pull request do, followed by a brief summary of the sections. Do not include any section yet in your answer";

interface ParsedPRUrl {
  owner: string;
  repo: string;
  prNumber: number;
  fullRepoName: string;
}

function parsePRUrl(url: string): ParsedPRUrl {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(
      `Invalid GitHub PR URL: "${url}"\nExpected: https://github.com/owner/repo/pull/123`,
    );
  }
  const [, owner, repo, prNumberStr] = match;
  return {
    owner,
    repo,
    prNumber: parseInt(prNumberStr, 10),
    fullRepoName: `${owner}/${repo}`,
  };
}

interface HeadlessPRContext {
  prId: string;
  bazRepoId?: string;
  fullRepoName: string;
  prNumber: number;
}

async function resolvePRContext(
  parsed: ParsedPRUrl,
  appConfig: AppConfig,
): Promise<HeadlessPRContext> {
  const { fullRepoName, prNumber } = parsed;

  if (appConfig.mode.name === "baz") {
    const prs = await fetchPRs();
    const pr = prs.find(
      (p) => p.repositoryName === fullRepoName && p.prNumber === prNumber,
    );
    if (!pr) {
      throw new Error(
        `PR #${prNumber} not found in repository ${fullRepoName}.\nMake sure the PR is open and accessible to your Baz account.`,
      );
    }
    const details = await fetchPRDetails(pr.id);
    return {
      prId: pr.id,
      bazRepoId: details.repository_id,
      fullRepoName,
      prNumber,
    };
  }

  // Tokens mode
  const details = await fetchPullRequestDetails(fullRepoName, prNumber);
  return {
    prId: details.id.toString(),
    fullRepoName,
    prNumber,
  };
}

async function streamToStdout(request: CheckoutChatRequest): Promise<void> {
  let lastLength = 0;
  const abortController = new AbortController();

  const sigintHandler = () => abortController.abort();
  process.on("SIGINT", sigintHandler);

  try {
    await processStream(
      request,
      {
        onConversationId: () => {},
        onFirstTextContent: () => {},
        onUpdate: (content) => {
          const delta = content.slice(lastLength);
          if (delta) {
            process.stdout.write(delta);
            lastLength = content.length;
          }
        },
      },
      abortController.signal,
    );
    process.stdout.write("\n");
  } finally {
    process.off("SIGINT", sigintHandler);
  }
}

async function runHeadlessChat(
  ctx: HeadlessPRContext,
  message: string,
  modeName: string,
): Promise<void> {
  const issue = {
    type: IssueType.PR_CHAT,
    data: { id: ctx.prId },
  } as const;

  let request: CheckoutChatRequest;
  if (modeName === "baz" && ctx.bazRepoId) {
    request = {
      mode: "baz",
      repoId: ctx.bazRepoId,
      prId: ctx.prId,
      issue,
      freeText: message,
    };
  } else {
    request = {
      mode: "tokens",
      prContext: {
        prId: ctx.prId,
        fullRepoName: ctx.fullRepoName,
        prNumber: ctx.prNumber,
      },
      issue,
      freeText: message,
    };
  }

  await streamToStdout(request);
}

async function runHeadlessWalkthrough(
  ctx: HeadlessPRContext,
  modeName: string,
): Promise<void> {
  const issue = {
    type: IssueType.PR_WALKTHROUGH,
    data: { id: ctx.prId },
  } as const;

  let request: CheckoutChatRequest;
  if (modeName === "baz" && ctx.bazRepoId) {
    request = {
      mode: "baz",
      repoId: ctx.bazRepoId,
      prId: ctx.prId,
      issue,
      freeText: WALKTHROUGH_INITIAL_PROMPT,
    };
  } else {
    request = {
      mode: "tokens",
      prContext: {
        prId: ctx.prId,
        fullRepoName: ctx.fullRepoName,
        prNumber: ctx.prNumber,
      },
      issue,
      freeText: WALKTHROUGH_INITIAL_PROMPT,
    };
  }

  await streamToStdout(request);
}

async function runHeadlessSpecReview(
  ctx: HeadlessPRContext,
  modeName: string,
): Promise<void> {
  if (modeName !== "baz") {
    console.error("❌ Spec review is not available in tokens mode.");
    process.exit(1);
  }

  const specReviews = await fetchSpecReviews(ctx.prId);
  const latest = specReviews
    .filter((sr) => sr.status === "success")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!latest) {
    throw new Error(
      `No successful spec review found for ${ctx.fullRepoName} #${ctx.prNumber}.`,
    );
  }

  console.log(`Spec Review — ${ctx.fullRepoName} #${ctx.prNumber}\n`);

  for (const req of latest.requirements) {
    const isMet = req.verdict === "Met";
    const label = isMet ? "[MET]" : "[NOT MET]";
    console.log(`${label} ${req.title}`);
    if (req.description) {
      console.log(`  Description: ${req.description}`);
    }
    if (req.verdict_explanation) {
      console.log(`  Verdict: ${req.verdict_explanation}`);
    }
    console.log();
  }
}

export async function runHeadless(
  url: string,
  options: { chat?: string; walkthrough?: boolean; specReview?: boolean },
): Promise<void> {
  if (!options.chat && !options.walkthrough && !options.specReview) {
    console.error(
      "❌ Specify an action: --chat <message>, --walkthrough, or --spec-review",
    );
    process.exit(1);
  }

  let appConfig: AppConfig;
  try {
    appConfig = getAppConfig();
  } catch (e) {
    if (e instanceof AppConfigError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  if (appConfig.mode.name === "baz") {
    const oauthFlow = OAuthFlow.getInstance();
    if (!oauthFlow.isAuthenticated()) {
      console.error("❌ Not authenticated. Run 'baz auth login' first.");
      process.exit(1);
    }
  }

  let parsed: ParsedPRUrl;
  let ctx: HeadlessPRContext;
  try {
    parsed = parsePRUrl(url);
    ctx = await resolvePRContext(parsed, appConfig);
  } catch (e) {
    console.error("❌ Error:", e instanceof Error ? e.message : "Unknown error");
    process.exit(1);
  }

  try {
    if (options.chat) {
      await runHeadlessChat(ctx, options.chat, appConfig.mode.name);
    } else if (options.walkthrough) {
      await runHeadlessWalkthrough(ctx, appConfig.mode.name);
    } else if (options.specReview) {
      await runHeadlessSpecReview(ctx, appConfig.mode.name);
    }
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e instanceof Error ? e.message : "Unknown error");
    process.exit(1);
  }
}

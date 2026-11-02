import { execFileSync, execSync } from "child_process";
import path from "path";

const EXEC_OPTIONS = {
  encoding: "utf-8" as const,
  maxBuffer: 10 * 1024 * 1024,
};

function gitExec(args: string): string {
  try {
    return execSync(`git ${args}`, EXEC_OPTIONS).trim();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not a git repository")
    ) {
      throw new Error(
        "Not a git repository. Run this command from within a git project.",
      );
    }
    throw error;
  }
}

export function getDiff(): string {
  return gitExec("diff HEAD");
}

export function getCurrentBranch(): string {
  return gitExec("rev-parse --abbrev-ref HEAD");
}

export function getDefaultBranch(): string | null {
  try {
    const ref = gitExec("symbolic-ref refs/remotes/origin/HEAD");
    return ref.split("/").pop() ?? null;
  } catch {
    // origin/HEAD not set — check for common defaults
    for (const branch of ["main", "master"]) {
      try {
        gitExec(`rev-parse --verify refs/remotes/origin/${branch}`);
        return branch;
      } catch {
        console.trace(`Branch ${branch} not found`);
      }
    }
    return null;
  }
}

export function getBranchDiff(baseBranch: string): string {
  return gitExec(`diff origin/${baseBranch}...HEAD`);
}

/** Runs git without a shell, so a user-supplied ref is never interpreted. */
function gitProbe(args: string[]): boolean {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function refExists(ref: string): boolean {
  return gitProbe(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
}

/**
 * Resolves `--base` to a ref. A branch name wins over any other revision, and
 * when it exists both locally and on origin, the newer of the two is used so a
 * stale copy does not widen the review. If they have diverged, origin is used,
 * as it is for the default branch. Anything else (`origin/x`, a tag, a SHA) is
 * accepted as long as it names a commit.
 */
export function resolveBaseRef(base: string): string {
  const notFound = new Error(
    `Base branch "${base}" not found. Check the name, or run \`git fetch\` if it only exists on the remote.`,
  );
  if (!base || base.startsWith("-")) throw notFound;

  // Revisions such as HEAD~1 must not be read as refs/remotes/origin/HEAD~1,
  // which is the remote's default branch rather than the current branch.
  const isBranchName =
    base !== "HEAD" && gitProbe(["check-ref-format", "--branch", base]);
  const remote = `refs/remotes/origin/${base}`;
  const local = `refs/heads/${base}`;
  const hasRemote = isBranchName && refExists(remote);
  const hasLocal = isBranchName && refExists(local);

  if (hasRemote && hasLocal) {
    return gitProbe(["merge-base", "--is-ancestor", remote, local])
      ? local
      : remote;
  }
  if (hasRemote) return remote;
  if (hasLocal) return local;
  if (refExists(base)) return base;
  throw notFound;
}

export function getDiffAgainstRef(ref: string): string {
  try {
    return execFileSync(
      "git",
      ["diff", `${ref}...HEAD`, "--"],
      EXEC_OPTIONS,
    ).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOBUFS") {
      throw new Error(
        `The diff against ${ref} is larger than the ${EXEC_OPTIONS.maxBuffer / (1024 * 1024)}MB limit. Try a closer base.`,
      );
    }
    throw error;
  }
}

export function isOnNonDefaultBranch(): {
  onFeatureBranch: boolean;
  currentBranch: string;
  defaultBranch: string | null;
} {
  const currentBranch = getCurrentBranch();
  if (currentBranch === "HEAD") {
    return { onFeatureBranch: false, currentBranch, defaultBranch: null };
  }
  const defaultBranch = getDefaultBranch();
  return {
    onFeatureBranch: defaultBranch !== null && currentBranch !== defaultBranch,
    currentBranch,
    defaultBranch,
  };
}

export function getRepoName(): string {
  try {
    const remoteUrl = gitExec("remote get-url origin");

    // SSH format: git@github.com:org/repo.git
    const sshMatch = remoteUrl.match(/git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];

    // HTTPS format: https://github.com/org/repo.git
    const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];

    return remoteUrl;
  } catch {
    return path.basename(process.cwd());
  }
}

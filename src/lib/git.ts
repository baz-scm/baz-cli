import { execSync } from "child_process";
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

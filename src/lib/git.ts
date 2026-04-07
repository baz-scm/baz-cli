import { execSync } from "child_process";
import path from "path";

const EXEC_OPTIONS = { encoding: "utf-8" as const, maxBuffer: 10 * 1024 * 1024 };

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

export function getStagedDiff(): string {
  return gitExec("diff --cached");
}

export function getUnstagedFiles(): string[] {
  const output = gitExec("diff --name-only");
  return output ? output.split("\n") : [];
}

export function getAllDiff(): string {
  return gitExec("diff HEAD");
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

export function hasStagedChanges(): boolean {
  return getStagedDiff().length > 0;
}

export interface ChangeSummary {
  modified: number;
  added: number;
  deleted: number;
}

export function getChangeSummary(): ChangeSummary | null {
  const staged = gitExec("diff --cached --name-status");
  const unstaged = gitExec("diff --name-status");

  // Combine and deduplicate by filename (staged takes precedence)
  const fileStatuses = new Map<string, string>();
  for (const line of [...unstaged.split("\n"), ...staged.split("\n")]) {
    if (!line.trim()) continue;
    const [status, ...fileParts] = line.split("\t");
    const file = fileParts.join("\t");
    if (status && file) {
      fileStatuses.set(file, status.charAt(0));
    }
  }

  if (fileStatuses.size === 0) return null;

  let modified = 0;
  let added = 0;
  let deleted = 0;

  for (const status of fileStatuses.values()) {
    switch (status) {
      case "A":
        added++;
        break;
      case "D":
        deleted++;
        break;
      default:
        modified++;
        break;
    }
  }

  return { modified, added, deleted };
}

export function hasAnyChanges(): boolean {
  return getChangeSummary() !== null;
}

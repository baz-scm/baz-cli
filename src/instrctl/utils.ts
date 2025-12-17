import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { ConflictsFile } from "./types.js";
import { matchAny, pathMatches } from "./matcher.js";

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readFileSafe(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function writeFileSafe(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function getRepoRoot(): string {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
    return root;
  } catch {
    return process.cwd();
  }
}

export function getHeadCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function relativePath(root: string, target: string): string {
  return path.relative(root, target) || path.basename(target);
}

export function idFromRandom(): string {
  return `P-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function normalizeStatement(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferenceTitle(statement: string): string {
  const words = statement.split(/\s+/).slice(0, 6).join(" ");
  return words.length ? words : "Principle";
}

export function repoEntries(root: string, exclude: string[] = []): string[] {
  const entries: string[] = [];
  const queue: string[] = [root];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const relative = path.relative(root, current).replace(/\\/g, "/");
      if (relative && matchAny(`${relative}/`, exclude)) {
        continue;
      }
      for (const child of fs.readdirSync(current)) {
        queue.push(path.join(current, child));
      }
    } else {
      entries.push(current);
    }
  }
  return entries;
}

export function readConflicts(repoRoot: string = getRepoRoot()): ConflictsFile | null {
  const conflictPath = path.join(repoRoot, ".instrctl", "conflicts.json");
  if (!fs.existsSync(conflictPath)) return null;
  const content = fs.readFileSync(conflictPath, "utf8");
  return JSON.parse(content) as ConflictsFile;
}

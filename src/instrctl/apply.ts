import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { MANAGED_BEGIN, MANAGED_END, MANAGED_SECTION_HEADING } from "./constants.js";
import { readState, writeStateFiles } from "./state.js";
import { getRepoRoot } from "./utils.js";
import type { FilePatch, PlanFile, StateFile } from "./types.js";

export type ApplyPhase = "validate" | "patch" | "state";

class PlanValidationError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function readPlan(repoRoot: string): PlanFile {
  const planPath = path.join(repoRoot, ".instrctl", "plan.json");
  if (!fs.existsSync(planPath)) {
    throw new Error(".instrctl/plan.json missing; run instrctl plan first.");
  }
  const content = fs.readFileSync(planPath, "utf8");
  return JSON.parse(content) as PlanFile;
}

function applyPatch(patch: string) {
  execSync("git apply --whitespace=nowarn", { input: patch, stdio: "pipe" });
}

function allowedRange(lines: string[]): { start: number; end: number } {
  const begin = lines.findIndex((line) => line.includes(MANAGED_BEGIN));
  if (begin >= 0) {
    let heading = -1;
    for (let i = begin; i >= 0; i -= 1) {
      if (lines[i].includes(MANAGED_SECTION_HEADING)) {
        heading = i;
        break;
      }
    }
    const endIndex = lines.slice(begin + 1).findIndex((line) => line.includes(MANAGED_END));
    const absoluteEnd = endIndex >= 0 ? begin + 1 + endIndex : lines.length - 1;
    return {
      start: (heading >= 0 ? heading : begin) + 1,
      end: absoluteEnd + 1,
    };
  }
  return { start: lines.length + 1, end: Number.MAX_SAFE_INTEGER };
}

function validatePatchAgainstState(patch: FilePatch, state: StateFile, repoRoot: string) {
  const allowedPaths = new Set(state.documents.map((doc) => doc.path));
  if (!allowedPaths.has(patch.path)) {
    throw new PlanValidationError(`Patch targets disallowed file: ${patch.path}`, 4);
  }

  const filePath = path.join(repoRoot, patch.path);
  const before = fs.readFileSync(filePath, "utf8");
  const lines = before.split(/\r?\n/);
  const bounds = allowedRange(lines);

  const diffLines = patch.patch_unified.split(/\r?\n/);
  const originalLength = lines.length;
  for (let i = 0; i < diffLines.length; i += 1) {
    const line = diffLines[i];
    if (!line.startsWith("@@")) continue;
    const match = line.match(/@@ -([0-9]+)(?:,[0-9]+)? \+([0-9]+)/);
    if (!match) continue;
    let originalLine = Number(match[1]);

    for (let j = i + 1; j < diffLines.length; j += 1) {
      const hunkLine = diffLines[j];
      if (hunkLine.startsWith("@@")) {
        i = j - 1;
        break;
      }
      if (hunkLine.startsWith(" ")) {
        originalLine += 1;
        continue;
      }
      if (hunkLine.startsWith("-")) {
        if (originalLine < bounds.start || originalLine > bounds.end) {
          throw new PlanValidationError(`Patch removes lines outside managed region in ${patch.path}`, 4);
        }
        originalLine += 1;
        continue;
      }
      if (hunkLine.startsWith("+")) {
        const targetLine = originalLine;
        const withinFile = targetLine <= originalLength;
        if (withinFile && (targetLine < bounds.start || targetLine > bounds.end)) {
          throw new PlanValidationError(`Patch adds lines outside managed region in ${patch.path}`, 4);
        }
        if (!withinFile && bounds.start !== originalLength + 1) {
          throw new PlanValidationError(`Patch appends outside managed region in ${patch.path}`, 4);
        }
        continue;
      }
      if (j === diffLines.length - 1) {
        i = j;
      }
    }
  }
}

export async function applyPlan(
  onProgress?: (phase: ApplyPhase, detail?: string) => void,
): Promise<PlanFile> {
  const repoRoot = getRepoRoot();
  const state = readState(repoRoot);
  const plan = readPlan(repoRoot);
  onProgress?.("validate");
  if (state.repo.head_commit !== plan.base_commit) {
    throw new PlanValidationError("Plan base commit does not match HEAD; re-run plan.", 3);
  }

  if (plan.conflicts.some((c) => c.blocking)) {
    throw new PlanValidationError("Blocking conflicts detected in plan; resolve before applying.", 2);
  }

  for (const patch of plan.file_patches) {
    onProgress?.("patch", patch.path);
    validatePatchAgainstState(patch, state, repoRoot);
    applyPatch(patch.patch_unified);
  }

  onProgress?.("state");
  await writeStateFiles();
  return plan;
}

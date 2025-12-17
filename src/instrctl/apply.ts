import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readState, writeStateFiles } from "./state.js";
import { getRepoRoot } from "./utils.js";
import type { PlanFile } from "./types.js";

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

export async function applyPlan(): Promise<PlanFile> {
  const repoRoot = getRepoRoot();
  const state = readState(repoRoot);
  const plan = readPlan(repoRoot);
  if (state.repo.head_commit !== plan.base_commit) {
    throw new Error("Plan base commit does not match HEAD; re-run plan.");
  }
  for (const patch of plan.file_patches) {
    applyPatch(patch.patch_unified);
  }
  await writeStateFiles();
  return plan;
}

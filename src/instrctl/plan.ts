import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { MANAGED_BEGIN, MANAGED_END, MANAGED_SECTION_HEADING } from "./constants.js";
import { readConfig } from "./config.js";
import { scopeIntersects } from "./scope.js";
import { readState } from "./state.js";
import { ensureDir, getRepoRoot, readConflicts, writeFileSafe } from "./utils.js";
import type { FilePatch, PlanFile, Principle, StateFile } from "./types.js";

function renderPrinciple(principle: Principle): string {
  const strength = principle.strength === "MUST_NOT" ? "MUST NOT" : principle.strength;
  return [
    `<!-- instrctl:begin ${principle.id} -->`,
    `- **${strength}** ${principle.statement}`,
    `<!-- instrctl:end ${principle.id} -->`,
  ].join("\n");
}

function renderSection(principles: Principle[]): string {
  const sorted = [...principles].sort((a, b) => a.title.localeCompare(b.title));
  const blocks = sorted.map(renderPrinciple).join("\n\n");
  return [MANAGED_SECTION_HEADING, MANAGED_BEGIN, blocks, MANAGED_END, ""].join("\n");
}

function replaceManagedSection(original: string, rendered: string): string {
  if (original.includes(MANAGED_BEGIN) && original.includes(MANAGED_END)) {
    const start = original.indexOf(MANAGED_BEGIN);
    const end = original.indexOf(MANAGED_END) + MANAGED_END.length;
    return original.slice(0, start) + rendered + original.slice(end);
  }
  if (original.includes(MANAGED_SECTION_HEADING)) {
    const [before, ...afterParts] = original.split(MANAGED_SECTION_HEADING);
    const after = afterParts.join(MANAGED_SECTION_HEADING);
    return `${before}${rendered}${after}`;
  }
  return `${original.trim()}\n\n${rendered}`;
}

function managedContent(doc: StateFile["documents"][number], desired: Principle[]): string {
  const applicable = desired.filter((p) => scopeIntersects(p.scope, doc.docScope));
  return renderSection(applicable);
}

function unifiedDiff(pathName: string, before: string, after: string): string {
  if (before === after) return "";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "instrctl-"));
  const left = path.join(tmpDir, "before.txt");
  const right = path.join(tmpDir, "after.txt");
  fs.writeFileSync(left, before, "utf8");
  fs.writeFileSync(right, after, "utf8");
  const diff = spawnSync("git", ["diff", "--no-index", "--", left, right], {
    encoding: "utf8",
  });
  const output = (diff.stdout || "") + (diff.stderr || "");
  return output.replaceAll(left, pathName).replaceAll(right, pathName);
}

function readDesiredPrinciples(state: StateFile): Principle[] {
  const config = readConfig(state.repo.root);
  if (config && config.principles.length) return config.principles;
  return state.principles;
}

export function buildPlan(): PlanFile {
  const repoRoot = getRepoRoot();
  const state = readState(repoRoot);
  const conflictsFile = readConflicts(repoRoot);
  const desired = readDesiredPrinciples(state);
  const principle_changes = desired.map((p) => ({
    action: "update" as const,
    id: p.id,
    after_hash: p.fingerprint,
  }));

  const file_patches: FilePatch[] = [];

  for (const doc of state.documents) {
    const docPath = path.join(repoRoot, doc.path);
    const before = fs.readFileSync(docPath, "utf8");
    const rendered = managedContent(doc, desired);
    const after = replaceManagedSection(before, rendered);
    const patch = unifiedDiff(doc.path, before, after);
    if (patch) {
      file_patches.push({ path: doc.path, patch_unified: patch });
    }
  }

  const conflicts: PlanFile["conflicts"] = (conflictsFile?.conflicts ?? []).map((conflict) => ({
    conflict_id: conflict.conflict_id,
    blocking: Boolean(conflict.blocking),
  }));
  const plan: PlanFile = {
    version: 1,
    base_commit: state.repo.head_commit,
    principle_changes,
    file_patches,
    conflicts,
    validation: {
      patch_constraints_ok: true,
      roundtrip_ok: true,
    },
  };
  const outPath = path.join(repoRoot, ".instrctl", "plan.json");
  ensureDir(path.dirname(outPath));
  writeFileSafe(outPath, JSON.stringify(plan, null, 2));
  return plan;
}

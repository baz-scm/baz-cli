import fs from "fs";
import path from "path";
import { buildConflicts } from "./conflicts.js";
import { discoverDocuments } from "./discovery.js";
import { extractPrinciples } from "./extract.js";
import { ensureDir, getHeadCommit, getRepoRoot, readFileSafe, writeFileSafe } from "./utils.js";
import type { ConflictsFile, StateFile } from "./types.js";

async function buildState(): Promise<StateFile> {
  const repoRoot = getRepoRoot();
  const head = getHeadCommit();
  const documents = discoverDocuments(repoRoot);
  const principles: StateFile["principles"] = [];
  const occurrences: StateFile["occurrences"] = [];

  for (const doc of documents) {
    const content = readFileSafe(path.join(repoRoot, doc.path));
    const extracted = await extractPrinciples(doc.path, content, doc.docScope);
    principles.push(...extracted.principles);
    occurrences.push(...extracted.occurrences);
  }

  return {
    version: 1,
    repo: { root: repoRoot, head_commit: head },
    documents,
    principles,
    occurrences,
  };
}

export async function writeStateFiles(): Promise<{
  state: StateFile;
  conflicts: ConflictsFile;
}> {
  const state = await buildState();
  const conflicts = buildConflicts(state.repo.head_commit, state.principles);
  const instrctlDir = path.join(state.repo.root, ".instrctl");
  ensureDir(instrctlDir);
  writeFileSafe(path.join(instrctlDir, "state.json"), JSON.stringify(state, null, 2));
  writeFileSafe(path.join(instrctlDir, "conflicts.json"), JSON.stringify(conflicts, null, 2));

  const mdLines = [
    "# Conflicts",
    "",
    `Base commit: ${state.repo.head_commit}`,
    "",
  ];
  if (!conflicts.conflicts.length) {
    mdLines.push("No conflicts detected.");
  } else {
    mdLines.push("| ID | Type | Severity | Blocking | Principle IDs | Explanation |", "|---|---|---|---|---|---|");
    for (const conflict of conflicts.conflicts) {
      mdLines.push(
        `| ${conflict.conflictId} | ${conflict.type} | ${conflict.severity} | ${conflict.blocking} | ${conflict.principleIds.join(", ")} | ${conflict.explanation} |`,
      );
    }
  }
  writeFileSafe(path.join(instrctlDir, "conflicts.md"), mdLines.join("\n"));
  return { state, conflicts };
}

export function readState(repoRoot: string): StateFile {
  const file = path.join(repoRoot, ".instrctl", "state.json");
  if (!fs.existsSync(file)) {
    throw new Error(".instrctl/state.json missing; run instrctl init first.");
  }
  const content = fs.readFileSync(file, "utf8");
  return JSON.parse(content) as StateFile;
}

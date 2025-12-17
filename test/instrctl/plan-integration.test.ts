import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlan } from "../../src/instrctl/plan.js";
import { writeStateFiles } from "../../src/instrctl/state.js";

function createFixtureRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "instrctl-plan-"));
  fs.writeFileSync(
    path.join(root, "CLAUDE.md"),
    [
      "# Instructions",
      "- **MUST** follow the release checklist",
      "- **MUST NOT** leak credentials",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "frontend", "agents.md"),
    [
      "## Agent Rules",
      "- **SHOULD** add screenshots for UI changes",
      "- **MAY** adjust copy without review",
    ].join("\n"),
    "utf8",
  );
  return root;
}

test("writeStateFiles and buildPlan generate managed patches", async () => {
  const originalCwd = process.cwd();
  const fixture = createFixtureRepo();
  process.chdir(fixture);
  try {
    const { state, conflicts } = await writeStateFiles();
    assert.equal(state.documents.length, 2);
    assert.equal(conflicts.conflicts.length, 0);
    const plan = buildPlan();
    assert.ok(plan.file_patches.length >= 2);
    const planPath = path.join(fixture, ".instrctl", "plan.json");
    const persisted = JSON.parse(fs.readFileSync(planPath, "utf8"));
    assert.ok(persisted.file_patches.every((p: { patch_unified: string }) => p.patch_unified.includes("Managed Principles")));
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

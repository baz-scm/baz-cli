import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { inferDocScope, scopeIntersects } from "../../src/instrctl/scope.js";

test("inferDocScope falls back to repo or folder scope", () => {
  const repoRoot = "/tmp/repo";
  const rootDoc = inferDocScope(repoRoot, path.join(repoRoot, "CLAUDE.md"), "");
  assert.deepEqual(rootDoc, ["repo/**"]);
  const nestedDoc = inferDocScope(repoRoot, path.join(repoRoot, "frontend", "agents.md"), "");
  assert.deepEqual(nestedDoc, ["frontend/**"]);
});

test("inferDocScope honors frontmatter scope overrides", () => {
  const repoRoot = "/tmp/repo";
  const content = "---\ninstrctl:\n  scope: ['frontend/**', 'docs/**']\n---\nbody";
  const scoped = inferDocScope(repoRoot, path.join(repoRoot, "README.md"), content);
  assert.deepEqual(scoped, ["frontend/**", "docs/**"]);
});

test("scopeIntersects handles repo wildcards and nested overlaps", () => {
  assert.equal(scopeIntersects(["repo/**"], ["docs/**"]), true);
  assert.equal(scopeIntersects(["frontend/**"], ["frontend/ui/**"]), true);
  assert.equal(scopeIntersects(["frontend/**"], ["backend/**"]), false);
});

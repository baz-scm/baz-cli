import assert from "node:assert/strict";
import test from "node:test";
import { docDialect, globToRegex, pathMatches } from "../../src/instrctl/matcher.js";

void test("globToRegex matches double star and single star patterns", () => {
  const regex = globToRegex("docs/**/file*.md");
  assert.ok(regex.test("docs/a/file1.md"));
  assert.ok(regex.test("docs/a/b/fileX.md"));
  assert.ok(!regex.test("docs/file.md"));
});

void test("pathMatches respects include and exclude globs", () => {
  const include = ["**/*.md"];
  const exclude = ["node_modules/**", "dist/**"];
  assert.ok(pathMatches("notes/agents.md", include, exclude));
  assert.ok(!pathMatches("node_modules/agents.md", include, exclude));
  assert.ok(!pathMatches("dist/agents.md", include, exclude));
});

void test("docDialect infers known dialect names", () => {
  assert.equal(docDialect("CLAUDE.md"), "claude");
  assert.equal(docDialect("agents.md"), "agents");
  assert.equal(docDialect("skills.md"), "skills");
  assert.equal(docDialect("cursor-rules.txt"), "cursor");
  assert.equal(docDialect(".cursor/rules.yaml"), "cursor");
  assert.equal(docDialect("misc.txt"), "generic");
});

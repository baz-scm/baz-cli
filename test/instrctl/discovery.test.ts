import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverDocuments } from "../../src/instrctl/discovery.js";
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from "../../src/instrctl/constants.js";

test("discoverDocuments finds known instruction docs and skips excluded folders", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "instrctl-discovery-"));
  const agentPath = path.join(temp, "agents.md");
  const cursorRules = path.join(temp, ".cursor", "rules.md");
  fs.mkdirSync(path.dirname(cursorRules), { recursive: true });
  fs.writeFileSync(agentPath, "- **MUST** follow the plan", "utf8");
  fs.writeFileSync(cursorRules, "- **MAY** adjust prompts", "utf8");
  fs.mkdirSync(path.join(temp, "node_modules"));
  fs.writeFileSync(path.join(temp, "node_modules", "ignored.md"), "- **MUST** be skipped", "utf8");

  const docs = discoverDocuments(temp, { include: DEFAULT_INCLUDE, exclude: DEFAULT_EXCLUDE });
  const paths = docs.map((d) => d.path).sort();
  assert.deepEqual(paths, [".cursor/rules.md", "agents.md"]);
  assert.ok(docs.every((doc) => doc.docScope.length > 0 && doc.sha256));
});

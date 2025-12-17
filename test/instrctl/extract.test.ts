import assert from "node:assert/strict";
import test from "node:test";
import { extractPrinciples } from "../../src/instrctl/extract.js";

test("extractPrinciples pulls modal statements with metadata", async () => {
  const content = [
    "Random intro",
    "- **MUST** keep changes minimal.",
    "- SHOULD consider edge cases",
    "- optional note without modal",
    "- **MUST NOT** leak secrets",
  ].join("\n");

  const { principles, occurrences } = await extractPrinciples("agents.md", content, ["repo/**"]);
  assert.equal(principles.length, 3);
  assert.equal(occurrences.length, 3);
  assert.equal(principles[0].strength, "MUST");
  assert.equal(principles[0].statement, "keep changes minimal.");
  assert.equal(principles[2].strength, "MUST_NOT");
  assert.ok(principles[0].fingerprint);
  assert.deepEqual(principles[0].scope, ["repo/**"]);
});

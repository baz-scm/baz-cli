import assert from "node:assert/strict";
import test from "node:test";
import { buildConflicts } from "../../src/instrctl/conflicts.js";
import type { Principle } from "../../src/instrctl/types.js";

test("buildConflicts surfaces duplicates and contradictions", () => {
  const principles: Principle[] = [
    {
      id: "P-1",
      title: "Use yarn",
      strength: "MUST",
      statement: "Use yarn for installs",
      scope: ["repo/**"],
    },
    {
      id: "P-2",
      title: "Use yarn duplicate",
      strength: "MUST",
      statement: "Use yarn for installs",
      scope: ["repo/**"],
    },
    {
      id: "P-3",
      title: "Avoid yarn",
      strength: "MUST_NOT",
      statement: "Use yarn for installs",
      scope: ["repo/**"],
    },
  ];

  const conflicts = buildConflicts("abc123", principles);
  assert.equal(conflicts.conflicts.length, 2);
  const duplicate = conflicts.conflicts.find((c) => c.type === "DUPLICATE");
  const contradiction = conflicts.conflicts.find((c) => c.type === "CONTRADICTION");
  assert.ok(duplicate);
  assert.ok(contradiction);
  assert.equal(contradiction?.blocking, true);
});

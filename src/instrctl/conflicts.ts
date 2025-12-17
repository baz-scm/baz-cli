import { normalizeStatement } from "./utils.js";
import type { Conflict, ConflictsFile, Principle } from "./types.js";

function detectDuplicates(principles: Principle[]): Conflict[] {
  const seen = new Map<string, Principle>();
  const conflicts: Conflict[] = [];
  for (const principle of principles) {
    const key = `${principle.strength}-${normalizeStatement(principle.statement)}`;
    const existing = seen.get(key);
    if (existing) {
      conflicts.push({
        conflictId: `C-${conflicts.length + 1}`,
        type: "DUPLICATE",
        severity: "LOW",
        topic: principle.title,
        principleIds: [existing.id, principle.id],
        overlappingScope: existing.scope,
        evidence: [],
        explanation: "Principles share identical normalized text and strength.",
        suggestedResolution: "Merge or deduplicate the overlapping principles.",
        blocking: false,
      });
    } else {
      seen.set(key, principle);
    }
  }
  return conflicts;
}

function detectContradictions(principles: Principle[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const map = new Map<string, Principle>();
  for (const principle of principles) {
    const normalized = normalizeStatement(principle.statement);
    const inverseStrength = principle.strength === "MUST" ? "MUST_NOT" : "MUST";
    const key = `${inverseStrength}-${normalized}`;
    const candidate = map.get(key);
    if (candidate) {
      conflicts.push({
        conflictId: `C-${conflicts.length + 1 + map.size}`,
        type: "CONTRADICTION",
        severity: "HIGH",
        topic: principle.title,
        principleIds: [candidate.id, principle.id],
        overlappingScope: principle.scope,
        evidence: [],
        explanation: "Opposing strengths detected for the same normalized statement.",
        suggestedResolution: "Add an override block or consolidate the rules.",
        blocking: true,
      });
    }
    map.set(`${principle.strength}-${normalized}`, principle);
  }
  return conflicts;
}

export function buildConflicts(baseCommit: string, principles: Principle[]): ConflictsFile {
  const duplicates = detectDuplicates(principles);
  const contradictions = detectContradictions(principles);
  return {
    version: 1,
    base_commit: baseCommit,
    conflicts: [...duplicates, ...contradictions],
  };
}

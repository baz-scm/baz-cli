import type { Stats } from "fs";

export type Dialect =
  | "generic"
  | "claude"
  | "agents"
  | "cursor"
  | "bugbot"
  | "skills"
  | "custom";

export interface DocumentDescriptor {
  path: string;
  dialect: Dialect;
  docScope: string[];
  sha256: string;
}

export interface PrincipleSource {
  doc: string;
  span: { startLine: number; endLine: number };
  rawTextHash: string;
}

export interface Principle {
  id: string;
  title: string;
  strength: "MUST" | "SHOULD" | "MAY" | "MUST_NOT";
  statement: string;
  scope: string[];
  tags?: string[];
  rationale?: string;
  examples?: string[];
  sources?: PrincipleSource[];
  fingerprint?: string;
}

export interface Occurrence {
  principleId: string;
  doc: string;
  span: { startLine: number; endLine: number };
  anchor?: string;
}

export interface StateFile {
  version: number;
  repo: {
    root: string;
    head_commit: string;
  };
  documents: DocumentDescriptor[];
  principles: Principle[];
  occurrences: Occurrence[];
  llm?: Record<string, unknown>;
}

export interface ConflictEvidence {
  doc: string;
  span: { startLine: number; endLine: number };
}

export interface Conflict {
  conflictId: string;
  type:
    | "DUPLICATE"
    | "CONTRADICTION"
    | "PARAMETER_MISMATCH"
    | "OVERRIDE_MISSING"
    | "AMBIGUOUS_SCOPE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  topic: string;
  principleIds: string[];
  overlappingScope: string[];
  evidence: ConflictEvidence[];
  explanation: string;
  suggestedResolution: string;
  blocking: boolean;
}

export interface ConflictsFile {
  version: number;
  base_commit: string;
  conflicts: Conflict[];
}

export interface PlanChange {
  action: "create" | "update" | "delete";
  id: string;
  before_hash?: string;
  after_hash?: string;
}

export interface FilePatch {
  path: string;
  patch_unified: string;
}

export interface PlanFile {
  version: number;
  base_commit: string;
  principle_changes: PlanChange[];
  file_patches: FilePatch[];
  conflicts: { conflict_id: string; blocking: boolean }[];
  validation: {
    patch_constraints_ok: boolean;
    roundtrip_ok: boolean;
  };
}

export interface RepoEntry {
  path: string;
  stats: Stats;
}

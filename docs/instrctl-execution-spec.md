# instrctl Execution Specification

**A Terraform-inspired declarative tool to sync overlapping instruction markdown files using an LLM engine**

## 0) Summary

`instrctl` manages “instruction documents” (e.g. `CLAUDE.md`, `agents.md`, `bugbot.md`, `skills.md`, Cursor rules files) across a git repo. It creates a single canonical representation of rules (“principles”), detects conflicts, and can apply consistent updates across all relevant docs via PR.

It supports three core commands:

* **init**: discover docs → extract principles → write `state.json` + `conflicts.json`/`conflicts.md`
* **plan**: compare desired principles vs state → produce a validated patch plan (diffs)
* **apply**: apply plan → commit branch → open PR → update state

Key constraints:

* LLM outputs must be **schema-constrained** and **patch-bounded** (no freeform rewriting).
* Edits must be **deterministic** and validated by deterministic code.
* Tool must be safe: only modifies allowlisted files/sections; never touches code unless explicitly configured.

---

## 1) Goals & Non-goals

### Goals

1. **Canonicalize** all guideline definitions into a single state representation (“Principles”).
2. **Detect conflicts** across scopes and documents (duplication, contradiction, mismatch).
3. Provide a Terraform-like workflow: init/plan/apply.
4. **Apply synchronized updates** across docs and scopes through **pull requests**.
5. Be robust to heterogeneous instruction formats and document styles.
6. Minimize diffs; maintain human readability.

### Non-goals (explicitly out of scope)

* Enforcing or executing rules in runtime (that’s for linters/CI).
* Refactoring codebase behavior to satisfy principles.
* Perfect semantic understanding of rules (LLM-assisted, but validated).
* Managing non-markdown binary artifacts.

---

## 2) Glossary & Semantics

### 2.1 Principle

The smallest independently-managed guideline.

Required fields:

* `id` (stable string; generated once on init; thereafter tracked)
* `title`
* `strength` (enum: `MUST`, `SHOULD`, `MAY`, `MUST_NOT`)
* `statement` (canonical normative text)
* `scope` (list of git path globs; e.g. ["repo/**"], ["frontend/**"])
* `tags` (optional list)
* `rationale` (optional)
* `examples` (optional list)

### 2.2 Document

A markdown instruction file treated as a projection target.

* `path`
* `dialect` (enum: `generic`, `claude`, `cursor`, `agents`, `bugbot`, `skills`, `custom`)
* `doc_scope` (path globs inferred from file location + optional frontmatter)
* `sha256` (content hash)

### 2.3 Occurrence

A mapping from a principle to a concrete block in a document.

* `principle_id`
* `doc_path`
* `span` (line range)
* `raw_text_hash`
* `anchor` (optional marker-based anchor if “managed blocks” exist)

### 2.4 Scope

A list of glob patterns (gitignore-like) that define applicability.

#### Scope intersection rule

A principle applies to a document if:

* `doc_path` matches any pattern in `principle.scope` **AND**
* document `doc_scope` intersects principle scope (unless doc_scope is unknown → assume `repo/**`)

> Implementation MUST provide a deterministic “scope intersection” function that returns “unknown/possible” vs “disjoint” vs “intersects” for imperfect cases.

---

## 3) Repo Layout & Artifacts

`instrctl` stores its artifacts in `.instrctl/`.

```
.instrctl/
  instrctl.hcl           # desired declarative configuration (optional but recommended)
  state.json             # generated source-of-truth mapping + extracted principles
  conflicts.json         # generated conflict data
  conflicts.md           # generated human report
  plan.json              # generated plan output with patches
  cache/                 # LLM cache (by prompt+model+input hash)
```

### Artifact rules

* `state.json` is authoritative for **identity** (principle IDs).
* `instrctl.hcl` is authoritative for **desired state** during plan/apply.
* `conflicts.*` are derived.
* `plan.json` is required input to `apply` unless `apply` performs an internal `plan` (optional feature).

---

## 4) CLI Specification

### 4.1 Command overview

```
instrctl init [--config .instrctl/instrctl.hcl] [--write-config] [--include PATTERN...] [--exclude PATTERN...]
instrctl plan [--config .instrctl/instrctl.hcl] [--out .instrctl/plan.json] [--patch-out plan.diff] [--fail-on-conflicts]
instrctl apply [--plan .instrctl/plan.json] [--branch BRANCH] [--pr] [--remote origin] [--provider github|gitlab] [--dry-run]
instrctl check [--config ...]   # CI mode: fails if drift/conflicts exist
instrctl fmt [--config ...]     # formats HCL and/or managed blocks (optional)
```

### 4.2 Exit codes (strict)

* `0`: success
* `1`: generic failure
* `2`: conflicts detected (when `--fail-on-conflicts` or `check`)
* `3`: plan required/outdated (`apply` without valid plan)
* `4`: patch validation failed (LLM patch unsafe / violates constraints)
* `5`: git/PR operation failed

### 4.3 Terraform-like UX requirements

* `plan` prints a human-readable summary plus shows unified diffs.
* `apply` prints branch name + PR URL (if created).
* `check` prints any drift/conflict summary.

---

## 5) Instruction Document Discovery

### 5.1 Default include patterns

MUST scan repo (tracked files) for:

* `**/agents.md`
* `**/bugbot.md`
* `**/skills.md`
* `**/CLAUDE.md`, `**/claude.md`
* `**/.cursor/rules*`
* `**/cursor-rules*`
* Optionally: `**/*instruction*.md` (behind a flag; default OFF to avoid noise)

### 5.2 Excludes (defaults)

* `.git/**`
* `node_modules/**`, `vendor/**`, `dist/**`, `build/**`
* binaries

### 5.3 Dialect detection (deterministic)

* If filename matches known: `CLAUDE.md` → `claude`, `agents.md` → `agents`, etc.
* Cursor rules files → `cursor`
* Else `generic`

### 5.4 doc_scope inference

doc_scope is used to understand “local overrides” by folder:

* If file is at repo root → ["repo/**"]
* If file is under `path/to/subdir/` → default doc_scope is ["path/to/subdir/**"]
* If file includes frontmatter:

  ```md
  ---
  instrctl:
    scope: ["frontend/**"]
  ---
  ```

  then that overrides inferred doc_scope.

---

## 6) Declarative Desired State (instrctl.hcl)

### 6.1 Required blocks

#### `principle` block

```hcl
principle "P-2F9C1A" {
  title     = "Matplotlib only"
  strength  = "MUST_NOT"
  statement = "Do NOT use seaborn for charts; use matplotlib only."
  scope     = ["repo/**"]
  tags      = ["python", "visualization"]
  rationale = "Consistency and fewer dependencies."
  examples  = [
    "Use matplotlib.pyplot for plots.",
    "Do not import seaborn."
  ]
}
```

#### `override` block

Overrides must be explicit to prevent “silent contradiction”:

```hcl
override "P-BASEID" "P-OVERRIDEID" {
  scope     = ["frontend/**"]
  statement = "Frontend copy-only changes MAY omit tests."
  reason    = "No stable UI test suite yet."
  expires_on = "2026-06-01"  # optional
}
```

### 6.2 Config for discovery/rendering (optional)

```hcl
settings {
  include = ["**/CLAUDE.md", "**/agents.md", "**/bugbot.md", "**/skills.md", "**/.cursor/rules*"]
  exclude = ["vendor/**", "node_modules/**"]
  managed_blocks = true
}

rendering {
  dialect "claude" {
    section_heading = "## Instructions"
  }
  dialect "agents" {
    section_heading = "## Agent Rules"
  }
  default_section_heading = "## Managed Principles"
}
```

---

## 7) State, Plan, Conflicts: Schemas

### 7.1 state.json (canonical state)

#### Required fields

* `version`
* `repo.root`
* `repo.head_commit`
* `repo.tracked_patterns`
* `documents[]`
* `principles[]`
* `occurrences[]`
* `llm` metadata

#### JSON Schema (implementation MUST validate)

You can embed this in code as JSON Schema or equivalent type validation.

**High-level structure (abbreviated but contract-grade):**

```json
{
  "version": 1,
  "repo": {"root": "...", "head_commit": "..."},
  "documents": [
    {
      "path": "CLAUDE.md",
      "dialect": "claude",
      "doc_scope": ["repo/**"],
      "sha256": "..."
    }
  ],
  "principles": [
    {
      "id": "P-XXXXXX",
      "title": "string",
      "strength": "MUST|SHOULD|MAY|MUST_NOT",
      "statement": "string",
      "scope": ["glob", "..."],
      "tags": ["..."],
      "rationale": "string?",
      "examples": ["..."],
      "sources": [
        {"doc": "path", "span": {"start_line": 1, "end_line": 10}, "raw_text_hash": "..."}
      ],
      "fingerprint": "sha256(normalized statement + strength + tags?)"
    }
  ],
  "occurrences": [
    {
      "principle_id": "P-XXXXXX",
      "doc": "path",
      "span": {"start_line": 10, "end_line": 20},
      "anchor": "instrctl:begin P-XXXXXX"
    }
  ],
  "llm": {
    "provider": "openai|anthropic|local",
    "model": "string",
    "prompt_versions": {"extract": "v1", "conflicts": "v1", "patch": "v1"}
  }
}
```

### 7.2 conflicts.json

```json
{
  "version": 1,
  "base_commit": "abc123",
  "conflicts": [
    {
      "conflict_id": "C-0007",
      "type": "DUPLICATE|CONTRADICTION|PARAMETER_MISMATCH|OVERRIDE_MISSING|AMBIGUOUS_SCOPE",
      "severity": "LOW|MEDIUM|HIGH",
      "topic": "string",
      "principle_ids": ["P-1", "P-2"],
      "overlapping_scope": ["glob", "..."],
      "evidence": [{"doc": "path", "span": {"start_line": 1, "end_line": 3}}],
      "explanation": "string",
      "suggested_resolution": "string",
      "blocking": true
    }
  ]
}
```

### 7.3 plan.json

```json
{
  "version": 1,
  "base_commit": "abc123",
  "principle_changes": [
    {"action": "create|update|delete", "id": "P-...", "before_hash": "...?", "after_hash": "...?"}
  ],
  "file_patches": [
    {"path": "CLAUDE.md", "patch_unified": "diff..."},
    {"path": "agents.md", "patch_unified": "diff..."}
  ],
  "conflicts": [{"conflict_id": "C-0007", "blocking": true}],
  "validation": {
    "patch_constraints_ok": true,
    "roundtrip_ok": true
  }
}
```

---

## 8) init: Extraction & Conflict Detection

### 8.1 init flow (step-by-step)

1. Ensure repo root discovered (git).
2. Enumerate candidate files using include/exclude rules.
3. Read each document; compute sha256.
4. Parse document into “sections” (headings) and raw text blocks.
5. Extract principles using LLM (see §11 prompts).
6. Assign principle IDs:

   * If no previous state exists: generate new ID (`P-` + 6–8 chars) from cryptographic random.
   * If previous state exists (future enhancement): attempt matching by fingerprint similarity to reuse IDs.
7. Emit `state.json` with principles + occurrences.
8. Run conflict detection (heuristics + LLM classification on candidates).
9. Write `conflicts.json` and `conflicts.md`.

### 8.2 Extraction rules

* A principle must contain:

  * a normative keyword (MUST/SHOULD/MAY/MUST NOT) OR equivalent modal language
* Prefer splitting large lists into atomic principles.
* Preserve source spans.

**Normalization (for fingerprints)**

* Lowercase statement
* collapse whitespace
* strip punctuation except negation markers
* include `strength` in fingerprint

### 8.3 Managed blocks adoption (init behavior)

Default: init does **not** edit files.

Optional feature `init --write-config`:

* generates `.instrctl/instrctl.hcl` containing extracted principles
* marks it as “generated; please edit”

---

## 9) Conflict Detection Rules

### 9.1 Candidate generation (deterministic pre-filter)

To avoid O(n²), generate candidate pairs by:

* same tag overlap OR same dialect cluster OR cosine similarity of token TF-IDF (local)
* plus scope intersection likely true

### 9.2 Conflict classification

For each candidate pair/cluster:

* Determine scope overlap
* Classify:

  * DUPLICATE: same meaning, different wording
  * CONTRADICTION: must vs must_not or mutually exclusive requirements
  * PARAMETER_MISMATCH: same rule but different thresholds (e.g. “90% coverage” vs “80%”)
  * OVERRIDE_MISSING: specific rule contradicts general but no override declared
  * AMBIGUOUS_SCOPE: unclear applicability

LLM is allowed to:

* assign topic label
* classify type
* provide explanation and suggested resolution

### 9.3 Blocking rules

Default:

* `CONTRADICTION/HIGH` blocks `apply` and fails `check`
* `OVERRIDE_MISSING/HIGH` blocks (because it’s likely unintentional)
* DUPLICATE doesn’t block but is reported

Override mechanism:

* A conflict can be “resolved” by explicit override blocks in config.

---

## 10) plan: Desired State → Patches

### 10.1 Inputs

* `.instrctl/state.json` (must exist)
* `.instrctl/instrctl.hcl` (desired declarations)
* current working tree (should be clean; if not, plan should warn and continue or fail based on flag)

### 10.2 Plan computation

1. Load state principles (current).
2. Load config principles+overrides (desired).
3. Compute change set:

   * create: in config not in state
   * update: same id, different canonical fields
   * delete: present in state but removed from config (only if explicitly enabled; default: do not delete unmanaged principles unless flag `--allow-delete`)
4. Determine impacted docs per principle change:

   * docs whose `doc_scope` intersects principle scope
   * dialect rules may exclude inclusion (configurable)
5. For each impacted doc, determine edit operations:

   * If occurrence exists: update that span (prefer managed blocks)
   * Else: insert principle into dialect section (create section if missing)

### 10.3 Where to insert (deterministic)

For each doc:

* If managed blocks are enabled and section exists: insert under that section.
* Else look for heading candidates by dialect:

  * `claude`: `## Instructions`, `## Guidelines`
  * `agents`: `## Agent Rules`, `## Rules`
  * `skills`: `## Standards`, `## Workflow`
* If none found: append a new section:

  * `## Managed Principles`
  * include a short explanation comment line

Insertion order:

* sort by `strength` (MUST_NOT, MUST, SHOULD, MAY) then `title`

### 10.4 Patch generation contract

LLM may be used for:

* rewriting a specific principle text into target dialect style (still same meaning)
* generating minimal patch for bounded region

But the tool MUST constrain:

* allowed files
* allowed spans
* insertion points
* output must be unified diff
* patch must pass deterministic validation

**Patch constraints**

* Only files discovered in init (or explicitly allowed new docs) may be modified.
* Only lines within:

  * `<!-- instrctl:begin ... -->` / `<!-- instrctl:end ... -->` blocks
  * OR the `## Managed Principles` section (tool-managed region)
* No other lines may change.
* Diff must apply cleanly on `plan.base_commit`.

### 10.5 Round-trip validation (mandatory)

After applying patch in-memory:

* Re-run extraction on modified docs (fast-path parser).
* Ensure the extracted principles for those blocks match desired state:

  * `id` preserved
  * `strength` preserved
  * statement semantically equivalent (use fingerprint match or LLM equivalence check; prefer deterministic fingerprint if rendering preserves canonical statement)

**Recommended approach**

* Store canonical statement in managed block as a single line to preserve fingerprint determinism, and allow dialect formatting around it.

---

## 11) LLM Integration Spec (Engine Contract)

### 11.1 Provider interface

Implementation must define an interface:

* `ExtractPrinciples(document_text, dialect, doc_path, doc_scope) -> ExtractResult`
* `ClassifyConflicts(principles_cluster) -> ConflictResult`
* `GeneratePatch(context, constraints, desired_snippet) -> UnifiedDiff`

Providers:

* `openai`
* `anthropic`
* `local` (optional)

### 11.2 Strict schemas for responses

Responses MUST be parsed with strict JSON schema validation.

#### ExtractResult schema

```json
{
  "principles": [
    {
      "title": "string",
      "strength": "MUST|SHOULD|MAY|MUST_NOT",
      "statement": "string",
      "tags": ["string"],
      "rationale": "string?",
      "examples": ["string"],
      "source_span": {"start_line": 1, "end_line": 5}
    }
  ]
}
```

#### PatchResult schema

Either:

* `{ "patch_unified": "diff..." }`

No other content allowed.

### 11.3 Prompting constraints

* Temperature low (0–0.3).
* Must include file path, dialect, and explicit rules like:

  * “Do not add new requirements”
  * “Do not modify outside bounded lines”
* Provide examples of acceptable output.

### 11.4 Caching

Cache key:

* `(provider, model, prompt_version, input_sha256)`
  Store:
* raw response
* parsed response
* validation result

---

## 12) Managed Blocks (Strong Recommendation)

### 12.1 Marker format

Use HTML comments:

```md
<!-- instrctl:begin P-2F9C1A -->
- **MUST NOT** use seaborn for charts; use matplotlib only.
<!-- instrctl:end P-2F9C1A -->
```

### 12.2 Adoption policy

* `init` does not modify docs
* First `apply` may add managed blocks if `settings.managed_blocks=true`
* If a doc already contains blocks, use them

### 12.3 Human editing rules

Humans can edit inside blocks; `instrctl` will overwrite to match desired state on apply.

---

## 13) apply: Git & Pull Request Workflow

### 13.1 Preconditions

* working tree clean OR `--allow-dirty` (default: fail if dirty)
* HEAD commit equals `plan.base_commit` (default: fail; optional: allow rebase mode)

### 13.2 Apply steps

1. Read `plan.json`
2. Validate plan still applies:

   * base_commit matches HEAD
   * patches apply cleanly in-memory
3. Write updated files
4. Run validation:

   * patch constraints check
   * round-trip principle match
5. Create branch (default): `instrctl/apply-YYYYMMDD-HHMMSS`
6. Commit with message:

   * `instrctl: sync principles (N changes)`
7. Push to remote
8. Create PR (if `--pr`):

   * Title: `Sync instruction principles`
   * Body includes:

     * summary of principle changes
     * conflicts resolved / remaining
     * “Managed by instrctl” note

### 13.3 PR providers

Minimum viable:

* GitHub via `gh` CLI OR API token env var.
* GitLab (optional second provider).

Provider config:

```hcl
vcs {
  provider = "github"
  remote   = "origin"
  repo     = "org/name"
}
```

---

## 14) Deterministic Safety Checks (MUST implement)

These are non-negotiable to avoid LLM-induced repo damage.

### 14.1 Allowed file set

* Only files discovered in init may be modified, unless config explicitly allows creating a new instruction doc.

### 14.2 Allowed region check

For each patch:

* Parse unified diff
* For each hunk, verify:

  * modified lines fall within a managed block OR managed section boundaries
  * else fail with exit code `4`

### 14.3 No code modification default

Default policy:

* do not modify files outside instruction doc patterns
* config can opt-in additional files but must be explicit

### 14.4 Plan/apply idempotency

Two consecutive apply runs on same desired config should result in no changes (clean plan).

---

## 15) Rendering & Dialect Adapters

### 15.1 Canonical vs rendered text

Canonical statement must remain stable; rendered text may vary by dialect but must not change meaning.

Recommended rendering template:

* Bullet with strength emphasized:

  * `- **MUST** …`
  * `- **MUST NOT** …`

Optional dialect expansions:

* claude: add “When in doubt…” style clarifications (but only if derived from canonical rationale/examples)

### 15.2 Adapter contract

`render(principle, dialect) -> markdown_block`

Rules:

* Must include the `strength` keyword explicitly.
* Must include the canonical `statement` verbatim OR embed it as a machine-readable string inside the managed block (preferred for round-trip).

---

## 16) Testing & CI Requirements

### 16.1 Unit tests (required)

* Glob scope intersection function
* Document discovery include/exclude
* Markdown heading/section detection
* Managed block parsing and span location
* Unified diff parsing + allowed-region validation
* State/config diff computation (create/update/delete)

### 16.2 Integration tests (required)

Create a `testdata/` repo fixture with:

* overlapping scopes
* contradictions (pnpm vs yarn)
* duplicates across docs
* missing headings (forces fallback section insertion)

Test flows:

* `init` produces stable `state.json` and `conflicts.json`
* `plan` produces expected patch
* `apply` applies patch in a temp git repo without PR creation

### 16.3 Golden file testing

* Snapshot `conflicts.md` and `plan.diff` in fixtures.

### 16.4 CI “check” mode

`instrctl check` must:

* fail if conflicts blocking
* fail if docs drift from config (rendered blocks mismatch desired)
* print actionable output

---

## 17) Performance Requirements

* Repo scan should be incremental:

  * skip unchanged docs via sha256 + cache
* LLM calls:

  * extraction calls only for changed docs
  * conflict classification only on candidate clusters
  * patch generation only for bounded regions

---

## 18) Milestones & Deliverables (Implementation Plan)

### Milestone A — Core init

Deliver:

* CLI skeleton
* discovery
* extraction (LLM provider stub + schema validation)
* state.json writing
* basic conflict detection (heuristics only) + conflicts.md

### Milestone B — plan with deterministic patch constraints

Deliver:

* config parser for HCL
* diff of desired vs state
* render adapters (basic)
* bounded patch generation
* patch validation (allowed regions, apply cleanly)
* plan.json output + printed diff

### Milestone C — apply via PR

Deliver:

* apply plan patches
* git branch/commit/push
* GitHub PR creation (at least via `gh`)

### Milestone D — Robustness & adoption

Deliver:

* managed blocks adoption on apply
* override semantics + conflict resolution rules
* check command for CI
* caching

---

## 19) Open Decisions (Make defaults, don’t block implementation)

To avoid stalling, implement with defaults:

1. **ID generation**: random stable IDs at init; stored in state.
2. **Canonical statement**: stored verbatim in managed block for deterministic matching.
3. **Overrides**: required to legalize contradictions in narrower scopes.
4. **Where to write config**: optional `init --write-config` to bootstrap.

---

## 20) Concrete Acceptance Criteria (Definition of Done)

A repo containing:

* `CLAUDE.md` at root
* `frontend/agents.md`
* `skills.md`
  with overlapping, contradictory rules…

Must support:

1. `instrctl init` generates state + conflicts with correct spans and at least one contradiction detected.
2. Editing `.instrctl/instrctl.hcl` to resolve contradiction causes:

   * `instrctl plan` to output a patch affecting all relevant docs
3. `instrctl apply --pr`:

   * creates a branch
   * commits changes
   * opens a PR
4. Running `instrctl plan` again yields **no diff**.

---

## Appendix A: conflicts.md format (human report)

Must include:

* Summary counts by severity/type
* Each conflict with:

  * involved principle IDs
  * doc paths and line ranges
  * explanation and suggested resolution
  * whether blocking

---

## Appendix B: Security / Privacy

* Never send non-instruction files to LLM by default.
* Provide config option `settings.llm_redaction=true` to redact emails/secrets patterns.
* Store LLM cache locally; do not commit `.instrctl/cache/`.

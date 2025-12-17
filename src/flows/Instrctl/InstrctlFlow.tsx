import React, { useEffect, useMemo, useState } from "react";
import { Box, Newline, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { applyPlan, type ApplyPhase } from "../../instrctl/apply.js";
import { buildPlan } from "../../instrctl/plan.js";
import { writeStateFiles } from "../../instrctl/state.js";
import { readConflicts } from "../../instrctl/utils.js";
import type { ConflictsFile, PlanFile } from "../../instrctl/types.js";

type FlowMode = "init" | "plan" | "apply";
type StepStatus = "pending" | "active" | "success" | "error";

type Step = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

const STEP_PRESETS: Record<FlowMode, Step[]> = {
  init: [
    { id: "discover", label: "Discover instruction docs", status: "pending" },
    { id: "conflicts", label: "Detect conflicts", status: "pending" },
    { id: "write", label: "Write state & reports", status: "pending" },
  ],
  plan: [
    { id: "conflicts", label: "Validate conflicts", status: "pending" },
    { id: "render", label: "Render managed sections", status: "pending" },
    { id: "validate", label: "Validate plan", status: "pending" },
  ],
  apply: [
    { id: "validate", label: "Validate plan", status: "pending" },
    { id: "apply", label: "Apply patches", status: "pending" },
    { id: "refresh", label: "Refresh state", status: "pending" },
  ],
};

const ICON = {
  pending: "○",
  success: "✔",
  error: "✖",
} as const;

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "gray",
  active: "cyan",
  success: "green",
  error: "red",
};

function clonePreset(mode: FlowMode): Step[] {
  return STEP_PRESETS[mode].map((step) => ({ ...step }));
}

function StepRow({ step }: { step: Step }) {
  const staticIcon = step.status === "active" ? ICON.pending : ICON[step.status as keyof typeof ICON];
  const icon =
    step.status === "active" ? (
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
    ) : (
      <Text color={STATUS_COLOR[step.status]}>{staticIcon ?? ICON.pending}</Text>
    );

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1} alignItems="center">
        <Box width={3} justifyContent="center">
          {icon}
        </Box>
        <Text color={STATUS_COLOR[step.status]} bold>
          {step.label}
        </Text>
      </Box>
      {step.detail ? (
        <Box paddingLeft={4}>
          <Text color="gray">{step.detail}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function findUpdateIndex(steps: Step[]): number {
  const active = steps.findIndex((s) => s.status === "active");
  if (active >= 0) return active;
  return steps.findIndex((s) => s.status === "pending");
}

function describeConflicts(conflicts: ConflictsFile | null): { summary: string; blocking: number } {
  const total = conflicts?.conflicts.length ?? 0;
  const blocking = conflicts?.conflicts.filter((c) => c.blocking).length ?? 0;
  const summary = total ? `${total} conflict${total === 1 ? "" : "s"} (${blocking} blocking)` : "No conflicts";
  return { summary, blocking };
}

export default function InstrctlFlow({ mode }: { mode: FlowMode }) {
  const { exit } = useApp();
  const [steps, setSteps] = useState<Step[]>(() => clonePreset(mode));
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSteps(clonePreset(mode));
    setSummary(null);
    setError(null);
  }, [mode]);

  const setStepStatus = (id: string, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, status, detail } : step)));
  };

  const markError = (message: string, exitCode: number) => {
    setSteps((prev) => {
      const updated = [...prev];
      const index = findUpdateIndex(updated);
      if (index >= 0) {
        updated[index] = { ...updated[index], status: "error", detail: message };
      }
      return updated;
    });
    setError(message);
    exit(exitCode);
  };

  const handleUnhandledError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const exitCode = typeof err === "object" && err && "exitCode" in err ? Number((err as { exitCode?: number }).exitCode) : 1;
    markError(message, Number.isNaN(exitCode) ? 1 : exitCode);
  };

  const runInit = async () => {
    try {
      setStepStatus("discover", "active");
      const { state, conflicts } = await writeStateFiles();
      setStepStatus(
        "discover",
        "success",
        `Found ${state.documents.length} docs and ${state.principles.length} principles`,
      );

      setStepStatus("conflicts", "active");
      const { summary: conflictSummary, blocking } = describeConflicts(conflicts);
      setStepStatus("conflicts", blocking ? "error" : "success", conflictSummary);
      if (blocking) {
        setError("Blocking conflicts detected; resolve before continuing.");
        exit(2);
        return;
      }

      setStepStatus("write", "success", "State and conflict files updated in .instrctl/");
      setSummary("init complete. managed files refreshed.");
      exit();
    } catch (err) {
      handleUnhandledError(err);
    }
  };

  const runPlan = async () => {
    try {
      setStepStatus("conflicts", "active");
      const conflicts = readConflicts();
      const { summary: conflictSummary, blocking } = describeConflicts(conflicts);
      setStepStatus("conflicts", blocking ? "error" : "success", conflictSummary);
      if (blocking) {
        setError("Blocking conflicts detected; resolve before planning.");
        exit(2);
        return;
      }

      setStepStatus("render", "active");
      const plan = buildPlan();
      setStepStatus("render", "success", `Generated ${plan.file_patches.length} patch${plan.file_patches.length === 1 ? "" : "es"}`);

      setStepStatus("validate", "active");
      const blockingConflicts = plan.conflicts.filter((c) => c.blocking).length;
      if (blockingConflicts) {
        setStepStatus("validate", "error", `${blockingConflicts} blocking conflict${blockingConflicts === 1 ? "" : "s"} in plan`);
        setError("Blocking conflicts detected in plan output.");
        exit(2);
        return;
      }

      if (!plan.validation.patch_constraints_ok) {
        setStepStatus("validate", "error", "Patch constraints failed");
        setError("Patch validation failed while building plan.");
        exit(4);
        return;
      }

      setStepStatus("validate", "success", "Patch constraints satisfied");
      setSummary("plan complete. Review .instrctl/plan.json before apply.");
      exit();
    } catch (err) {
      handleUnhandledError(err);
    }
  };

  const runApply = async () => {
    try {
      setStepStatus("validate", "active");
      let patched = 0;
      const plan: PlanFile = await applyPlan((phase: ApplyPhase, detail?: string) => {
        if (phase === "validate") {
          setStepStatus("validate", "active", "Checking plan, base commit, conflicts");
        }
        if (phase === "patch") {
          patched += 1;
          setStepStatus("apply", "active", detail ? `Applying ${detail}` : "Applying managed patches");
        }
        if (phase === "state") {
          setStepStatus("apply", "success", `Applied ${patched} patch${patched === 1 ? "" : "es"}`);
          setStepStatus("refresh", "active", "Updating state and conflicts");
        }
      });

      setStepStatus("refresh", "success", "State rebuilt after apply");
      setSummary(`apply complete. ${plan.file_patches.length} patch${plan.file_patches.length === 1 ? "" : "es"} applied.`);
      exit();
    } catch (err) {
      handleUnhandledError(err);
    }
  };

  useEffect(() => {
    if (mode === "init") runInit();
    if (mode === "plan") runPlan();
    if (mode === "apply") runApply();
  }, [mode]);

  const title = useMemo(() => {
    if (mode === "init") return "instrctl init";
    if (mode === "plan") return "instrctl plan";
    return "instrctl apply";
  }, [mode]);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1} borderColor="cyan">
      <Text color="cyan" bold>
        {title}
      </Text>
      <Newline />
      <Box flexDirection="column">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </Box>
      {summary ? (
        <Text color="green">
          {summary}
        </Text>
      ) : null}
      {error ? (
        <Text color="red">
          {error}
        </Text>
      ) : null}
    </Box>
  );
}

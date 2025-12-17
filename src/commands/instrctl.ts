import { Command } from "commander";
import { applyPlan } from "../instrctl/apply.js";
import { buildPlan } from "../instrctl/plan.js";
import { writeStateFiles } from "../instrctl/state.js";
import { readConflicts } from "../instrctl/utils.js";

export function createInstrctlCommand(): Command {
  const cmd = new Command("instrctl");
  cmd.description("Manage instruction documents and keep them in sync");

  cmd
    .command("init")
    .description("Discover instruction documents and generate state")
    .action(async () => {
      try {
        const { state, conflicts } = await writeStateFiles();
        console.log(`Found ${state.documents.length} documents and ${state.principles.length} principles.`);
        console.log(`Conflicts written to .instrctl/conflicts.json (${conflicts.conflicts.length} entries).`);
        if (conflicts.conflicts.some((c) => c.blocking)) {
          process.exit(2);
        }
      } catch (error) {
        console.error(String(error));
        process.exit(1);
      }
    });

  cmd
    .command("plan")
    .description("Compute a plan to align documents with desired principles")
      try {
        const repoRoot = getRepoRoot();
        const state = readState(repoRoot);
        const conflicts = buildConflicts(state.repo.head_commit, state.principles);
        if (conflicts.conflicts.some((c) => c.blocking)) {
          console.error("Blocking conflicts detected; resolve before planning.");
          process.exit(2);
          return;
        }
        if (!plan.validation.patch_constraints_ok) {
          console.error("Patch validation failed while building plan.");
          process.exit(4);
          return;
        }
        console.log(`Generated plan with ${plan.file_patches.length} file patches.`);
      } catch (error: unknown) {
        const err = error as { exitCode?: number };
        console.error(String(error));
        process.exit(err?.exitCode ?? 1);
      }
    });

  cmd
    .command("apply")
    .description("Apply the previously generated plan")
    .action(async () => {
      try {
        const plan = await applyPlan();
        console.log(`Applied ${plan.file_patches.length} patches.`);
      } catch (error: unknown) {
        const err = error as { exitCode?: number };
        console.error(String(error));
        process.exit(err?.exitCode ?? 1);
      }
    });

  return cmd;
}

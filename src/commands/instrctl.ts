import { Command } from "commander";
import { applyPlan } from "../instrctl/apply.js";
import { buildPlan } from "../instrctl/plan.js";
import { writeStateFiles } from "../instrctl/state.js";

export function createInstrctlCommand(): Command {
  const cmd = new Command("instrctl");
  cmd.description("Manage instruction documents and keep them in sync");

  cmd
    .command("init")
    .description("Discover instruction documents and generate state")
    .action(async () => {
      const { state, conflicts } = await writeStateFiles();
      console.log(`Found ${state.documents.length} documents and ${state.principles.length} principles.`);
      console.log(`Conflicts written to .instrctl/conflicts.json (${conflicts.conflicts.length} entries).`);
    });

  cmd
    .command("plan")
    .description("Compute a plan to align documents with desired principles")
    .action(() => {
      const plan = buildPlan();
      console.log(`Generated plan with ${plan.file_patches.length} file patches.`);
    });

  cmd
    .command("apply")
    .description("Apply the previously generated plan")
    .action(async () => {
      const plan = await applyPlan();
      console.log(`Applied ${plan.file_patches.length} patches.`);
    });

  return cmd;
}

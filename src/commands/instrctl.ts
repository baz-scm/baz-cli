import { Command } from "commander";
import { render } from "ink";
import React from "react";
import InstrctlFlow from "../flows/Instrctl/InstrctlFlow.js";

export function createInstrctlCommand(): Command {
  const cmd = new Command("instrctl");
  cmd.description("Manage instruction documents and keep them in sync");

  cmd
    .command("init")
    .description("Discover instruction documents and generate state")
    .action(async () => {
      const app = render(React.createElement(InstrctlFlow, { mode: "init" }));
      await app.waitUntilExit();
    });

  cmd
    .command("plan")
    .description("Compute a plan to align documents with desired principles")
    .action(async () => {
      const app = render(React.createElement(InstrctlFlow, { mode: "plan" }));
      await app.waitUntilExit();
    });

  cmd
    .command("apply")
    .description("Apply the previously generated plan")
    .action(async () => {
      const app = render(React.createElement(InstrctlFlow, { mode: "apply" }));
      await app.waitUntilExit();
    });

  return cmd;
}

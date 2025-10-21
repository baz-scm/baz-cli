#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import ReviewFlow from "./flows/Review";
import { createAuthCommand } from "./commands/auth.js";

const program = new Command();

program.name("Baz CLI").version("0.1.0");

program
  .command("review")
  .description("Start a review")
  .action(async () => {
    render(React.createElement(ReviewFlow));
  });

program.addCommand(createAuthCommand());

program.parseAsync();

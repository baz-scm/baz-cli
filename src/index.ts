#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import ReviewFlow from "./flows/Review.js";
import { createAuthCommand } from "./commands/auth.js";

const VERSION = "0.2.2"; // x-release-please-version

const program = new Command();

program.name("Baz CLI").version(VERSION);

program
  .command("review", { isDefault: true })
  .description("Start a review")
  .action(async () => {
    render(React.createElement(ReviewFlow));
  });

program.addCommand(createAuthCommand());

program.parseAsync();

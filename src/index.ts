#!/usr/bin/env node

import { Command } from "commander";
import figlet from "figlet";
import chalk from "chalk";
import { render } from "ink";
import React from "react";
import RepositorySelectorContainer from "./components/RepositorySelectorContainer.js";
import RepositoryAutocompleteContainer from "./components/RepositoryAutocompleteContainer";
import ReviewFlow from "./flows/Review";
import { createAuthCommand } from "./commands/auth.js";

const program = new Command();

console.log(
  chalk.hex("#191970")(figlet.textSync("Baz CLI", { font: "DOS Rebel" })),
);

program.name("Baz CLI").version("0.1.0");

program
  .command("review")
  .description("Start a review")
  .action(async () => {
    render(React.createElement(ReviewFlow));
  });

program
  .command("select-repo")
  .description("Select a repository")
  .action(async () => {
    const { unmount } = render(
      React.createElement(RepositorySelectorContainer, {
        onSelect: (repo) => {
          unmount(); // Unmount the Ink app first
          console.log(chalk.green("\n✨ You selected:"));
          console.log(chalk.yellow(`   Repository: ${repo.fullName}`));
          if (repo.description) {
            console.log(chalk.gray(`   Description: ${repo.description}`));
          }
          process.exit(0);
        },
      }),
    );
  });

program
  .command("search-repo")
  .description("Search for a repository with autocomplete")
  .action(async () => {
    const { unmount } = render(
      React.createElement(RepositoryAutocompleteContainer, {
        onSelect: (repo) => {
          unmount();
          console.log(chalk.green("\n✨ You selected:"));
          console.log(chalk.yellow(`   Repository: ${repo.fullName}`));
          if (repo.description) {
            console.log(chalk.gray(`   Description: ${repo.description}`));
          }
          process.exit(0);
        },
      }),
    );
  });

program.addCommand(createAuthCommand());

program.parseAsync();

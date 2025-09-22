#!/usr/bin/env node

import { Command } from "commander";
import figlet from "figlet";
import chalk from "chalk";

const program = new Command();

console.log(chalk.hex('#191970')(figlet.textSync("Baz CLI", { font: "DOS Rebel" })));

program.name("Baz CLI").version("0.1.0");

program.parse();

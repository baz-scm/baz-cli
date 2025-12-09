#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import ReviewFlow from "./flows/Review/Review.js";
import { createAuthCommand } from "./commands/auth.js";
import {
  AppModeProvider,
  getAppConfig,
  AppConfigError,
  AppConfig,
} from "./lib/config/index.js";
import {
  HeadlessReviewDependencies,
  HeadlessRunOptions,
  HeadlessReviewResult,
  runHeadlessReview,
} from "./headless/review-runner.js";

const VERSION = "0.3.0"; // x-release-please-version

type OutputFormat = "json" | "markdown";

interface HeadlessCliOptions {
  headless?: boolean;
  repo?: string;
  pr?: string;
  run?: string;
  output?: OutputFormat;
  failOn?: string;
}

interface HeadlessRunConfig {
  options: HeadlessRunOptions;
  output: OutputFormat;
  failOn: Set<string>;
}

const program = new Command();

function renderInteractiveReview(_config: AppConfig) {
  render(
    React.createElement(
      AppModeProvider,
      null,
      React.createElement(ReviewFlow),
    ),
  );
}

export function parseRunOptions(runArgument?: string): {
  runSpec: boolean;
  runSummary: boolean;
} {
  if (!runArgument) {
    return { runSpec: true, runSummary: true };
  }

  const selections = new Set(
    runArgument
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean),
  );

  const allowed = ["spec", "summary"];
  for (const selection of selections) {
    if (!allowed.includes(selection)) {
      throw new Error(
        `Invalid run option "${selection}". Allowed values: ${allowed.join(",")}`,
      );
    }
  }

  const runSpec = selections.has("spec");
  const runSummary = selections.has("summary");

  return {
    runSpec,
    runSummary,
  };
}

function parseOutputFormat(output?: string): OutputFormat {
  if (!output) {
    return "json";
  }

  if (output !== "json" && output !== "markdown") {
    throw new Error("Output must be either json or markdown");
  }

  return output;
}

export function parseFailOn(failOnArgument?: string): Set<string> {
  if (!failOnArgument) {
    return new Set();
  }

  const allowed = new Set(["unmet_requirements"]);
  const provided = new Set(
    failOnArgument
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean),
  );

  for (const entry of provided) {
    if (!allowed.has(entry)) {
      throw new Error(
        `Invalid fail-on option "${entry}". Allowed values: ${Array.from(allowed).join(",")}`,
      );
    }
  }

  return provided;
}

export function buildHeadlessRunConfig(
  cmdOptions: HeadlessCliOptions,
  config: AppConfig,
): HeadlessRunConfig {
  const repo = cmdOptions.repo ?? process.env.BAZ_REPO;
  const prInput = cmdOptions.pr ?? process.env.BAZ_PR_NUMBER;
  const prNumber = prInput ? Number.parseInt(prInput, 10) : undefined;

  if (repo && !repo.includes("/")) {
    throw new Error("Repository must be in the format <owner>/<name>");
  }

  if (prInput && (Number.isNaN(prNumber) || (prNumber ?? 0) <= 0)) {
    throw new Error("Pull request number must be a positive integer");
  }

  const { runSpec, runSummary } = parseRunOptions(cmdOptions.run);
  const output = parseOutputFormat(cmdOptions.output);
  const failOn = parseFailOn(cmdOptions.failOn);

  const options: HeadlessRunOptions = {
    repo,
    prNumber,
    runSpec,
    runSummary,
    mode: config.mode.name,
  };

  return { options, output, failOn };
}

function formatMarkdown(result: HeadlessReviewResult): string {
  const lines: string[] = [];
  lines.push(`# PR #${result.pr.number}: ${result.pr.title}`);
  lines.push(`Repository: ${result.pr.repository}`);

  if (result.summary) {
    lines.push("\n## Summary");
    lines.push(`- Files changed: ${result.summary.filesChanged}`);
    lines.push(`- Lines added: ${result.summary.linesAdded}`);
    lines.push(`- Lines deleted: ${result.summary.linesDeleted}`);
  }

  if (result.spec) {
    lines.push("\n## Spec Review");
    lines.push(`- Supported: ${result.spec.supported ? "yes" : "no"}`);
    if (result.spec.latestStatus) {
      lines.push(`- Latest status: ${result.spec.latestStatus}`);
    }
    lines.push(`- Unmet requirements: ${result.spec.unmetRequirements}`);
    lines.push(`- Met requirements: ${result.spec.metRequirements}`);
  }

  return lines.join("\n");
}

function serializeResult(
  results: HeadlessReviewResult[],
  format: OutputFormat,
): string {
  if (format === "markdown") {
    return results.map((result) => formatMarkdown(result)).join("\n\n---\n\n");
  }

  return JSON.stringify(results, null, 2);
}

export function applyFailurePolicy(
  results: HeadlessReviewResult[],
  failOn: Set<string>,
): number {
  for (const result of results) {
    if (
      failOn.has("unmet_requirements") &&
      result.spec?.supported &&
      result.spec.unmetRequirements > 0
    ) {
      return 2;
    }
  }

  return 0;
}

export async function runHeadlessEntryPoint(
  cmdOptions: HeadlessCliOptions,
  config: AppConfig,
  dependencies?: HeadlessReviewDependencies,
): Promise<number> {
  try {
    const { options, output, failOn } = buildHeadlessRunConfig(
      cmdOptions,
      config,
    );

    const results = await runHeadlessReview(options, config, dependencies);
    const serialized = serializeResult(results, output);
    console.log(serialized);

    return applyFailurePolicy(results, failOn);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(message);
    return 1;
  }
}

program.name("Baz CLI").version(VERSION);

program
  .command("review", { isDefault: true })
  .description("Start a review")
  .option("--headless", "Run in non interactive mode")
  .option("--repo <owner/name>", "Repository slug, for headless mode")
  .option("--pr <number>", "Pull request number, for headless mode")
  .option(
    "--run <list>",
    "Comma separated flows to run, e.g. spec,summary",
  )
  .option("--output <format>", "Output format: json or markdown")
  .option(
    "--fail-on <list>",
    "Comma separated list of failure conditions",
  )
  .action(async (cmdOptions: HeadlessCliOptions) => {
    try {
      const config = getAppConfig(); // Validate early before rendering

      if (cmdOptions.headless) {
        const exitCode = await runHeadlessEntryPoint(cmdOptions, config);
        process.exit(exitCode);
      }

      renderInteractiveReview(config);
    } catch (e) {
      if (e instanceof AppConfigError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
  });

program.addCommand(createAuthCommand());

program.parseAsync();

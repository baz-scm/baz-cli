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
} from "./lib/config/index.js";
import { OAuthFlow } from "./auth/oauth-flow.js";
import { authConfig } from "./auth/config.js";
import {
  getCurrentBranch,
  getDiffAgainstRef,
  resolveBaseRef,
} from "./lib/git.js";

const VERSION = "0.4.4"; // x-release-please-version

const program = new Command();

program.name("Baz CLI").version(VERSION);

program
  .command("review", { isDefault: true })
  .description("Start a review")
  .option("--local", "Review local git changes instead of a GitHub PR")
  .option(
    "--base <branch>",
    "With --local, review against this branch instead of the default branch",
  )
  .action(async (options: { local?: boolean; base?: string }) => {
    if (options.base !== undefined && !options.local) {
      console.error("--base can only be used with --local");
      process.exit(1);
    }

    // The review flow falls back to the PR selector when the local diff fails,
    // which would hide a mistyped base, so check it before starting.
    if (options.base !== undefined) {
      try {
        const currentBranch = getCurrentBranch();
        if (!getDiffAgainstRef(resolveBaseRef(options.base))) {
          console.error(
            `No changes found between ${currentBranch} and ${options.base}.`,
          );
          process.exit(1);
        }
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    }

    try {
      getAppConfig(); // Validate early before rendering
    } catch (e) {
      if (e instanceof AppConfigError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }

    // Ensure user is registered with Baz and authenticated
    const oauthFlow = OAuthFlow.getInstance();
    if (!oauthFlow.isAuthenticated()) {
      console.log("📝 Registration required. Opening browser...");
      await oauthFlow.authenticate(authConfig);
    }

    render(
      React.createElement(
        AppModeProvider,
        null,
        React.createElement(ReviewFlow, {
          isLocal: options.local,
          baseBranch: options.base,
        }),
      ),
    );
  });

program.addCommand(createAuthCommand());

program.parseAsync();

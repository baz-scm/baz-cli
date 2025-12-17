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

const VERSION = "0.3.6"; // x-release-please-version

const program = new Command();

program.name("Baz CLI").version(VERSION);

program
  .command("review", { isDefault: true })
  .description("Start a review")
  .action(async () => {
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
        React.createElement(ReviewFlow),
      ),
    );
  });

program.addCommand(createAuthCommand());

program.parseAsync();

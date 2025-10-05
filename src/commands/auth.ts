import { Command } from "commander";
import { OAuthFlow } from "../auth/oauth-flow.js";
import { authConfig } from "../auth/config.js";

export function createAuthCommand(): Command {
  const authCommand = new Command("auth");
  const oauthFlow = OAuthFlow.getInstance();

  authCommand
    .command("login")
    .description("Authenticate with Descope")
    .action(async () => {
      try {
        if (oauthFlow.isAuthenticated()) {
          console.log("✅ You are already authenticated.");
          return;
        }

        await oauthFlow.authenticate(authConfig);
      } catch (error) {
        console.error(
          "❌ Authentication failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
        process.exit(1);
      }
    });

  authCommand
    .command("logout")
    .description("Logout and clear stored tokens")
    .action(() => {
      try {
        if (!oauthFlow.isAuthenticated()) {
          console.log("ℹ️  You are not currently authenticated.");
          return;
        }

        oauthFlow.logout();
      } catch (error) {
        console.error(
          "❌ Logout failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
        process.exit(1);
      }
    });

  return authCommand;
}

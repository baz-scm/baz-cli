import { env } from "../env-schema.js";
import { IDataProvider } from "../providers/data-provider.js";
import { TokensDataProvider } from "../providers/tokens-provider.js";
import { BazDataProvider } from "../providers/baz-provider.js";

export interface AppMode {
  name: "baz" | "tokens";
  dataProvider: IDataProvider;
}

export interface TokensConfig {
  githubToken: string;
  anthropicToken: string;
}

export interface AppConfig {
  mode: AppMode;
  tokens?: TokensConfig;
}

export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigError";
  }
}

function initializeAppConfig(): AppConfig {
  const ghToken = env.GH_TOKEN;
  const anthropicToken = env.ANTHROPIC_TOKEN;

  // Both tokens present → tokens mode
  if (ghToken && anthropicToken) {
    return {
      mode: {
        name: "tokens",
        dataProvider: new TokensDataProvider(),
      },
      tokens: {
        githubToken: ghToken,
        anthropicToken: anthropicToken,
      },
    };
  }

  // Neither token present → baz mode
  if (!ghToken && !anthropicToken) {
    return {
      mode: {
        name: "baz",
        dataProvider: new BazDataProvider(),
      },
    };
  }

  // Only one token present → error
  const missing = ghToken ? "ANTHROPIC_TOKEN" : "GH_TOKEN";
  throw new AppConfigError(
    `Error: Incomplete token configuration.\n` +
      `Both GH_TOKEN and ANTHROPIC_TOKEN must be set to use tokens mode.\n` +
      `Missing: ${missing}`,
  );
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = initializeAppConfig();
  }
  return cachedConfig;
}

export function resetAppConfig(): void {
  cachedConfig = null;
}

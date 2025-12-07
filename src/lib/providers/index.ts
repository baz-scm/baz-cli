import { getAppConfig } from "../config/index.js";
import { BazDataProvider } from "./baz-provider.js";
import type { IDataProvider } from "./data-provider.js";
import { TokensDataProvider } from "./tokens-provider.js";

let provider: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (!provider) {
    const { mode } = getAppConfig();
    switch (mode) {
      case "baz":
        provider = new BazDataProvider();
        break;
      case "tokens":
        provider = new TokensDataProvider();
        break;
      default: {
        const _exhaustive: never = mode;
        throw new Error(`Unknown app mode: ${_exhaustive}`);
      }
    }
  }
  return provider;
}

export function resetDataProvider(): void {
  provider = null;
}

export type { IDataProvider } from "./data-provider.js";
export * from "./data-provider.js";

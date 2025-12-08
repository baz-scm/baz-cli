import type { IntegrationType } from "../lib/providers/index.js";
import { IntegrationProvider } from "./types.js";
import { jiraProvider } from "./providers/jira.js";
import { linearProvider } from "./providers/linear.js";
import { youtrackProvider } from "./providers/youtrack.js";

const providers: IntegrationProvider[] = [
  jiraProvider,
  linearProvider,
  youtrackProvider,
];

export function getProvider(type: IntegrationType): IntegrationProvider {
  const provider = providers.find((p) => p.type === type);
  if (!provider) {
    throw new Error(`Provider ${type} not found in registry`);
  }
  return provider;
}

export function getAllProviders(): IntegrationProvider[] {
  return providers;
}

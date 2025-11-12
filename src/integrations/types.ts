import { IntegrationType } from "../lib/clients/baz.js";

export type IntegrationFlowType = "oauth" | "credentials";

export interface OAuthIntegrationConfig {
  type: "oauth";
  getOAuthUrl: () => Promise<string>;
}

export interface CredentialsIntegrationConfig {
  type: "credentials";
}

export type IntegrationConfig =
  | OAuthIntegrationConfig
  | CredentialsIntegrationConfig;

export interface IntegrationProvider {
  type: IntegrationType;
  name: string;
  isImplemented: boolean;
  integrationConfig: IntegrationConfig;
}

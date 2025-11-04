import { InboundAppConfig, AuthConfig } from "./types.js";
import { env } from "../lib/env-schema.js";
import { config } from "dotenv";

config({ quiet: true });

export function createInboundAppConfig(
  authConfig: AuthConfig,
): InboundAppConfig {
  const { baseUrl, projectId } = authConfig;

  return {
    issuer: `${baseUrl}/v1/apps/${projectId}`,
    jwksURI: `${baseUrl}/${projectId}/.well-known/jwks.json`,
    authorizationEndpoint: `${baseUrl}/oauth2/v1/apps/authorize`,
    responseTypesSupported: ["code"],
    subjectTypesSupported: ["public"],
    idTokenSigningAlgValuesSupported: ["RS256"],
    codeChallengeMethodsSupported: ["S256"],
    tokenEndpoint: `${baseUrl}/oauth2/v1/apps/token`,
    userInfoEndpoint: `${baseUrl}/oauth2/v1/apps/userinfo`,
    scopesSupported: ["openid"],
    claimsSupported: [
      "iss",
      "aud",
      "iat",
      "exp",
      "sub",
      "name",
      "email",
      "email_verified",
      "phone_number",
      "phone_number_verified",
      "picture",
      "family_name",
      "given_name",
    ],
    revocationEndpoint: `${baseUrl}/oauth2/v1/apps/revoke`,
    registrationEndpoint: `${baseUrl}/v1/mgmt/inboundapp/app/${projectId}/register`,
  };
}

export const authConfig: AuthConfig = {
  baseUrl: env.DESCOPE_BASE_URL,
  projectId: env.DESCOPE_PROJECT_ID,
  clientId: env.DESCOPE_CLIENT_ID,
  scopes: ["openid"],
};

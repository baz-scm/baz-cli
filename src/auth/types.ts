export interface InboundAppConfig {
  issuer: string;
  jwksURI: string;
  authorizationEndpoint: string;
  responseTypesSupported: string[];
  subjectTypesSupported: string[];
  idTokenSigningAlgValuesSupported: string[];
  codeChallengeMethodsSupported: string[];
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopesSupported: string[];
  claimsSupported: string[];
  revocationEndpoint: string;
  registrationEndpoint: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface AuthConfig {
  baseUrl: string;
  projectId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
}

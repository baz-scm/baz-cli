import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { URL } from "url";
import { AuthConfig, TokenResponse } from "./types.js";
import { createInboundAppConfig } from "./config.js";
import { InboundAppConfig } from "./types.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./pkce-utils.js";
import { TokenManager } from "./token-manager.js";
import open from "open";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env-schema.js";
import axios from "axios";
import axiosRetry from "axios-retry";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export class OAuthFlow {
  private static instance: OAuthFlow;
  private tokenManager: TokenManager;

  private constructor() {
    this.tokenManager = new TokenManager();
  }

  static getInstance(): OAuthFlow {
    if (!OAuthFlow.instance) {
      OAuthFlow.instance = new OAuthFlow();
    }
    return OAuthFlow.instance;
  }

  async authenticate(authConfig: AuthConfig) {
    const redirectUri = `http://localhost:${env.OAUTH_CALLBACK_PORT}/callback`;
    const config = createInboundAppConfig(authConfig);
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const authUrl = this.buildAuthorizationUrl(
      config,
      authConfig,
      state,
      codeChallenge,
      redirectUri,
    );

    await open(authUrl);

    logger.debug("Waiting for callback...");
    const authCode = await this.waitForCallback(state);
    logger.debug("Callback received, exchanging for tokens...");

    const tokens = await this.exchangeCodeForTokens(
      authCode,
      codeVerifier,
      config,
      authConfig,
      redirectUri,
    );
    logger.debug("Tokens received, saving...");

    this.tokenManager.saveTokens(tokens);
    console.log("✅ Authentication successful! You are now logged in.");
    logger.debug("Authentication flow completed, exiting...");
  }

  private buildAuthorizationUrl(
    config: InboundAppConfig,
    authConfig: AuthConfig,
    state: string,
    codeChallenge: string,
    redirectUri: string,
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: authConfig.clientId,
      redirect_uri: redirectUri,
      scope: authConfig.scopes.join(" "),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${config.authorizationEndpoint}?${params.toString()}`;
  }

  private waitForCallback(expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);

          if (url.pathname === "/callback") {
            this.handleCallback(
              url,
              expectedState,
              res,
              resolve,
              reject,
              server,
              timeoutId,
            );
          } else {
            res.writeHead(404);
            res.end("Not Found");
          }
        },
      );

      server.listen(env.OAUTH_CALLBACK_PORT, () => {
        logger.debug(
          `Waiting for OAuth callback on http://localhost:${env.OAUTH_CALLBACK_PORT}/callback`,
        );
      });

      server.on("error", (err) => {
        reject(new Error(`Server error: ${err.message}`));
      });

      server.on("close", () => {
        logger.debug("🔒 OAuth callback server closed");
      });

      const timeoutId = setTimeout(() => {
        logger.debug("⏰ Authentication timeout - closing server");
        server.close();
        reject(new Error("Authentication timeout. Please try again."));
      }, 300000);
    });
  }

  private handleCallback(
    url: URL,
    expectedState: string,
    res: ServerResponse,
    resolve: (value: string) => void,
    reject: (reason: Error) => void,
    server: Server,
    timeoutId: NodeJS.Timeout,
  ): void {
    const errorCode = url.searchParams.get("error");
    if (errorCode) {
      const errorDesc =
        url.searchParams.get("error_description") || "Unknown error";
      res.writeHead(400);
      res.end(`OAuth Error: ${errorCode} - ${errorDesc}`);
      clearTimeout(timeoutId);
      server.close();
      reject(new Error(`OAuth Error: ${errorCode} - ${errorDesc}`));
      return;
    }

    const state = url.searchParams.get("state");
    if (state !== expectedState) {
      res.writeHead(400);
      res.end("Invalid state parameter");
      clearTimeout(timeoutId);
      server.close();
      reject(new Error("Invalid state parameter"));
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing authorization code");
      clearTimeout(timeoutId);
      server.close();
      reject(new Error("Missing authorization code"));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Successful | Baz</title>
    <link rel="icon" type="image/png" href="https://baz-co-public-assets.s3.us-east-2.amazonaws.com/Light.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        background-color: #0F1D2A;
        color: #fff;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .container {
        text-align: center;
        padding: 48px;
        max-width: 400px;
      }
      .logo {
        margin-bottom: 32px;
      }
      .logo img {
        height: 120px;
      }
      .icon {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #5533FF 0%, #A2A2FF 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
      }
      .icon svg {
        width: 32px;
        height: 32px;
        color: #fff;
      }
      h1 {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #fff;
      }
      p {
        font-size: 16px;
        color: #A2A2FF;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">
        <img src="https://baz-co-public-assets.s3.us-east-2.amazonaws.com/full+-+svg/Light-Transparent.svg" alt="Baz" />
      </div>
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1>Baz CLI is authenticated</h1>
      <p>You're authenticated and good to go</p>
      <p>Head back to your terminal to start reviewing!</p>
    </div>
  </body>
</html>
    `);

    clearTimeout(timeoutId);
    resolve(code);
    server.close();
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    config: InboundAppConfig,
    authConfig: AuthConfig,
    redirectUri: string,
  ): Promise<TokenResponse> {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: authConfig.clientId,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    return await axios
      .post<TokenResponse>(config.tokenEndpoint, tokenParams.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((value) => value.data)
      .catch((error: unknown) => {
        console.error("Token exchange failed:", error);
        throw error;
      });
  }

  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  getAccessToken(): string | null {
    const tokens = this.tokenManager.getTokens();
    return tokens?.accessToken || null;
  }

  logout(): void {
    this.tokenManager.clearTokens();
    console.log("✅ Logged out successfully.");
  }
}

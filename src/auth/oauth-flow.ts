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

  async authenticate(authConfig: AuthConfig): Promise<boolean> {
    const config = createInboundAppConfig(authConfig);
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const authUrl = this.buildAuthorizationUrl(
      config,
      authConfig,
      state,
      codeChallenge,
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
    );
    logger.debug("Tokens received, saving...");

    this.tokenManager.saveTokens(tokens);
    console.log("✅ Authentication successful! You are now logged in.");
    logger.debug("Authentication flow completed, exiting...");

    return true;
  }

  private buildAuthorizationUrl(
    config: InboundAppConfig,
    authConfig: AuthConfig,
    state: string,
    codeChallenge: string,
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
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

      server.listen(8080, () => {
        logger.debug(
          "Waiting for OAuth callback on http://localhost:8080/callback",
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
      <html>
        <body>
          <h1>Login successful!</h1>
          <p>You may close this browser window and return to your terminal.</p>
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
  ): Promise<TokenResponse> {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: authConfig.clientId,
      code: code,
      redirect_uri: authConfig.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed with status: ${response.status}`);
    }

    const tokenResponse: TokenResponse = await response.json();
    return tokenResponse;
  }

  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  getAccessToken(): string | null {
    // const tokens = this.tokenManager.getTokens();
    // return tokens?.accessToken || null;

    return "eyJhbGciOiJSUzI1NiIsImtpZCI6IlNLMloyTzNCT3FBV2p1S1NWVENkMUd2dkdxZWYwIiwidHlwIjoiSldUIn0.eyJhY3RpdmVUZW5hbnQiOiJUMmJSb0hLbkdOWlpUNElIQ012MUYxc1RLSUxyIiwiYW1yIjpbIm9hdXRoIl0sImRybiI6IkRTIiwiZW1haWwiOiJ5YXJkZW5AYmF6LmNvIiwiZXhwIjoxNzU5Nzc0NjAyLCJnaXRodWJJZCI6IjY2NTI4MDciLCJnaXRodWJMb2dpbiI6InlhcmRlbm1pbnR6IiwiZ2l0bGFiQXZhdGFyIjoiaHR0cHM6Ly9naXRsYWIuY29tL3VwbG9hZHMvLS9zeXN0ZW0vdXNlci9hdmF0YXIvMjkzMzc0NDMvYXZhdGFyLnBuZyIsImdpdGxhYklkIjoiMjkzMzc0NDMiLCJnaXRsYWJMb2dpbiI6InlhcmRlbm1pbnR6IiwiaWF0IjoxNzU5Njg4MjAyLCJpc3MiOiJQMloyTzMwYUxpZUpJcXY4Z25Na2JJZzNmMjJTIiwibG9naW5JZHMiOlsiZ2l0aHViLTY2NTI4MDciLCJ5YXJkZW5AYmF6LmNvIiwiZ2l0aHViLXJ3LTY2NTI4MDciLCJnaXRsYWItMjkzMzc0NDMiXSwibmFtZSI6IllhcmRlbiBNaW50eiIsInJleHAiOiIyMDI1LTEwLTEyVDE4OjE2OjQyWiIsInN1YiI6IlUyclA2Z3l2QnhSR0kwalFVNjJzaWlpSWpDSkEifQ.kUoCLTc_rzcK5eUTS4egWU0alFlfPpPhq0ejeHDpDobyaeARECr-qwUcjOUmJ-RvXUpKscB-1Z1FF4b9y4xAadcqTs8gK3QSILoWqs13Qv2V4wxlw-Ub7prJEql5WigdVbA3gFGioZ1WWdo3K5OAltJd2616LY03dRqRvoOSkZMvuXD9zSt7WYwaUAPqIhYMZ8Moe2EJX23WIGM-r64DoKr7t5xAJlwopB2ikiBpgrYgEGSmlhapKLtOMqmjr3Srp0P9psYQ5CTYE4-3A5QQGkjVIEZq_dfwO0fCqMSXwaqERIbK8UPvbXO0MEybagdHj3UaI5PHOwBDcyM2z1Nh0g"

  }

  logout(): void {
    this.tokenManager.clearTokens();
    console.log("✅ Logged out successfully.");
  }
}

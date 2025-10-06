import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { StoredTokens, TokenResponse } from "./types.js";
import { logger } from "../lib/logger.js";

const TOKEN_FILE = join(homedir(), ".baz-cli", "tokens.json");

export class TokenManager {
  private ensureTokenDirectory(): void {
    const tokenDir = dirname(TOKEN_FILE);
    if (!existsSync(tokenDir)) {
      mkdirSync(tokenDir, { recursive: true });
    }
  }

  saveTokens(tokenResponse: TokenResponse): void {
    this.ensureTokenDirectory();

    const tokens: StoredTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope,
    };

    writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf8");
  }

  getTokens(): StoredTokens | null {
    if (!existsSync(TOKEN_FILE)) {
      return null;
    }

    try {
      const tokensData = readFileSync(TOKEN_FILE, "utf8");
      const tokens: StoredTokens = JSON.parse(tokensData);

      if (this.isTokenExpired(tokens)) {
        logger.warn("Token expired");
        return null;
      }

      return tokens;
    } catch (error) {
      logger.warn(`Error getting tokens: ${String(error)}`);
      return null;
    }
  }

  isTokenExpired(tokens: StoredTokens): boolean {
    return Date.now() >= tokens.expiresAt;
  }

  clearTokens(): void {
    if (existsSync(TOKEN_FILE)) {
      writeFileSync(TOKEN_FILE, "", "utf8");
    }
  }

  isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return tokens !== null && !this.isTokenExpired(tokens);
  }
}

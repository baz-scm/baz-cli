import { TokenManager } from "./axios-client.js";
import { TokenManager as AuthTokenManager } from "../../../auth/token-manager.js";

export class CLITokenManager implements TokenManager {
  private authTokenManager: AuthTokenManager;

  constructor() {
    this.authTokenManager = new AuthTokenManager();
  }

  getToken(): string {
    return this.authTokenManager.getTokens()?.accessToken || "";
  }

  resetToken(): void {
    this.authTokenManager.clearTokens();
  }
}

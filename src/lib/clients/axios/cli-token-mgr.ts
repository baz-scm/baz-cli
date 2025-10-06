import { TokenManager } from "./axios-client";
import { TokenManager as AuthTokenManager } from "../../../auth/token-manager";

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

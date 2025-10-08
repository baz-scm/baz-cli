import { TokenManager } from "./axios-client";

// Need to implement according to how we will run in the browser, probably using localStorage
export class WebTokenManager implements TokenManager {
  getToken(): string {
    throw new Error("Not implemented");
  }

  resetToken(): void {
    throw new Error("Not implemented");
  }
}

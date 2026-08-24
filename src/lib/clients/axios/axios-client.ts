import axios, { CreateAxiosDefaults } from "axios";
import { CLITokenManager } from "./cli-token-mgr.js";
import axiosRetry from "axios-retry";
import chalk from "chalk";
import { OAuthFlow } from "../../../auth/oauth-flow.js";
import { authConfig } from "../../../auth/config.js";
import { getAppConfig } from "../../config/app-mode.js";
import { env } from "../../env-schema.js";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    /** Set once we've retried a request after a 401 re-auth, to avoid loops. */
    _bazAuthRetried?: boolean;
  }
}

export interface TokenManager {
  getToken: () => string;
  resetToken: () => void;
}

let isAuthenticating = false;

export const createAxiosClient = (baseURL: string) => {
  const opts: CreateAxiosDefaults = {
    baseURL,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  };

  const axiosClient = axios.create(opts);

  const tokenMgr: TokenManager = new CLITokenManager();

  axiosClient.interceptors.request.use(function (config) {
    const token = tokenMgr.getToken();
    config.headers.Authorization = token ? `Bearer ${token}` : "";

    // Add token headers in tokens mode for baz domain requests
    const appConfig = getAppConfig();
    if (appConfig.mode.name === "tokens" && appConfig.tokens) {
      const isBazRequest = config.baseURL?.startsWith(env.BAZ_BASE_URL);
      if (isBazRequest) {
        config.headers["x-baz-github-token"] = appConfig.tokens.githubToken;
        config.headers["x-baz-anthropic-token"] =
          appConfig.tokens.anthropicToken;
      }
    }

    return config;
  });

  axiosClient.interceptors.response.use(
    function (response) {
      return response;
    },
    async function (error) {
      if (error?.response?.status === 401) {
        // If we already re-authenticated for this request and it still 401s,
        // the credentials are being rejected by the server. Re-running the
        // login flow would loop forever (and collide on the callback port),
        // so surface a clear error instead of retrying again.
        if (error.config?._bazAuthRetried) {
          console.error(
            chalk.red(
              "❌ The Baz API rejected your credentials even after re-authenticating.",
            ),
          );
          console.error(
            chalk.red(
              "   Your login succeeded but your account may not have access to this API. " +
                "Please contact Baz support.",
            ),
          );
          return Promise.reject(error);
        }

        // Guard against concurrent requests all kicking off their own
        // interactive login (which would collide on the OAuth callback port).
        if (isAuthenticating) {
          return Promise.reject(error);
        }

        isAuthenticating = true;

        try {
          console.log(
            chalk.yellow(
              "⚠️  Authentication required. Initiating login flow...",
            ),
          );
          tokenMgr.resetToken();

          const oauthFlow = OAuthFlow.getInstance();
          await oauthFlow.authenticate(authConfig);

          const token = oauthFlow.getAccessToken();
          if (token && error.config) {
            error.config.headers.Authorization = `Bearer ${token}`;
            error.config._bazAuthRetried = true;
            return axiosClient.request(error.config);
          }
        } catch (authError) {
          console.error(
            chalk.red("❌ Authentication failed:"),
            authError instanceof Error ? authError.message : "Unknown error",
          );
          return Promise.reject(error);
        } finally {
          isAuthenticating = false;
        }
      }
      if (error?.response?.status === 402) {
        tokenMgr.resetToken();
      }
      return Promise.reject(error);
    },
  );

  axiosRetry(axiosClient, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  });

  return axiosClient;
};

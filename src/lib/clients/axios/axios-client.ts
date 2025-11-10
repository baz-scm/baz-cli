import axios, { CreateAxiosDefaults } from "axios";
import { CLITokenManager } from "./cli-token-mgr.js";
import axiosRetry from "axios-retry";
import chalk from "chalk";
import { OAuthFlow } from "../../../auth/oauth-flow.js";
import { authConfig } from "../../../auth/config.js";

export interface TokenManager {
  getToken: () => string;
  resetToken: () => void;
}

let isAuthenticating = false;

export const createAxiosClient = (baseURL: string) => {
  const opts: CreateAxiosDefaults = {
    baseURL,
  };

  const axiosClient = axios.create(opts);

  const tokenMgr: TokenManager = new CLITokenManager();

  axiosClient.interceptors.request.use(function (config) {
    const token = tokenMgr.getToken();
    config.headers.Authorization = token ? `Bearer ${token}` : "";
    return config;
  });

  axiosClient.interceptors.response.use(
    function (response) {
      return response;
    },
    async function (error) {
      if (error?.response?.status === 401) {
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
            isAuthenticating = false;
            return axiosClient.request(error.config);
          }
        } catch (authError) {
          isAuthenticating = false;
          console.error(
            chalk.red("❌ Authentication failed:"),
            authError instanceof Error ? authError.message : "Unknown error",
          );
          return Promise.reject(error);
        }

        isAuthenticating = false;
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

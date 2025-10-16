import axios, { CreateAxiosDefaults } from "axios";
import { CLITokenManager } from "./cli-token-mgr";
import axiosRetry from "axios-retry";
import chalk from "chalk";

export interface TokenManager {
  getToken: () => string;
  resetToken: () => void;
}

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
    function (error) {
      if (error?.response?.status === 401) {
        console.log(
          chalk.red("• Invalid Token. Please run ") +
            chalk.cyan.italic("baz auth login") +
            chalk.red(" to authenticate."),
        );
        tokenMgr.resetToken();
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

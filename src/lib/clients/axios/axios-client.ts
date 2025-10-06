import axios, { CreateAxiosDefaults } from "axios";
import { CLITokenManager } from "./cli-token-mgr";
import axiosRetry from "axios-retry";
import { WebTokenManager } from "./web-token-mgr";
import { env } from "../../env-schema";

export interface TokenManager {
  getToken: () => string;
  resetToken: () => void;
}

const isCLi = env.RUNTIME_ENV === "CLI";

export const createAxiosClient = (baseURL: string) => {
  const opts: CreateAxiosDefaults = {
    baseURL,
  };

  if (!isCLi) {
    opts.withCredentials = true;
  }

  const axiosClient = axios.create(opts);

  const tokenMgr: TokenManager = isCLi
    ? new CLITokenManager()
    : new WebTokenManager();

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

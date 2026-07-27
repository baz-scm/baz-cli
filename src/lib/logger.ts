import { pino } from "pino";
import { env } from "./env-schema.js";

export const loggerConfig = {
  level: env.BAZ_LOG_LEVEL,
  redact: {
    paths: ["error.config.headers.*", "err.config.headers.*"],
    censor: "[Redacted]",
  },
  formatters: {
    level: (label: string, _number: number) => ({ level: label }),
  },
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss",
    },
  },
};
export const logger = pino(loggerConfig);

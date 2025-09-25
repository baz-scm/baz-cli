import { pino } from "pino";
import { env } from "./env-schema.js";

export const loggerConfig = {
  level: env.NODE_ENV === "development" ? "debug" : env.LOG_LEVEL,
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

import { pino, multistream } from "pino";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env-schema.js";

const prettyTransport = pino.transport({
  target: "pino-pretty",
  options: {
    translateTime: "HH:MM:ss",
  },
});

const streams = [{ stream: prettyTransport }];

if (env.LOG_FILE_PATH) {
  mkdirSync(dirname(env.LOG_FILE_PATH), { recursive: true });
  streams.push({ stream: pino.destination(env.LOG_FILE_PATH) });
}

const loggerOptions = {
  level: env.NODE_ENV === "development" ? "debug" : env.LOG_LEVEL,
  formatters: {
    level: (label: string, _number: number) => ({ level: label }),
  },
};

export const logger = pino(
  loggerOptions,
  streams.length > 1 ? multistream(streams) : streams[0].stream,
);

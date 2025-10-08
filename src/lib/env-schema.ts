import { z } from "zod";
import { config } from "dotenv";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug"])
    .default("info"),
  DESCOPE_BASE_URL: z.string().default("https://api.descope.com"),
  DESCOPE_PROJECT_ID: z.string(),
  DESCOPE_CLIENT_ID: z.string(),
  DESCOPE_REDIRECT_URI: z.string().default("http://localhost:8080/callback"),
  RUNTIME_ENV: z.enum(["CLI", "WEB"]).default("CLI"),
});

export const env = envSchema.parse(process.env);

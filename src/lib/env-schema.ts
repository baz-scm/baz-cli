import { z } from "zod";
import { config } from "dotenv";

config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug"])
    .default("info"),
  BAZ_BASE_URL: z.string().default("https://main.baz.ninja"),
  DESCOPE_BASE_URL: z.string().default("https://api.descope.com"),
  DESCOPE_PROJECT_ID: z.string().default("P2Z2O30aLieJIqv8gnMkbIg3f22S"),
  DESCOPE_CLIENT_ID: z
    .string()
    .default(
      "UDJaMk8zMGFMaWVKSXF2OGduTWtiSWczZjIyUzpUUEEzM2dPRjhreE51YXR4ckd3Wkw4M0FjdW9EWlo=",
    ),
  DESCOPE_REDIRECT_URI: z.string().default("http://localhost:8080/callback"),
});

export const env = envSchema.parse(process.env);

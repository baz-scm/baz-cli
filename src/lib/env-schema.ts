import { z } from "zod";
import { config } from "dotenv";

config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug"])
    .default("warn"),
  BAZ_BASE_URL: z.string().default("https://baz.co"),
  DESCOPE_BASE_URL: z.string().default("https://api.descope.com"),
  DESCOPE_PROJECT_ID: z.string().default("P2iaXsYiRqWs5wLQP6jhplWKIvqW"),
  DESCOPE_CLIENT_ID: z
    .string()
    .default(
      "UDJpYVhzWWlScVdzNXdMUVA2amhwbFdLSXZxVzpUUEEzM0JXM0JIdFV1NDFEc29IdlhRblVnSk5EUEc=",
    ),
  OAUTH_CALLBACK_PORT: z.coerce.number().default(8020),
  JIRA_CLIENT_ID: z.string().default("j7VQs4gJ8yV4e6Pa4buiYqZ0UcvRRnJv"),
  LINEAR_CLIENT_ID: z.string().default("a20b70eadc1cce2121089f70402351d6"),
  GITHUB_PAT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

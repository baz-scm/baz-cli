import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Only the sources. `tsc` copies the specs into `dist/`, and stale builds
    // and git worktrees leave more copies around, so an unscoped run collects
    // the same test several times over — and fails on copies whose source is
    // long gone.
    include: ["src/**/*.spec.{ts,tsx}"],
  },
});

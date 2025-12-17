export const DEFAULT_INCLUDE = [
  "**/agents.md",
  "**/bugbot.md",
  "**/skills.md",
  "**/CLAUDE.md",
  "**/claude.md",
  "**/.cursor/rules*",
  "**/cursor-rules*",
];

export const DEFAULT_EXCLUDE = [
  ".git/**",
  "node_modules/**",
  "vendor/**",
  "dist/**",
  "build/**",
];

export const MANAGED_SECTION_HEADING = "## Managed Principles";
export const MANAGED_BEGIN = "<!-- instrctl:begin managed -->";
export const MANAGED_END = "<!-- instrctl:end managed -->";

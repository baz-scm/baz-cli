import path from "path";

export function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  const specials = new Set([".", "+", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
  let body = "";
  let i = 0;
  const prefix = "^(?:.*/)?";
  if (normalized.startsWith("**/")) {
    i = 3;
  }
  for (; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === "*") {
      const isDouble = normalized[i + 1] === "*";
      body += isDouble ? ".*" : "[^/]*";
      if (isDouble) i += 1;
      continue;
    }
    if (ch === "?") {
      body += ".";
      continue;
    }
    body += specials.has(ch) ? `\\${ch}` : ch;
  }
  return new RegExp(`${prefix}${body}$`);
}

export function matchAny(file: string, patterns: string[]): boolean {
  const normalized = file.replace(/\\/g, "/");
  return patterns.some((p) => globToRegex(p).test(normalized));
}

export function pathMatches(file: string, include: string[], exclude: string[]): boolean {
  const relative = file.replace(/\\/g, "/");
  if (exclude.length && matchAny(relative, exclude)) return false;
  if (!include.length) return true;
  return matchAny(relative, include);
}

export function docDialect(file: string):
  | "claude"
  | "agents"
  | "cursor"
  | "bugbot"
  | "skills"
  | "generic" {
  const normalized = file.replace(/\\/g, "/").toLowerCase();
  const lower = path.basename(normalized);
  if (lower === "claude.md") return "claude";
  if (lower === "agents.md") return "agents";
  if (lower === "bugbot.md") return "bugbot";
  if (lower === "skills.md") return "skills";
  if (lower.startsWith("cursor-rules") || normalized.includes("/.cursor/") || normalized.startsWith(".cursor/")) return "cursor";
  return "generic";
}

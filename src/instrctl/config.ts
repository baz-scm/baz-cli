import fs from "fs";
import path from "path";
import { getRepoRoot } from "./utils.js";
import type { Principle } from "./types.js";

export interface InstrctlConfig {
  principles: Principle[];
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value.replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBlock(content: string): Record<string, string | string[]> {
  const lines = content.split(/\r?\n/);
  const result: Record<string, string | string[]> = {};
  for (const line of lines) {
    const match = line.trim().match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (raw.trim().startsWith("[")) {
      result[key] = parseArray(raw.trim());
    } else {
      result[key] = raw.trim().replace(/^"|"$/g, "");
    }
  }
  return result;
}

export function readConfig(repoRoot = getRepoRoot()): InstrctlConfig | null {
  const configPath = path.join(repoRoot, ".instrctl", "instrctl.hcl");
  if (!fs.existsSync(configPath)) return null;
  const text = fs.readFileSync(configPath, "utf8");
  const principleBlocks = [...text.matchAll(/principle\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)];
  const principles: Principle[] = principleBlocks.map((match) => {
    const [, id, body] = match;
    const values = parseBlock(body);
    return {
      id,
      title: String(values.title ?? id),
      strength: (values.strength as Principle["strength"]) ?? "MUST",
      statement: String(values.statement ?? ""),
      scope: (values.scope as string[]) ?? ["repo/**"],
      tags: (values.tags as string[]) ?? [],
      rationale: typeof values.rationale === "string" ? values.rationale : undefined,
      examples: (values.examples as string[]) ?? [],
    };
  });
  return { principles };
}

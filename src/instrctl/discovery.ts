import fs from "fs";
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from "./constants.js";
import { docDialect, pathMatches } from "./matcher.js";
import { repoEntries, relativePath, sha256 } from "./utils.js";
import { inferDocScope } from "./scope.js";
import type { DocumentDescriptor } from "./types.js";

export interface DiscoveryOptions {
  include?: string[];
  exclude?: string[];
}

export function discoverDocuments(repoRoot: string, opts: DiscoveryOptions = {}): DocumentDescriptor[] {
  const include = opts.include ?? DEFAULT_INCLUDE;
  const exclude = opts.exclude ?? DEFAULT_EXCLUDE;
  const files = repoEntries(repoRoot, exclude);
  const docs: DocumentDescriptor[] = [];

  for (const file of files) {
    const rel = relativePath(repoRoot, file);
    if (!pathMatches(rel, include, exclude)) continue;
    const stat = fs.statSync(file);
    if (!stat.isFile()) continue;
    const content = fs.readFileSync(file, "utf8");
    const docScope = inferDocScope(repoRoot, file, content);
    docs.push({
      path: rel,
      dialect: docDialect(file),
      docScope,
      sha256: sha256(content),
    });
  }
  return docs;
}

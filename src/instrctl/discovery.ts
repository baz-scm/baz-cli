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

  for (const file of files) {
    const rel = relativePath(repoRoot, file);
    const segments = rel.split(/[/\\]/);
    const hasExcludedSegment = segments.some(seg => 
      exclude.some(pattern => {
        const base = pattern.replace(/\/?\*\*\/?/g, '');
        return seg === base || seg.startsWith(base + '/');
      })
    );
    if (hasExcludedSegment || !pathMatches(rel, include, exclude)) continue;
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

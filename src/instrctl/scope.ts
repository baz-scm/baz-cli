import path from "path";

export function inferDocScope(repoRoot: string, docPath: string, docText: string): string[] {
  const relative = path.relative(repoRoot, docPath).replace(/\\/g, "/");
  const frontmatterMatch = docText.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const content = frontmatterMatch[1];
    const scopeMatch = content.match(/scope:\s*\[([^\]]*)\]/);
    if (scopeMatch) {
      const parts = scopeMatch[1]
        .split(",")
        .map((p) => p.replace(/['"\s]/g, "").trim())
        .filter(Boolean);
      if (parts.length) return parts;
    }
  }
  const dir = path.dirname(relative);
  if (dir === ".") return ["repo/**"];
  return [`${dir}/**`];
}

export function scopeIntersects(a: string[], b: string[]): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (pa === "repo/**" || pb === "repo/**") return true;
      const simpleA = pa.replace("/**", "");
      const simpleB = pb.replace("/**", "");
      if (simpleA === simpleB) return true;
      if (simpleA && simpleB && (simpleA.startsWith(simpleB) || simpleB.startsWith(simpleA))) {
        return true;
      }
    }
  }
  return false;
}

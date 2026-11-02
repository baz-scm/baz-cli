/**
 * `--base` is exercised against real repositories: what matters is which
 * commits end up in the diff, which only git itself can answer.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDiffAgainstRef, resolveBaseRef } from "./git.js";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf-8", stdio: "pipe" }).trim();

const commit = (file: string) => {
  writeFileSync(file, `${file}\n`);
  git("add", file);
  git("commit", "-qm", `add ${file}`);
};

describe("--base", () => {
  const startDir = process.cwd();
  let root: string;

  beforeEach(() => {
    // origin/HEAD -> main; main -> integration -> feature
    root = mkdtempSync(path.join(tmpdir(), "baz-git-"));
    execFileSync("git", ["init", "-q", "--bare", "origin.git"], { cwd: root });
    execFileSync("git", ["clone", "-q", "origin.git", "work"], {
      cwd: root,
      stdio: "pipe",
    });
    process.chdir(path.join(root, "work"));
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("config", "commit.gpgsign", "false");
    git("checkout", "-q", "-b", "main");
    commit("base.txt");
    git("push", "-q", "origin", "main");
    git("remote", "set-head", "origin", "main");
    git("checkout", "-q", "-b", "integration");
    commit("integration.txt");
    git("push", "-q", "origin", "integration");
    git("checkout", "-q", "-b", "feature");
    commit("mine.txt");
  });

  afterEach(() => {
    process.chdir(startDir);
    rmSync(root, { recursive: true, force: true });
  });

  it("reviews only the commits since the given base", () => {
    const diff = getDiffAgainstRef(resolveBaseRef("integration"));
    expect(diff).toContain("mine.txt");
    expect(diff).not.toContain("integration.txt");
  });

  it("includes the parent's commits when the base is the default branch", () => {
    const diff = getDiffAgainstRef(resolveBaseRef("main"));
    expect(diff).toContain("mine.txt");
    expect(diff).toContain("integration.txt");
  });

  it("uses origin when the local copy is stale", () => {
    git("checkout", "-q", "integration");
    commit("newer-on-origin.txt");
    git("push", "-q", "origin", "integration");
    git("reset", "-q", "--hard", "HEAD~1");
    git("checkout", "-q", "feature");
    expect(resolveBaseRef("integration")).toBe(
      "refs/remotes/origin/integration",
    );
  });

  it("uses the local copy when it is ahead of origin", () => {
    git("checkout", "-q", "integration");
    commit("not-pushed.txt");
    git("checkout", "-q", "feature");
    expect(resolveBaseRef("integration")).toBe("refs/heads/integration");
  });

  it("uses origin when the two copies have diverged", () => {
    git("checkout", "-q", "integration");
    commit("pushed.txt");
    git("push", "-q", "origin", "integration");
    git("reset", "-q", "--hard", "HEAD~1");
    commit("local-only.txt");
    git("checkout", "-q", "feature");
    expect(resolveBaseRef("integration")).toBe(
      "refs/remotes/origin/integration",
    );
  });

  it("finds a branch that only exists locally", () => {
    git("branch", "local-only", "main");
    expect(resolveBaseRef("local-only")).toBe("refs/heads/local-only");
  });

  it("accepts other revisions", () => {
    const sha = git("rev-parse", "integration");
    expect(resolveBaseRef(sha)).toBe(sha);
    expect(resolveBaseRef("origin/integration")).toBe("origin/integration");
  });

  it.each(["HEAD", "HEAD~1", "integration~1"])(
    "treats %s as a revision, not a branch on origin",
    (base) => {
      expect(resolveBaseRef(base)).toBe(base);
    },
  );

  it("reviews the last commit with HEAD~1", () => {
    const diff = getDiffAgainstRef(resolveBaseRef("HEAD~1"));
    expect(diff).toContain("mine.txt");
    expect(diff).not.toContain("integration.txt");
  });

  it("explains a diff that is too large", () => {
    writeFileSync("huge.txt", "x\n".repeat(6 * 1024 * 1024));
    git("add", "huge.txt");
    git("commit", "-qm", "add huge.txt");
    expect(() => getDiffAgainstRef(resolveBaseRef("integration"))).toThrow(
      /larger than the 10MB limit/,
    );
  });

  it.each(["nope", "", "--output=/tmp/x", "$(touch pwned)", "a;touch pwned"])(
    "rejects %j",
    (base) => {
      expect(() => resolveBaseRef(base)).toThrow(/not found/);
    },
  );
});

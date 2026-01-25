import { describe, it, expect } from "vitest";
import { isBazReviewer } from "./reviewer.js";

describe("isBazReviewer", () => {
  describe("should return true for valid baz-reviewer names", () => {
    it("returns true for 'baz-reviewer'", () => {
      expect(isBazReviewer("baz-reviewer")).toBe(true);
    });

    it("returns true for 'baz-reviewer[bot]'", () => {
      expect(isBazReviewer("baz-reviewer[bot]")).toBe(true);
    });

    it("returns true for 'https://github.com/apps/baz-reviewer'", () => {
      expect(isBazReviewer("https://github.com/apps/baz-reviewer")).toBe(true);
    });

    it("returns true for 'https://github.com/apps/baz-reviewer-dev'", () => {
      expect(isBazReviewer("https://github.com/apps/baz-reviewer-dev")).toBe(
        true,
      );
    });
  });

  describe("should be case-insensitive", () => {
    it("returns true for 'BAZ-REVIEWER'", () => {
      expect(isBazReviewer("BAZ-REVIEWER")).toBe(true);
    });

    it("returns true for 'Baz-Reviewer'", () => {
      expect(isBazReviewer("Baz-Reviewer")).toBe(true);
    });

    it("returns true for 'BAZ-REVIEWER[BOT]'", () => {
      expect(isBazReviewer("BAZ-REVIEWER[BOT]")).toBe(true);
    });

    it("returns true for 'HTTPS://GITHUB.COM/APPS/BAZ-REVIEWER'", () => {
      expect(isBazReviewer("HTTPS://GITHUB.COM/APPS/BAZ-REVIEWER")).toBe(true);
    });
  });

  describe("should return false for invalid names", () => {
    it("returns false for regular user 'john-doe'", () => {
      expect(isBazReviewer("john-doe")).toBe(false);
    });

    it("returns false for 'baz-reviewer-bot'", () => {
      expect(isBazReviewer("baz-reviewer-bot")).toBe(false);
    });

    it("returns false for 'baz-reviewer2'", () => {
      expect(isBazReviewer("baz-reviewer2")).toBe(false);
    });

    it("returns false for 'my-baz-reviewer'", () => {
      expect(isBazReviewer("my-baz-reviewer")).toBe(false);
    });

    it("returns false for 'baz-reviewer-test'", () => {
      expect(isBazReviewer("baz-reviewer-test")).toBe(false);
    });

    it("returns false for 'github.com/baz-reviewer'", () => {
      expect(isBazReviewer("github.com/baz-reviewer")).toBe(false);
    });

    it("returns false for 'https://github.com/baz-reviewer'", () => {
      expect(isBazReviewer("https://github.com/baz-reviewer")).toBe(false);
    });

    it("returns false for 'https://github.com/apps/baz-reviewer/extra'", () => {
      expect(isBazReviewer("https://github.com/apps/baz-reviewer/extra")).toBe(
        false,
      );
    });
  });

  describe("should handle edge cases", () => {
    it("returns false for empty string", () => {
      expect(isBazReviewer("")).toBe(false);
    });

    it("returns false for whitespace", () => {
      expect(isBazReviewer("   ")).toBe(false);
    });

    it("returns false for baz-reviewer with spaces", () => {
      expect(isBazReviewer("baz-reviewer ")).toBe(false);
      expect(isBazReviewer(" baz-reviewer")).toBe(false);
    });

    it("returns false for baz-reviewer with extra brackets", () => {
      expect(isBazReviewer("baz-reviewer[bot][extra]")).toBe(false);
    });

    it("returns false for baz-reviewer with different brackets", () => {
      expect(isBazReviewer("baz-reviewer(bot)")).toBe(false);
    });
  });
});

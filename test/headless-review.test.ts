import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import {
  applyFailurePolicy,
  buildHeadlessRunConfig,
  parseRunOptions,
  runHeadlessEntryPoint,
} from "../src/index.js";
import { runHeadlessReview } from "../src/headless/review-runner.js";
import { HeadlessReviewResult } from "../src/headless/review-runner.js";
import { AppConfig } from "../src/lib/config/app-mode.js";

const baseDataProvider = {
  fetchPRs: async () => [],
  fetchSpecReviews: async () => null,
  fetchIntegrations: async () => [],
};

afterEach(() => {
  mock.restoreAll();
  delete process.env.BAZ_REPO;
  delete process.env.BAZ_PR_NUMBER;
});

test("tokens mode marks spec review unsupported", async () => {
  const config: AppConfig = {
    mode: { name: "tokens", dataProvider: baseDataProvider },
  };

  const result = await runHeadlessReview({
    repo: "owner/name",
    prNumber: 5,
    runSpec: true,
    runSummary: true,
    mode: "tokens",
  }, config, {
    fetchGithubPRDetails: async () => ({
      id: 1,
      number: 5,
      title: "Test PR",
      url: "https://example.com/pr/5",
      filesChanged: 3,
      linesAdded: 10,
      linesDeleted: 2,
    }),
  });

  assert.equal(result.spec?.supported, false);
  assert.equal(result.summary?.linesAdded, 10);
});

test("baz mode reports unmet and met requirements", async () => {
  const config: AppConfig = {
    mode: { name: "baz", dataProvider: {
      async fetchPRs() {
        return [
          {
            id: "baz-pr-id",
            prNumber: 9,
            title: "Baz PR",
            description: "",
            repoId: "owner/name",
            repositoryName: "owner/name",
          },
        ];
      },
      async fetchSpecReviews() {
        return [
          {
            id: "spec-1",
            commitSha: "sha",
            status: "success",
            requirementsFound: 2,
            requirementsMet: 1,
            requirements: [
              {
                id: "1",
                title: "Do a thing",
                verdict: "met",
                verdict_explanation: null,
                description: "",
                evidence: "",
              },
              {
                id: "2",
                title: "Do another",
                verdict: "not met",
                verdict_explanation: null,
                description: "",
                evidence: "",
              },
            ],
            commentId: "c1",
            createdAt: "now",
            checkRunId: "cr1",
          },
        ];
      },
      async fetchIntegrations() {
        return [];
      },
    } },
  };

  const result = await runHeadlessReview({
    repo: "owner/name",
    prNumber: 9,
    runSpec: true,
    runSummary: false,
    mode: "baz",
  }, config, {
    fetchBazPRDetails: async () => ({
      id: "baz-pr-id",
      pr_number: 9,
      title: "Baz PR",
      description: "",
      lines_added: 4,
      lines_deleted: 2,
      files_changed: 1,
      files_added: 0,
      files_deleted: 0,
      files_viewed: [],
      spec_reviews: [],
      author_name: "baz",
      reviews: [],
      repository_id: "repo",
    }),
  });

  assert.equal(result.spec?.supported, true);
  assert.equal(result.spec?.metRequirements, 1);
  assert.equal(result.spec?.unmetRequirements, 1);
});

test("unmet requirements trigger failure code when requested", () => {
  const result: HeadlessReviewResult = {
    pr: {
      id: "1",
      number: 1,
      title: "Title",
      repository: "owner/name",
    },
    spec: {
      supported: true,
      latestStatus: "success",
      unmetRequirements: 1,
      metRequirements: 0,
    },
  };

  const exitCode = applyFailurePolicy(result, new Set(["unmet_requirements"]));
  assert.equal(exitCode, 2);
});

test("applyFailurePolicy ignores unsupported spec", () => {
  const result: HeadlessReviewResult = {
    pr: {
      id: "1",
      number: 2,
      title: "Title",
      repository: "owner/name",
    },
    spec: {
      supported: false,
      latestStatus: "not_found",
      unmetRequirements: 2,
      metRequirements: 0,
    },
  };

  const exitCode = applyFailurePolicy(result, new Set(["unmet_requirements"]));
  assert.equal(exitCode, 0);
});

test("invalid run options are rejected", () => {
  assert.throws(() => parseRunOptions("spec,unknown"));
});

test("buildHeadlessRunConfig validates required fields", () => {
  const config: AppConfig = { mode: { name: "baz", dataProvider: baseDataProvider } };

  assert.throws(() => buildHeadlessRunConfig({ headless: true }, config));
});

test("headless entry uses env fallbacks without rendering", async () => {
  const config: AppConfig = {
    mode: {
      name: "baz",
      dataProvider: {
        async fetchPRs() {
          return [
            {
              id: "pr",
              prNumber: 7,
              title: "Headless",
              description: "",
              repoId: "owner/name",
              repositoryName: "owner/name",
            },
          ];
        },
        async fetchSpecReviews() {
          return [];
        },
        async fetchIntegrations() {
          return [];
        },
      },
    },
  };

  process.env.BAZ_REPO = "owner/name";
  process.env.BAZ_PR_NUMBER = "7";

  const exitCode = await runHeadlessEntryPoint(
    { headless: true, run: "summary" },
    config,
    {
      fetchBazPRDetails: async () => ({
        id: "pr",
        pr_number: 7,
        title: "Headless",
        description: "",
        lines_added: 0,
        lines_deleted: 0,
        files_changed: 0,
        files_added: 0,
        files_deleted: 0,
        files_viewed: [],
        spec_reviews: [],
        author_name: "baz",
        reviews: [],
        repository_id: "repo",
      }),
    },
  );

  assert.equal(exitCode, 0);
});

test("headless entry reports usage errors with exit code 1", async () => {
  const config: AppConfig = { mode: { name: "baz", dataProvider: baseDataProvider } };
  const consoleError = mock.method(console, "error", () => {});

  const exitCode = await runHeadlessEntryPoint({ headless: true }, config, {
    fetchBazPRDetails: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(exitCode, 1);
  assert.ok(consoleError.mock.calls[0].arguments[0].includes("Headless mode requires"));
});

test("headless entry supports markdown output", async () => {
  const config: AppConfig = {
    mode: { name: "tokens", dataProvider: baseDataProvider },
  };
  const consoleLog = mock.method(console, "log", () => {});

  const exitCode = await runHeadlessEntryPoint(
    {
      headless: true,
      repo: "owner/name",
      pr: "10",
      output: "markdown",
    },
    config,
    {
      fetchGithubPRDetails: async () => ({
        id: 10,
        number: 10,
        title: "Markdown PR",
        url: "https://example.com/pr/10",
        filesChanged: 1,
        linesAdded: 2,
        linesDeleted: 3,
      }),
    },
  );

  assert.equal(exitCode, 0);
  assert.ok(consoleLog.mock.calls[0].arguments[0].includes("# PR #10: Markdown PR"));
});

test("unmet requirements propagate through headless entry failure policy", async () => {
  const config: AppConfig = {
    mode: {
      name: "baz",
      dataProvider: {
        async fetchPRs() {
          return [
            {
              id: "baz-pr-id",
              prNumber: 3,
              title: "Baz PR",
              description: "",
              repoId: "owner/name",
              repositoryName: "owner/name",
            },
          ];
        },
        async fetchSpecReviews() {
          return [
            {
              id: "spec-1",
              commitSha: "sha",
              status: "failed",
              requirementsFound: 1,
              requirementsMet: 0,
              requirements: [
                {
                  id: "1",
                  title: "Need work",
                  verdict: "not met",
                  verdict_explanation: null,
                  description: "",
                  evidence: "",
                },
              ],
              commentId: "c1",
              createdAt: "now",
              checkRunId: "cr1",
            },
          ];
        },
        async fetchIntegrations() {
          return [];
        },
      },
    },
  };

  const exitCode = await runHeadlessEntryPoint(
    {
      headless: true,
      repo: "owner/name",
      pr: "3",
      run: "spec",
      failOn: "unmet_requirements",
    },
    config,
    {
      fetchBazPRDetails: async () => ({
        id: "baz-pr-id",
        pr_number: 3,
        title: "Baz PR",
        description: "",
        lines_added: 0,
        lines_deleted: 0,
        files_changed: 0,
        files_added: 0,
        files_deleted: 0,
        files_viewed: [],
        spec_reviews: [],
        author_name: "baz",
        reviews: [],
        repository_id: "repo",
      }),
    },
  );

  assert.equal(exitCode, 2);
});

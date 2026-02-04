import { describe, vi, test, expect } from "vitest";
import { GitHubAPIWorker } from "../../src/workers/gitHubAPIWorker.ts";

const githubApiWorker = new GitHubAPIWorker();

vi.mock("comlink", () => ({
  expose: vi.fn()
}));

describe("GitHub API Worker Tests", () => {
  test("should fetch issues and events from a GitHub repository", async () => {
    const originalCreateHeaders =
    // @ts-expect-error - accessing private property for testing
      githubApiWorker.createHeaders.bind(githubApiWorker);
    // @ts-expect-error - accessing private property for testing
    githubApiWorker.createHeaders = (token: string) => {
      const headers = originalCreateHeaders(token);
      // unset authentication header to avoid actual API calls during testing
      delete headers.Authorization;
      return headers;
    };
    const { issues, events } = await githubApiWorker.fetchIssuesAndEvents(
      "https://github.com/christoph-det/test-repo-wasmocular",
      () => {},
      "demo_token_testing"
    );
    expect(issues).toBeDefined();
    expect(events).toBeDefined();
    expect(issues.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    console.log(`Fetched ${issues.length} issues and ${events.length} events.`);
  });

  test("should handle invalid repository URL", async () => {
    await expect(
      githubApiWorker.fetchIssuesAndEvents("invalid-url", () => {}, "")
    ).rejects.toThrow("Invalid URL");
  });
});

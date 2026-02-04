import { beforeEach, describe, vi, test, expect, afterEach } from "vitest";
import { GitHubAPIWorker } from "../../src/workers/gitHubAPIWorker.ts";

vi.mock("comlink", () => ({
  expose: vi.fn()
}));

describe("GitHub API Worker Tests", () => {
  test("should fetch issues and events from a GitHub repository", async () => {
    // Mock the GitHub API responses
    const githubApiWorker = new GitHubAPIWorker();
    const { issues, events } = await githubApiWorker.fetchIssuesAndEvents("https://github.com/christoph-det/test-repo-wasmocular", () => {}, "");
    expect(issues).toBeDefined();
    expect(events).toBeDefined();
    console.log(`Fetched ${issues.length} issues and ${events.length} events.`);
  });

  test("should handle invalid repository URL", async () => {
    const githubApiWorker = new GitHubAPIWorker();
    await expect(
      githubApiWorker.fetchIssuesAndEvents("invalid-url", () => {}, "")
    ).rejects.toThrow("Invalid URL");
  });

});
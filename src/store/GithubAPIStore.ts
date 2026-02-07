import GitHubAPIWorkerFactory from "@/workers/gitHubAPIWorker?worker";
import { proxy, Remote, wrap } from "comlink";
import { GitHubAPIWorker } from "@/workers/gitHubAPIWorker";
import { GitHubIssue, GitHubIssueEvent } from "@/workers/dbWorker.d";

/**
 * This store handles the lifecycle of a GitHub API Worker that performs fetching issues and events.
 */
export class GithubAPIStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<GitHubAPIWorker> | null = null;

  constructor() {
    this.init();
    console.log("GithubAPIStore initialized");
  }

  private init() {
    this.worker = new GitHubAPIWorkerFactory();
    this.rpcWorker = wrap(this.worker);
  }

  reset() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.init();
  }

  /**
   * Loads the GitHub issues and events for the specified repository.
   * @param repoUrl URL to the Repository, must be GitHub
   * @param onProgress callback for displaying progress
   * @param token GitHub API token for authentication (optional, can be empty string)
   * @returns A promise that resolves to an object containing arrays of GitHub issues and events.
   */
  async fetchGitHubIssuesAndEvents(
    repoUrl: string,
    onProgress: (progress: number, message: string) => void,
    token: string
  ): Promise<{
    issues: GitHubIssue[];
    events: GitHubIssueEvent[];
  }> {
    if (!this.rpcWorker) {
      console.error("GitHub API worker not initialized");
      return { issues: [], events: [] };
    }
    const progressProxy = proxy(onProgress);
    return await this.rpcWorker.fetchIssuesAndEvents(
      repoUrl,
      progressProxy,
      token
    );
  }
}

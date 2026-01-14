import GitHubAPIWorkerFactory from "@/workers/gitHubAPIWorker?worker";
import { proxy, Remote, wrap } from "comlink";
import { GitHubAPIWorker } from "@/workers/gitHubAPIWorker";
import { GitHubIssue, GitHubIssueEvent } from "@/workers/dbWorker.d";

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

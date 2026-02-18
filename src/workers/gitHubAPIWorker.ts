import * as Comlink from "comlink";
import { GitHubIssue, GitHubIssueEvent } from "./dbWorker.d";
import type {
  GitHubIssueResponse,
  GitHubTimelineEvent
} from "./gitHubAPIWorker.d";

const ISSUES_PER_PAGE = 100;

/**
 * Worker to interact with the GitHub API for fetching issues and their associated events.
 */
export class GitHubAPIWorker {
  /**
   * Returns all issues and their associated timeline events from a specified GitHub repository.
   * The token is optional but recommended to avoid rate limiting and to fetch issue timeline events. It should be a fine-grained personal access token with repo reading scope.
   */
  async fetchIssuesAndEvents(
    repoUrl: string,
    onProgress: (progress: number, message: string) => void,
    token: string
  ): Promise<{
    issues: GitHubIssue[];
    events: GitHubIssueEvent[];
  }> {
    const url = new URL(repoUrl);
    const [, owner, repo] = url.pathname.split("/");
    const repoName = repo.replace(/\.git$/, "");
    const hasToken = token.trim().length > 0;

    onProgress(5, "Starting to fetch issues...");

    try {
      const headers = this.createHeaders(token);

      const allIssues: GitHubIssue[] = await this.fetchAllIssues(
        headers,
        onProgress,
        owner,
        repoName
      );

      // Fetch timeline for issues to get commit references (only when user provides token)
      let allEvents: GitHubIssueEvent[] = [];

      if (hasToken) {
        allEvents = await this.fetchIssueTimelineEvents(
          allIssues,
          headers,
          onProgress,
          owner,
          repoName
        );
      }

      onProgress(95, "Saving to database...");
      return { issues: allIssues, events: allEvents };
    } catch (error) {
      onProgress(100, "Error fetching issues: " + (error as Error).message);
      throw error;
    }
  }

  private createHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json"
    };
    if (token.trim().length > 0) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private mapIssueResponse(issue: GitHubIssueResponse): GitHubIssue {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
      author: issue.user?.login ?? "unknown",
      labels: issue.labels.map((l) => l.name).join(", "),
      commentsCount: issue.comments,
      body: issue.body ?? ""
    };
  }

  private mapTimelineEvent(
    event: GitHubTimelineEvent,
    issueNumber: number
  ): GitHubIssueEvent {
    return {
      issueNumber,
      eventType: event.event,
      commitSha: event.commit_id ?? null,
      createdAt: event.created_at,
      actor: event.actor?.login ?? "unknown"
    };
  }

  private calculateProgress(
    current: number,
    total: number,
    startProgress: number,
    endProgress: number
  ): number {
    const range = endProgress - startProgress;
    return Math.min(
      endProgress,
      startProgress + Math.floor((current / total) * range)
    );
  }

  private async fetchAllIssues(
    headers: Record<string, string>,
    onProgress: (progress: number, message: string) => void,
    owner: string,
    repoName: string
  ): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/issues?state=all&per_page=${ISSUES_PER_PAGE}&page=${page}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        if (allIssues.length > 0) {
          const warningMessage = `Warning: Failed to fetch all issues. Successfully fetched ${allIssues.length} issues. Error: ${response.status} - ${errorText}`;
          onProgress(40, warningMessage);
          return allIssues;
        }
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      const issues = (await response.json()) as GitHubIssueResponse[];
      // the endpoint returns pull requests as issues, so we need to filter them out (https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28&versionId=free-pro-team%40latest&productId=rest)
      const actualIssues = issues.filter((i) => !i.pull_request);

      allIssues.push(
        ...actualIssues.map((issue) => this.mapIssueResponse(issue))
      );

      const progress = this.calculateProgress(page, page + 1, 5, 40);
      onProgress(progress, `Fetched ${allIssues.length} issues...`);

      if (issues.length < ISSUES_PER_PAGE) {
        hasMore = false;
      } else {
        page++;
      }
    }
    return allIssues;
  }

  private async fetchIssueTimelineEvents(
    allIssues: GitHubIssue[],
    headers: Record<string, string>,
    onProgress: (progress: number, message: string) => void,
    owner: string,
    repoName: string
  ): Promise<GitHubIssueEvent[]> {
    const allEvents: GitHubIssueEvent[] = [];
    onProgress(40, "Fetching issue events...");
    let issueEventsFetched = 0;

    for (const issue of allIssues) {
      try {
        const timelineResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/issues/${issue.number}/timeline`,
          { headers }
        );

        if (timelineResponse.ok) {
          const timeline =
            (await timelineResponse.json()) as GitHubTimelineEvent[];

          for (const event of timeline) {
            allEvents.push(this.mapTimelineEvent(event, issue.number));
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch timeline for issue #${issue.number}:`,
          error
        );
      }

      issueEventsFetched++;
      const eventsProgress = this.calculateProgress(
        issueEventsFetched,
        allIssues.length,
        40,
        90
      );
      onProgress(
        eventsProgress,
        `Fetching issue-commit links... (${issueEventsFetched}/${allIssues.length})`
      );
    }
    return allEvents;
  }
}

const githubApiWorker = new GitHubAPIWorker();
Comlink.expose(githubApiWorker);

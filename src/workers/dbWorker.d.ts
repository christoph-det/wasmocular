export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: string;
  labels: string;
  commentsCount: number;
  body: string;
}

export interface GitHubIssueEvent {
  issueNumber: number;
  eventType: string;
  commitSha: string | null;
  createdAt: string;
  actor: string;
}

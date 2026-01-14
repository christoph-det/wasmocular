export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author: string;
  labels: string;
  comments_count: number;
  body: string;
}

export interface GitHubIssueEvent {
  issue_number: number;
  event_type: string;
  commit_sha: string | null;
  created_at: string;
  actor: string;
}

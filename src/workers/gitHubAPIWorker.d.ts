export interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: { login: string } | null;
  labels: { name: string }[];
  comments: number;
  body: string | null;
  pull_request?: unknown;
}

export interface GitHubTimelineEvent {
  event: string;
  commit_id?: string | null;
  created_at: string;
  actor?: { login: string } | null;
}

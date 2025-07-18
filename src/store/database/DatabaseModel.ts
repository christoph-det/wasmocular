export const DatabaseDataModel = {
  branches: {
    id: "integer",
    name: "string",
    is_default: "boolean"
  },
  commits: {
    id: "integer",
    sha: "string",
    message: "string",
    author_id: "integer",
    committer_id: "integer",
    author_date: "datetime",
    committer_date: "datetime",
    parent_sha: "string",
    branch_id: "integer"
  },
  authors: {
    id: "integer",
    name: "string",
    email: "string"
  },
  issues: {
    id: "integer",
    title: "string",
    state: "string",
    author_id: "integer",
    created_at: "datetime",
    closed_at: "datetime"
  }
};

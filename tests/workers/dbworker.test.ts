import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";
import { describe, vi, test, expect, beforeEach, afterEach } from "vitest";
import { GitHubIssue, GitHubIssueEvent } from "../../src/workers/dbWorker.d";

vi.mock("comlink", () => ({
  expose: vi.fn()
}));

const mockDirectoryHandle = {
  removeEntry: vi.fn().mockResolvedValue(undefined)
};

const mockNavigator = {
  storage: {
    getDirectory: vi.fn().mockResolvedValue(mockDirectoryHandle)
  },
  onLine: true
};

// Inject the mock into the global scope
vi.stubGlobal("navigator", mockNavigator);

class MockWorker {
  terminate = vi.fn();
  addEventListener = vi.fn();
  postMessage = vi.fn();
}
vi.stubGlobal("Worker", MockWorker);

vi.mock("@duckdb/duckdb-wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@duckdb/duckdb-wasm")>();

  class MockAsyncDuckDB {
    instantiate = vi.fn().mockResolvedValue(undefined);
    open = vi.fn().mockResolvedValue(undefined);
    terminate = vi.fn().mockResolvedValue(undefined);
    connect = vi.fn().mockResolvedValue({
      query: vi
        .fn()
        .mockResolvedValue({ toArray: () => ["count(table_name)", 1] }),
      close: vi.fn().mockResolvedValue(undefined),
      insertArrowFromIPCStream: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      })
    });
  }

  return {
    ...actual,
    AsyncDuckDB: MockAsyncDuckDB
  };
});

const { DatabaseWorker } = await import("../../src/workers/dbWorker.ts");
let databaseWorker = new DatabaseWorker();

describe("db Worker Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseWorker = new DatabaseWorker();
  });

  afterEach(async () => {
    await databaseWorker.terminate();
  });

  test("can initialize will not call twice for same identifier and mode", async () => {
    const initializeSpy = vi.spyOn(
      databaseWorker as any,
      "instantiateDatabase"
    );
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);

    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  test("can delete database (from storage) and reinitialize correctly", async () => {
    const initializeSpy = vi.spyOn(
      databaseWorker as any,
      "instantiateDatabase"
    );
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);
    await databaseWorker.deleteDatabase("test-repo");
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);

    expect(initializeSpy).toHaveBeenCalledTimes(2);
    expect(mockDirectoryHandle.removeEntry).toHaveBeenCalled();
  });

  test("switch access mode will reinitialize the database and use the correct mode", async () => {
    const initializeSpy = vi.spyOn(
      databaseWorker as any,
      "instantiateDatabase"
    );
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);
    await databaseWorker.switchAccessMode(DuckDBAccessMode.READ_ONLY);

    expect(initializeSpy).toHaveBeenCalledTimes(2);
    expect((databaseWorker as any).accessMode).toBe(DuckDBAccessMode.READ_ONLY);
    expect((databaseWorker as any).repositoryIdentifier).toBe("test-repo");
  });

  test("query will instantiate the connection to query database", async () => {
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);
    // @ts-ignore to access private db property
    const connectSpy = vi.spyOn(databaseWorker.db as any, "connect");
    await databaseWorker.query("SELECT 1");

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  test("insertIndexerData will insert indexer data into the table commits and persist a checkpoint", async () => {
    const buffer = new Uint8Array([1, 2, 3]);
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);

    // ensure db is connected
    await databaseWorker.query("SELECT 1");

    // @ts-ignore to access private db property
    const querySpy = vi.spyOn(databaseWorker.connection, "query");

    await databaseWorker.insertIndexerData("test-repo", buffer);
    expect(querySpy).toHaveBeenCalledWith("CHECKPOINT;");
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("commits"));
  });

  test("inserting github issues will insert the data into the correct table and persist a checkpoint", async () => {
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);

    // ensure db is connected
    await databaseWorker.query("SELECT 1");

    // @ts-ignore to access private db property
    const querySpy = vi.spyOn(databaseWorker.connection, "query");

    const issues: GitHubIssue[] = [
      {
        id: 1,
        number: 1,
        title: "issue 1",
        state: "open",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
        closedAt: null,
        author: "user1",
        labels: "labels",
        commentsCount: 10,
        body: "issue body"
      }
    ];

    await databaseWorker.insertGitHubIssues(issues);
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS github_issues")
    );
    expect(querySpy).toHaveBeenCalledWith("CHECKPOINT;");
  });

  test("inserting github issue events will insert the data into the correct table and persist a checkpoint", async () => {
    await databaseWorker.initialize("test-repo", DuckDBAccessMode.READ_WRITE);

    // ensure db is connected
    await databaseWorker.query("SELECT 1");

    // @ts-ignore to access private db property
    const querySpy = vi.spyOn(databaseWorker.connection, "query");

    const issueEvents: GitHubIssueEvent[] = [
      {
        issueNumber: 1,
        eventType: "opened",
        commitSha: "sha1",
        createdAt: "2023-01-01T00:00:00Z",
        actor: "user1"
      }
    ];

    await databaseWorker.insertGitHubIssueEvents(issueEvents);
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS github_issue_events")
    );
    expect(querySpy).toHaveBeenCalledWith("CHECKPOINT;");
  });
});

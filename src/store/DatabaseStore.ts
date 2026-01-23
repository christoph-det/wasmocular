import DatabaseWorkerFactory from "@/workers/dbWorker?worker";
import type { DatabaseWorker } from "@/workers/dbWorker";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";
import { Remote, wrap, transfer } from "comlink";
import { makeAutoObservable } from "mobx";
import { GitHubIssue, GitHubIssueEvent } from "@/workers/dbWorker.d";

/**
 * This store handles the lifecycle of a DuckDB Worker that performs database operations.
 */
export class DatabaseStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<DatabaseWorker> | null = null;
  private currentRepositoryIdentifier: string | null = null;
  private currentAccessMode: DuckDBAccessMode | null = null;
  private awaitDatabaseInitialization: Promise<void>;
  tablesAndColumns: Record<
    string,
    { column_name: string; data_type: string }[]
  > = {};

  constructor() {
    makeAutoObservable(this);
    this.awaitDatabaseInitialization = new Promise((resolve) => {
      resolve();
    });
    this.init();
    console.log("DatabaseStore initialized");
  }

  private init() {
    this.worker = new DatabaseWorkerFactory();
    this.rpcWorker = wrap(this.worker);
  }

  /**
   * Deletes the database specified.
   */
  async deleteDatabase(repositoryIdentifier: string) {
    if (
      this.currentRepositoryIdentifier === repositoryIdentifier &&
      this.rpcWorker
    ) {
      await this.rpcWorker.deleteDatabase(repositoryIdentifier);
      await this.closeConnection();
    } else {
      const deleteWorker = new DatabaseWorkerFactory();
      const rpcDeleteWorker = wrap<DatabaseWorker>(deleteWorker);
      await rpcDeleteWorker.deleteDatabase(repositoryIdentifier);
      await rpcDeleteWorker.terminate();
      deleteWorker.terminate();
    }
  }

  async closeConnection() {
    if (this.rpcWorker) {
      await this.rpcWorker.terminate();
      this.worker?.terminate();
      this.currentRepositoryIdentifier = null;
      this.currentAccessMode = null;
      this.tablesAndColumns = {};
      this.init();
    }
  }

  /**
   * Used for inserting the indexer results from the WasmGix worker into the database.
   */
  async receiveIndexerResults(identifier: string, resultBuffer: Uint8Array) {
    if (!this.rpcWorker) {
      console.error("Database worker not initialized");
      return;
    }
    // Ensure we are in write mode before pushing indexing data.
    this.currentRepositoryIdentifier = identifier;
    this.currentAccessMode = null;
    this.ensureInitialization(identifier, DuckDBAccessMode.READ_WRITE);
    await this.awaitDatabaseInitialization;

    await this.rpcWorker.insertIndexerData(
      identifier,
      transfer(resultBuffer, [resultBuffer.buffer])
    );
  }

  /**
   * Ensures the initialization of the database connection with the specified access mode (read/write)
   */
  ensureInitialization(
    repositoryIdentifier: string,
    accessMode: DuckDBAccessMode
  ) {
    if (!this.rpcWorker) {
      throw new Error("Database worker not initialized");
    }
    const hasMatchingIdentifier =
      this.currentRepositoryIdentifier === repositoryIdentifier;
    const hasMatchingMode = this.currentAccessMode === accessMode;

    if (hasMatchingIdentifier && hasMatchingMode) {
      return;
    }

    this.currentRepositoryIdentifier = repositoryIdentifier;
    this.currentAccessMode = accessMode;

    this.awaitDatabaseInitialization = this.rpcWorker.initialize(
      repositoryIdentifier,
      accessMode
    );
  }

  async runQuery(sql: string): Promise<unknown> {
    await this.awaitDatabaseInitialization;
    if (!this.rpcWorker) {
      throw new Error("Database worker not initialized");
    }

    return this.rpcWorker
      .query(sql)
      .then((result) => {
        return result;
      })
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Returns the names and data types of all created tables.
   */
  async getTableAndColumnNames(): Promise<
    Record<string, { column_name: string; data_type: string }[]>
  > {
    await this.awaitDatabaseInitialization;
    if (Object.keys(this.tablesAndColumns).length > 0) {
      return this.tablesAndColumns;
    }
    const result = await this.listTablesAndColumns();
    const reducedByTable = result.reduce(
      (acc, { table_name, column_name, data_type }) => {
        if (!acc[table_name]) {
          acc[table_name] = [];
        }
        acc[table_name].push({ column_name, data_type });
        return acc;
      },
      {} as Record<string, { column_name: string; data_type: string }[]>
    );
    this.tablesAndColumns = reducedByTable;
    return this.tablesAndColumns;
  }

  private async listTablesAndColumns(): Promise<
    { table_name: string; column_name: string; data_type: string }[]
  > {
    const sql = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'main'
      ORDER BY table_name, ordinal_position;
    `;
    return (await this.runQuery(sql)) as {
      table_name: string;
      column_name: string;
      data_type: string;
    }[];
  }

  /**
   * Adds the issue array to its own database table.
   */
  async insertGitHubIssues(issues: GitHubIssue[]) {
    await this.awaitDatabaseInitialization;
    if (!this.rpcWorker) {
      throw new Error("Database worker not initialized");
    }
    await this.rpcWorker.insertGitHubIssues(issues);
    // reset cached tables and columns to force reload in UI
    this.tablesAndColumns = {};
  }

  /**
   * Adds the issue events array to its own database table.
   */
  async insertGitHubIssueEvents(events: GitHubIssueEvent[]) {
    await this.awaitDatabaseInitialization;
    if (!this.rpcWorker) {
      throw new Error("Database worker not initialized");
    }
    await this.rpcWorker.insertGitHubIssueEvents(events);
    // reset cached tables and columns to force reload in UI
    this.tablesAndColumns = {};
  }
}

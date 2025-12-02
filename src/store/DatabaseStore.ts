import DatabaseWorkerFactory from "@/workers/dbWorker?worker";
import type { DatabaseWorker } from "@/workers/dbWorker";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";
import { Remote, wrap, transfer } from "comlink";
import { makeAutoObservable } from "mobx";

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

  async receiveIndexerResults(identifier: string, resultBuffer: Uint8Array) {
    await this.awaitDatabaseInitialization;
    if (!this.rpcWorker) {
      console.error("Database worker not initialized");
      return;
    }
    // Ensure we are in write mode before pushing indexing data.
    this.currentRepositoryIdentifier = identifier;
    this.currentAccessMode = null;
    this.ensureInitialization(identifier, DuckDBAccessMode.READ_WRITE);

    await this.rpcWorker.insertIndexerData(
      identifier,
      transfer(resultBuffer, [resultBuffer.buffer])
    );
  }

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

  async listTablesAndColumns(): Promise<
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
}

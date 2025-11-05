import { DatabaseWorker } from "@/workers/dbWorker";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";
import { Remote, wrap, transfer } from "comlink";

export class DatabaseStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<DatabaseWorker> | null = null;
  private currentRepositoryIdentifier: string | null = null;
  private currentAccessMode: DuckDBAccessMode | null = null;

  constructor() {
    this.init();
    console.log("DatabaseStore initialized");
  }

  async receiveIndexerResults(identifier: string, resultBuffer: Uint8Array) {
    if (!this.rpcWorker) {
      console.error("Database worker not initialized");
      return;
    }
    // Ensure we are in write mode before pushing indexing data.
    this.currentRepositoryIdentifier = identifier;
    this.currentAccessMode = null;
    await this.ensureInitialization(identifier, DuckDBAccessMode.READ_WRITE);

    await this.rpcWorker.insertIndexerData(
      identifier,
      transfer(resultBuffer, [resultBuffer.buffer])
    );
  }

  async ensureInitialization(
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

    await this.rpcWorker.initialize(repositoryIdentifier, accessMode);
  }

  runQuery(sql: string): Promise<unknown> {
    if (!this.rpcWorker) {
      return Promise.reject(new Error("Database worker not initialized"));
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

  init() {
    this.worker = new Worker(
      new URL("../../workers/dbWorker.ts", import.meta.url),
      { type: "module" }
    );

    this.rpcWorker = wrap(this.worker);
  }
}

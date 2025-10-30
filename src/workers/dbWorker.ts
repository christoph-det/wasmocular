import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import {
  DatabaseAccessMode,
  DatabaseWorkerInboundMessage,
  DatabaseWorkerOutboundMessage
} from "./dbWorker.types";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker
  }
};

class DatabaseWorker {
  worker: Worker | null = null;
  db: duckdb.AsyncDuckDB | null = null;
  connection: duckdb.AsyncDuckDBConnection | null = null;
  isInitialized = false;
  repositoryIdentifier: string | null = null;
  accessMode: duckdb.DuckDBAccessMode | null = null;

  private async instantiateDatabase(
    repositoryIdentifier: string,
    accessMode: duckdb.DuckDBAccessMode
  ) {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    this.worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, this.worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await this.db.open({
      path: `opfs://repminer_database_${repositoryIdentifier}.db`,
      accessMode
    });
  }

  private async shutdown(resetRepositoryInfo: boolean) {
    if (this.connection) {
      try {
        await this.connection.query("CHECKPOINT;");
      } catch (error) {
        console.warn("DB Worker: Failed to checkpoint before shutdown:", error);
      }

      try {
        await this.connection.close();
      } catch (error) {
        console.warn("DB Worker: Failed to close connection cleanly:", error);
      }

      this.connection = null;
    }

    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.accessMode = null;

    if (resetRepositoryInfo) {
      this.repositoryIdentifier = null;
    }
  }

  async initialize(
    repositoryIdentifier: string,
    accessMode: duckdb.DuckDBAccessMode
  ) {
    if (this.isInitialized) {
      const sameIdentifier = this.repositoryIdentifier === repositoryIdentifier;
      const sameMode = this.accessMode === accessMode;

      if (sameIdentifier && sameMode) {
        return;
      }

      await this.shutdown(!sameIdentifier);
    }

    await this.instantiateDatabase(repositoryIdentifier, accessMode);

    this.repositoryIdentifier = repositoryIdentifier;
    this.accessMode = accessMode;
    this.isInitialized = true;
    this.connection = null;

    console.log(
      `Database initialized for identifier "${repositoryIdentifier}" in ${duckdb.DuckDBAccessMode[accessMode]} mode`
    );
  }

  private async connect() {
    if (!this.db || !this.isInitialized) {
      throw new Error(
        "Database not initialized. Call INIT with a repository identifier first."
      );
    }
    this.connection = await this.db.connect();
  }

  async terminate() {
    await this.shutdown(true);
  }

  async switchAccessMode(accessMode: duckdb.DuckDBAccessMode) {
    if (!this.repositoryIdentifier) {
      throw new Error("Cannot switch access mode before initialization");
    }

    if (this.accessMode === accessMode && this.isInitialized) {
      return;
    }

    await this.shutdown(false);
    await this.instantiateDatabase(this.repositoryIdentifier, accessMode);

    this.accessMode = accessMode;
    this.isInitialized = true;
    this.connection = null;

    console.log(
      `Database access mode switched to ${duckdb.DuckDBAccessMode[accessMode]} for identifier "${this.repositoryIdentifier}"`
    );
  }

  async persistCheckpoint() {
    if (!this.connection) {
      throw new Error("No active database connection for checkpointing");
    }
    await this.connection.query("CHECKPOINT;");
  }

  async query(sql: string) {
    if (!this.repositoryIdentifier) {
      throw new Error("Database not initialized for any repository");
    }

    if (!this.connection) {
      await this.connect();
    }

    if (!this.connection) {
      throw new Error("No connection to database");
    }

    const result = await this.connection.query(sql);
    return result;
  }

  async insertIndexerData(identifier: string, buffer: Uint8Array) {
    if (!this.repositoryIdentifier) {
      throw new Error("Database not initialized for any repository");
    }

    if (identifier !== this.repositoryIdentifier) {
      throw new Error(
        `Indexer data identifier "${identifier}" does not match initialized repository "${this.repositoryIdentifier}"`
      );
    }

    if (this.accessMode !== duckdb.DuckDBAccessMode.READ_WRITE) {
      await this.switchAccessMode(duckdb.DuckDBAccessMode.READ_WRITE);
    }

    if (!this.connection) {
      await this.connect();
    }

    if (!this.connection) {
      throw new Error("No connection to database");
    }

    const tableName = `commits`;

    await this.connection.insertArrowFromIPCStream(buffer, {
      name: tableName,
      create: true
    });
    await this.persistCheckpoint();

    console.log(`DB Worker: Inserted indexer data into table ${tableName}`);
  }
}

const resolveAccessMode = (
  mode: DatabaseAccessMode
): duckdb.DuckDBAccessMode => {
  return mode === "READ_WRITE"
    ? duckdb.DuckDBAccessMode.READ_WRITE
    : duckdb.DuckDBAccessMode.READ_ONLY;
};

const dbWorker = new DatabaseWorker();

onmessage = async function (event: MessageEvent<DatabaseWorkerInboundMessage>) {
  const receivedMessage = event.data;

  switch (receivedMessage.type) {
    case "INIT": {
      try {
        const accessMode = resolveAccessMode(receivedMessage.accessMode);
        await dbWorker.initialize(
          receivedMessage.repositoryIdentifier,
          accessMode
        );
      } catch (error) {
        const errorMessage: DatabaseWorkerOutboundMessage = {
          type: "ERROR",
          error: error instanceof Error ? error.message : String(error)
        };
        postMessage(errorMessage);
      }
      break;
    }
    case "QUERY": {
      try {
        const result = await dbWorker.query(receivedMessage.sql);
        if (receivedMessage.returnResult) {
          if (!receivedMessage.requestId) {
            console.warn(
              "Database worker received QUERY without requestId for result response."
            );
            break;
          }
          const arrayResult = result.toArray();
          const cloneableResult: unknown = JSON.parse(
            JSON.stringify(arrayResult, (_, v: unknown) =>
              typeof v === "bigint" ? v.toString() : v
            )
          );
          const resultMessage: DatabaseWorkerOutboundMessage = {
            type: "RESULT",
            result: cloneableResult,
            requestId: receivedMessage.requestId
          };
          postMessage(resultMessage);
        }
      } catch (error) {
        const errorMessage: DatabaseWorkerOutboundMessage = {
          type: "ERROR",
          error: error instanceof Error ? error.message : String(error),
          requestId: receivedMessage.requestId
        };
        postMessage(errorMessage);
      }
      break;
    }
    case "TERMINATE": {
      try {
        await dbWorker.terminate();
        const disconnectedMessage: DatabaseWorkerOutboundMessage = {
          type: "DISCONNECTED"
        };
        postMessage(disconnectedMessage);
      } catch (error) {
        const errorMessage: DatabaseWorkerOutboundMessage = {
          type: "ERROR",
          error: error instanceof Error ? error.message : String(error)
        };
        postMessage(errorMessage);
      }
      break;
    }
    case "INDEXER_RESULT": {
      console.log(
        "DB Worker: Received INDEXER_RESULT message with buffer size:",
        receivedMessage.buffer.byteLength
      );
      try {
        await dbWorker.insertIndexerData(
          receivedMessage.identifier,
          receivedMessage.buffer
        );
      } catch (error) {
        const errorMessage: DatabaseWorkerOutboundMessage = {
          type: "ERROR",
          error: error instanceof Error ? error.message : String(error)
        };
        postMessage(errorMessage);
      }
      break;
    }
    default: {
      const errorMessage: DatabaseWorkerOutboundMessage = {
        type: "ERROR",
        error: "Unsupported message type"
      };
      postMessage(errorMessage);
      break;
    }
  }
};

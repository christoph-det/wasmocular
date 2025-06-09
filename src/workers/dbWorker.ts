import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import {
  DatabaseDisconnectedMessage,
  DatabaseMessageType,
  DatabaseResultMessage,
  DatabaseWorkerMessage
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
  logger: duckdb.ConsoleLogger | null = null;
  connection: duckdb.AsyncDuckDBConnection | null = null;
  is_initialized = false;

  async init() {
    if (!this.db) {
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      this.worker = new Worker(bundle.mainWorker!);
      this.logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      this.db = new duckdb.AsyncDuckDB(this.logger, this.worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      await this.db.open({
        path: "opfs://repminer_database.db",
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE
      });
      await this.createTables();
      console.log("Database initialized");
      this.is_initialized = true;
    } else {
      console.log("Database already initialized");
    }
  }

  async connect() {
    if (!this.db) {
      await this.init();
    }
    if (this.db) {
      this.connection = await this.db.connect();
    } else {
      throw new Error("Not able to initialize Database");
    }
  }

  async terminate() {
    if (this.connection) {
      await this.connection.query("CHECKPOINT;");
      await this.connection.close();
      this.connection = null;
      await this.db?.terminate();
    }
  }

  // TODO: not sure if this is the right way to export the database, what file system to use?
  async export() {
    if (this.connection) {
      //this.connection.query("EXPORT DATABASE '/tmp/duckdbexportcsv';");
      await this.db?.copyFileToBuffer("/tmp/duckdbexportcsv");
    } else {
      throw new Error("No connection to database");
    }
  }

  // By default DuckDB triggers a checkpoint every 16 MiB of data written to the database. (can be changed by setting the checkpoint_threshold config option)
  async persistCheckpoint() {
    if (this.connection) {
      await this.connection.query("CHECKPOINT;");
    } else {
      throw new Error("No connection to database");
    }
  }

  async query(sql: string) {
    if (!this.connection) {
      await this.connect();
    }
    if (this.connection) {
      const result = await this.connection.query(sql);
      return result;
    } else {
      throw new Error("No connection to database");
    }
  }

  async createTables() {
    if (!this.connection) {
      await this.connect();
    }
    if (this.connection) {
      await this.query(
        "CREATE TABLE IF NOT EXISTS people (id INTEGER, name VARCHAR)"
      );
    } else {
      throw new Error("No connection to database");
    }
  }
}

onmessage = function () {
  console.log("DB Worker: Received message but is not initialized yet.");
};

const dbWorker = new DatabaseWorker();

//using an IIFE to remove top-level await, which is not supported in workers and caused build errors
(async function () {
  await dbWorker.init();

  onmessage = async function (event: MessageEvent<DatabaseWorkerMessage>) {
    //console.log("Worker received message:", event.data);
    const receivedMessage: DatabaseWorkerMessage = event.data;

    switch (receivedMessage.type) {
      case DatabaseMessageType.QUERY: {
        const result = await dbWorker.query(receivedMessage.sql);
        if (receivedMessage.returnResult) {
          const arrayResult = result.toArray();
          const cloneableResult: unknown = JSON.parse(
            JSON.stringify(arrayResult, (_, v: unknown) =>
              typeof v === "bigint" ? v.toString() : v
            )
          );
          const resultMessage: DatabaseResultMessage = {
            type: DatabaseMessageType.RESULT,
            result: cloneableResult
          };
          postMessage(resultMessage);
        }
        break;
      }
      case DatabaseMessageType.TERMINATE: {
        await dbWorker.terminate();
        const disconnectedMessage: DatabaseDisconnectedMessage = {
          type: DatabaseMessageType.DISCONNECTED
        };
        postMessage(disconnectedMessage);
        break;
      }
      default:
        postMessage({ type: "error", error: "Unsupported message type" });
        break;
    }
  };
})().catch((error) => {
  console.error("Error initializing DB Worker:", error);
});

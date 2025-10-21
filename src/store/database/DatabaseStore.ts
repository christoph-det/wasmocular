import {
  DatabaseMessageType,
  DatabaseWorkerMessage,
  DatabaseQueryMessage
} from "../../workers/dbWorker.types";

export class DatabaseStore {
  worker: Worker | null = null;
  private pendingQueries = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    }
  >();
  private requestCounter = 0;

  constructor() {
    this.init();
    console.log("DatabaseStore initialized");
  }

  receiveIndexerResults(identifier: string, resultBuffer: Uint8Array) {
    if (!this.worker) return;
    const indexingResultMessage: DatabaseWorkerMessage = {
      type: DatabaseMessageType.INDEXER_RESULT,
      identifier,
      buffer: resultBuffer
    };
    this.worker.postMessage(indexingResultMessage, [resultBuffer.buffer]);
  }

  runQuery(sql: string, returnResult: boolean = true): Promise<unknown> {
    if (!this.worker) {
      const error = new Error("Database worker not initialized");
      console.error(error.message);
      return Promise.reject(error);
    }
    const requestId = returnResult ? this.nextRequestId() : undefined;

    const queryMessage: DatabaseQueryMessage = {
      type: DatabaseMessageType.QUERY,
      sql,
      returnResult,
      requestId
    };

    if (!returnResult) {
      this.worker.postMessage(queryMessage);
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      if (!requestId) {
        reject(new Error("Failed to create request identifier for query"));
        return;
      }
      this.pendingQueries.set(requestId, { resolve, reject });
      this.worker?.postMessage(queryMessage);
    });
  }


  init() {
    // Use new URL for correct worker path resolution
    this.worker = new Worker(
      new URL("../../workers/dbWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.worker.onmessage = (event: MessageEvent<DatabaseWorkerMessage>) => {
      const receivedMessage = event.data;
      // handle db query result
      if (receivedMessage.type === DatabaseMessageType.RESULT) {
        const { requestId, result } = receivedMessage;
        const pending = this.pendingQueries.get(requestId);
        if (pending) {
          pending.resolve(result);
          this.pendingQueries.delete(requestId);
        } else {
          console.warn(
            "DuckDB Worker Result without pending query:",
            receivedMessage
          );
        }
      } else if (receivedMessage.type === DatabaseMessageType.ERROR) {
        const { requestId, error } = receivedMessage;
        if (requestId) {
          const pending = this.pendingQueries.get(requestId);
          if (pending) {
            pending.reject(new Error(error));
            this.pendingQueries.delete(requestId);
          } else {
            console.error(
              "DuckDB Worker Error without pending query:",
              receivedMessage
            );
          }
        } else {
          console.error("DuckDB Worker Error:", error);
        }
      } else if (receivedMessage.type === DatabaseMessageType.DISCONNECTED) {
        console.log("DuckDB Worker Terminated");
        this.rejectAllPending(
          new Error("Database worker disconnected before completing query.")
        );
      } else {
        console.warn("DuckDB Store Unknown Message:", receivedMessage);
      }
    };
  }

  postMessage(message: DatabaseWorkerMessage) {
    if (this.worker) {
      this.worker.postMessage(message);
    } else {
      console.error("Worker not initialized");
    }
  }

  private nextRequestId() {
    this.requestCounter += 1;
    return `db-query-${Date.now()}-${this.requestCounter}`;
  }

  private rejectAllPending(reason: Error) {
    this.pendingQueries.forEach(({ reject }) => reject(reason));
    this.pendingQueries.clear();
  }
}

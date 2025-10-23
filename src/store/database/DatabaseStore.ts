import {
  DatabaseWorkerInboundMessage,
  DatabaseWorkerOutboundMessage
} from "../../workers/dbWorker.types";

export class DatabaseStore {
  worker: Worker | null = null;
  private readonly pendingQueries = new Map<
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
    const indexingResultMessage: DatabaseWorkerInboundMessage = {
      type: "INDEXER_RESULT",
      identifier,
      buffer: resultBuffer
    };
    this.postMessage(indexingResultMessage, [resultBuffer.buffer]);
  }

  runQuery(sql: string, returnResult: boolean = true): Promise<unknown> {
    const requestId = returnResult ? this.nextRequestId() : undefined;

    const queryMessage: DatabaseWorkerInboundMessage = {
      type: "QUERY",
      sql,
      returnResult,
      requestId
    };

    if (!returnResult) {
      this.postMessage(queryMessage);
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      if (!requestId) {
        reject(new Error("Failed to create request identifier for query"));
        return;
      }
      this.pendingQueries.set(requestId, { resolve, reject });
      this.postMessage(queryMessage);
    });
  }


  init() {
    // Use new URL for correct worker path resolution
    this.worker = new Worker(
      new URL("../../workers/dbWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.worker.onmessage = (
      event: MessageEvent<DatabaseWorkerOutboundMessage>
    ) => {
      const receivedMessage = event.data;
      // handle db query result
      if (receivedMessage.type === "RESULT") {
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
      } else if (receivedMessage.type === "ERROR") {
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
      } else if (receivedMessage.type === "DISCONNECTED") {
        console.log("DuckDB Worker Terminated");
        this.rejectAllPending(
          new Error("Database worker disconnected before completing query.")
        );
      } else {
        console.warn("DuckDB Store Unknown Message:", receivedMessage);
      }
    };
  }

  private postMessage(message: DatabaseWorkerInboundMessage, transfer?: Transferable[]): Promise<unknown> {
    if (this.worker) {
      if (transfer) {
        this.worker.postMessage(message, transfer);
      } else {
        this.worker.postMessage(message);
      }
      return Promise.resolve();
    } else {
      const error = new Error("Database worker not initialized");
      console.error(error.message);
      return Promise.reject(error);
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

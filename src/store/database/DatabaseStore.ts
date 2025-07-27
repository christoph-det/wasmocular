import {
  DatabaseMessageType,
  DatabaseWorkerMessage
} from "../../workers/dbWorker.types";

export class DatabaseStore {
  worker: Worker | null = null;

  constructor() {
    this.init();
    console.log("DatabaseStore initialized");
  }

  init() {
    // Use new URL for correct worker path resolution
    this.worker = new Worker(
      new URL("../workers/dbWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.worker.onmessage = (event: MessageEvent<DatabaseWorkerMessage>) => {
      const receivedMessage = event.data;
      // handle db query result
      if (receivedMessage.type === DatabaseMessageType.RESULT) {
        console.log("DuckDB Worker Result:", receivedMessage.result);
      } else if (receivedMessage.type === DatabaseMessageType.ERROR) {
        console.error("DuckDB Worker Error:", receivedMessage.error);
      } else if (receivedMessage.type === DatabaseMessageType.DISCONNECTED) {
        console.log("DuckDB Worker Terminated");
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
}

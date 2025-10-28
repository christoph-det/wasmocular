import { WasmGixWorkerOutboundMessage } from "../../workers/wasmGixWorker.types";
import { RootStore } from "../RootStore";

export class WasmGixStore {
  worker: Worker | null = null;
  private readonly rootStore: RootStore;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    this.init();
    console.log("WasmGixStore initialized");
  }

  init() {
    this.worker = new Worker(
      new URL("../../workers/wasmGixWorker.ts", import.meta.url),
      {
        type: "module"
      }
    );

    this.worker.onmessage = (
      event: MessageEvent<WasmGixWorkerOutboundMessage>
    ) => {
      const receivedMessage = event.data;
      switch (receivedMessage.type) {
        case "INDEXING_COMPLETED": {
          this.rootStore.dbStore.receiveIndexerResults(
            receivedMessage.identifier,
            receivedMessage.buffer
          );
          break;
        }
        default:
          console.warn(
            "WasmGixStore: Unknown message from worker",
            receivedMessage
          );
      }
    };
  }

  reloadRepository(identifier: string) {
    if (!this.worker) {
      console.error("WasmGix worker not initialized");
      return;
    }

    this.worker.postMessage({
      type: "RELOAD_REPOSITORY",
      identifier
    });
  }

  loadRepository(
    identifier: string,
    localFileHandle: FileSystemDirectoryHandle
  ) {
    if (!this.worker) {
      console.error("WasmGix worker not initialized");
      return;
    }

    this.worker.postMessage({
      type: "LOAD_REPOSITORY",
      identifier,
      localFileHandle
    });
  }

  copyClonedRepository(identifier: string) {
    if (!this.worker) {
      console.error("WasmGix worker not initialized");
      return;
    }

    this.worker.postMessage({
      type: "COPY_CLONED_REPOSITORY",
      identifier
    });
  }

  startIndexing(identifier: string) {
    if (!this.worker) {
      console.error("WasmGix worker not initialized");
      return;
    }

    this.worker.postMessage({
      type: "START_INDEXING",
      identifier
    });
  }

  postMessage(message: any) {
    if (!this.worker) {
      console.error("WasmGit worker not initialized");
      return;
    }
    this.worker.postMessage(message);
  }
}

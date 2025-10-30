import { WasmGixWorkerOutboundMessage } from "../../workers/wasmGixWorker.types";
import { RootStore } from "../RootStore";
import { proxy, Remote, wrap } from "comlink";
import { WasmGixWorker } from "@/workers/wasmGixWorker";

export class WasmGixStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<WasmGixWorker> | null = null;
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
    this.rpcWorker = wrap(this.worker);
  }

  reloadRepository(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    this.rpcWorker.remountRepository(identifier);
  }

  loadRepository(
    identifier: string,
    localFileHandle: FileSystemDirectoryHandle
  ) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    this.rpcWorker.mountRepository(identifier, localFileHandle);
  }

  startIndexing(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    this.rpcWorker.startIndexing(identifier).then((buffer) => {
      if (buffer) {
        this.rootStore.dbStore.receiveIndexerResults(identifier, buffer);
      }
    }).catch((error) => {
      console.error("Indexing failed:", error);
    });
  }
}

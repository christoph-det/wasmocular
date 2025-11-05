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

  async reloadRepository(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    await this.rpcWorker.remountRepository(identifier);
  }

  async loadRepository(
    identifier: string,
    localFileHandle: FileSystemDirectoryHandle,
    progressCallback: (progress: number, message: string) => void
  ) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    const progressProxy = proxy(progressCallback);
    await this.rpcWorker.mountRepository(
      identifier,
      localFileHandle,
      progressProxy
    );
  }

  async startIndexing(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    try {
      const buffer = await this.rpcWorker.startIndexing(identifier);
      await this.rootStore.dbStore.receiveIndexerResults(identifier, buffer!);
    } catch (error) {
      console.error("Error starting indexing:", error);
      return;
    }
  }
}

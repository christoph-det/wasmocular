import { RootStore } from "./RootStore";
import { proxy, Remote, wrap } from "comlink";
import WasmGixWorkerFactory from "@/workers/wasmgixWorker?worker";
import type { WasmGixWorker } from "@/workers/wasmgixWorker";

/**
 * This store handles the lifecycle of a Git repository Worker that performs loading indexing
 * operations.
 */
export class WasmGixStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<WasmGixWorker> | null = null;
  private readonly rootStore: RootStore;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    this.init();
    console.log("WasmGixStore initialized");
  }

  private init() {
    this.worker = new WasmGixWorkerFactory();
    this.rpcWorker = wrap(this.worker);
  }

  reset() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.init();
  }

  /**
   *  Loads the repository data from the storage and remounts it in the worker.
   */
  async reloadRepository(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    await this.rpcWorker.remountRepository(identifier);
  }

  /**
   * Loads a repository into the worker from the given local (outside of browser) file handle.
   */
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

  /**
   * Deletes all stored data for the given repository identifier from the worker and storage.
   */
  async deleteRepositroyData(identifier: string) {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    await this.rpcWorker.deleteRepositoryData(identifier);
  }

  /**
   * Starts the indexing process for the given repository identifier in the worker.
   */
  async startIndexing(
    identifier: string,
    progressCallback: (progress: number, message: string) => void,
    lastIndexedSha?: string
  ): Promise<string | undefined> {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      return;
    }
    try {
      const progressProxy = proxy(progressCallback);
      const result = await this.rpcWorker.startIndexing(
        identifier,
        progressProxy,
        lastIndexedSha
      );
      if (!result) {
        throw new Error("Indexing failed: no result returned");
      }
      await this.rootStore.dbStore.receiveIndexerResults(
        identifier,
        result.buffer
      );
      progressCallback(100, "Indexing completed successfully.");
      return result.latestSha;
    } catch (error) {
      console.error("Error starting indexing:", error);
      return;
    }
  }
}

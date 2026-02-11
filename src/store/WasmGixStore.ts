import { RootStore } from "./RootStore";
import { proxy, Remote, wrap } from "comlink";
import WasmGixWorkerFactory from "@/workers/wasmgixWorker?worker";
import type { WasmGixWorker } from "@/workers/wasmgixWorker";

type UserAgentMemoryPerformance = Performance & {
  measureUserAgentSpecificMemory: () => Promise<unknown>;
};

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
    const startTimeReload = performance.now();
    await this.rpcWorker.remountRepository(identifier);
    const duration = ((performance.now() - startTimeReload) / 1000).toFixed(2);
    console.log(
      `[wasmgix] Repository remount finished for ${identifier} in ${duration}s`
    );
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
    const startTimeLoad = performance.now();
    const progressProxy = proxy(progressCallback);
    await this.rpcWorker.mountRepository(
      identifier,
      localFileHandle,
      progressProxy
    );
    const duration = ((performance.now() - startTimeLoad) / 1000).toFixed(2);
    progressCallback(100, `Repository loaded with wasmgix in ${duration}s.`);
    console.log(
      `[wasmgix] Repository load finished for ${identifier} in ${duration}s`
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
  ): Promise<string> {
    if (!this.rpcWorker) {
      console.error("WasmGix worker not initialized");
      throw new Error("WasmGix worker not initialized");
    }
    try {
      const startTime = performance.now();
      const progressProxy = proxy(progressCallback);
      const result = await this.rpcWorker.startIndexing(
        identifier,
        progressProxy,
        lastIndexedSha
      );
      if (!result) {
        throw new Error("Indexing failed: no result returned");
      }
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      await this.rootStore.dbStore.receiveIndexerResults(
        identifier,
        result.buffer
      );
      const dbInsertionTime = ((performance.now() - endTime) / 1000).toFixed(2);

      // memory measurement
      if (
        crossOriginIsolated &&
        "measureUserAgentSpecificMemory" in performance &&
        typeof performance.measureUserAgentSpecificMemory === "function"
      ) {
        const memoryPerformance = performance as UserAgentMemoryPerformance;
        // dispatched with then, because takes time to complete (needs to run garbage collection), note also it might return inaccurate data if GC ran already before
        memoryPerformance
          .measureUserAgentSpecificMemory()
          .then((measurement: unknown) => {
            console.log(`Memory measurement details:`, measurement);
          })
          .catch((error: unknown) => {
            console.error("Memory measurement failed: ", error);
          });
      }

      progressCallback(
        100,
        `Indexing completed successfully in ${duration}s. Database insertion took ${dbInsertionTime}s.`
      );
      return result.latestSha;
    } catch (error) {
      console.error("Error starting indexing:", error);
      throw error;
    }
  }
}

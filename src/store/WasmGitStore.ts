import WasmGitWorkerFactory from "@/workers/wasmgitWorker?worker";
import type { WasmGitWorker } from "@/workers/wasmgitWorker";
import { proxy, Remote, wrap } from "comlink";

/**
 * This store handles the lifecycle of a Git repository Worker that performs remote cloning operations.
 */
export class WasmGitStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<WasmGitWorker> | null = null;

  constructor() {
    this.init();
    console.log("WasmGitStore initialized");
  }

  private init() {
    this.worker = new WasmGitWorkerFactory();
    this.rpcWorker = wrap(this.worker);
  }

  reset() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.init();
  }

  /**
   * Clones a Git repository using the WasmGit worker. We use a proxy to avoid CORS issues.
   */
  cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    proxyUrl: string,
    progressCallback: (progress: number, message: string) => void
  ): Promise<void> {
    if (!this.rpcWorker) {
      throw new Error("WasmGitStore not initialized");
    }
    const startTimeClone = performance.now();
    const progressProxy = proxy(progressCallback);
    return this.rpcWorker
      .cloneRepository(gitRepoURL, repoIdentifier, proxyUrl, progressProxy)
      .then(() => {
        const duration = ((performance.now() - startTimeClone) / 1000).toFixed(2);
        progressCallback(100, `Repository cloned with wasm-git in ${duration}s.`);
        console.log(
          `[wasm-git] Repository clone finished for ${repoIdentifier} in ${duration}s`
        );
      });
  }
}

import WasmGitWorkerFactory from "@/workers/wasmgitWorker?worker";
import type { WasmGitWorker } from "@/workers/wasmgitWorker";
import { proxy, Remote, wrap } from "comlink";

export class WasmGitStore {
  private worker: Worker | null = null;
  private rpcWorker: Remote<WasmGitWorker> | null = null;

  constructor() {
    this.init();
    console.log("WasmGitStore initialized");
  }

  init() {
    this.worker = new WasmGitWorkerFactory();
    this.rpcWorker = wrap(this.worker);
  }

  cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    proxyUrl: string,
    progressCallback: (progress: number, message: string) => void
  ): Promise<void> {
    if (!this.rpcWorker) {
      throw new Error("WasmGitStore not initialized");
    }
    const progressProxy = proxy(progressCallback);
    return this.rpcWorker.cloneRepository(
      gitRepoURL,
      repoIdentifier,
      proxyUrl,
      progressProxy
    );
  }
}

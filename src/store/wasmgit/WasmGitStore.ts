import { proxy, wrap } from "comlink";

export class WasmGitStore {
  worker: Worker | null = null;
  rpcWorker: any = null;

  constructor() {
    this.init();
    console.log("WasmGitStore initialized");
  }

  init() {
    this.worker = new Worker(
      new URL("../../workers/wasmgitWorker.ts", import.meta.url),
      {
        type: "module"
      }
    );

    this.rpcWorker = wrap(this.worker);
  }

  cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    progressCallback: (progress: number, message: string) => void
  ): Promise<void> {
    const progressProxy = proxy(progressCallback);
    return this.rpcWorker.cloneRepository(
      gitRepoURL,
      repoIdentifier,
      progressProxy
    );
  }
}

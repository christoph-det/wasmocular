export class WasmGitStore {
  worker: Worker | null = null;

  constructor() {
    this.init();
    console.log("WasmGitStore initialized");
  }

  init() {
    this.worker = new Worker(new URL("../../workers/wasmgitWorker.ts", import.meta.url), {
      type: "module"
    });

    this.worker.onmessage = (event: MessageEvent) => {
      console.log("Message from wasmGitWorker:", event.data);
    };
  }

  postMessage(message: any) {
    if (!this.worker) {
      console.error("WasmGit worker not initialized");
      return;
    }
    this.worker.postMessage(message);
  }

  cloneRepository(gitRepoURL: string) {
    this.postMessage({ action: "cloneRepository", gitRepoURL });
  }

  reloadRepo(gitRepoURL: string) {
    this.postMessage({ action: "reloadRepo", gitRepoURL });
  }

  countCommits() {
    this.postMessage({ action: "countCommits" });
  }
}


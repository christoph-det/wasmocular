export class WasmGixStore {
  worker: Worker | null = null;

  constructor() {
    this.init();
    console.log("WasmGixStore initialized");
  }

  init() {
    this.worker = new Worker(new URL("../../workers/wasmgixWorker.ts", import.meta.url), {
      type: "module"
    });

    this.worker.onmessage = (event: MessageEvent) => {
      console.log("Message from wasmGixWorker:", event.data);
    };
  }

  postMessage(message: any) {
    if (!this.worker) {
      console.error("WasmGit worker not initialized");
      return;
    }
    this.worker.postMessage(message);
  }
  parseOid(hex: string) {
    if (!this.worker) {
      console.error("WasmGix worker not initialized");
      return;
    } else {
      this.worker.postMessage({ hex });
      this.worker.onmessage = (event: MessageEvent) => {
        console.log("Parsed OID from wasmGixWorker:", event.data);
      };
    }
}

}
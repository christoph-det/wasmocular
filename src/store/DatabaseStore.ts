export class DatabaseStore {
    worker: Worker | null = null;

    init() {
        // Use new URL for correct worker path resolution
        this.worker = new Worker(
            new URL("../workers/dbWorker.worker.ts", import.meta.url),
            { type: "module" }
        );
        this.worker.onmessage = (event: MessageEvent) => {
            // handle db query result
            if (event.data.type === "result") {
                console.log("DuckDB Worker Result:", event.data.result);
            } else if (event.data.type === "error") {
                console.error("DuckDB Worker Error:", event.data.error);
            }
        };
    }

    postMessage(message: any) {
        if (this.worker) {
            this.worker.postMessage(message);
        } else {
            console.error("Worker not initialized");
        }
    }
}
import { describe, vi, test, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";

// workound for importing the was file via url
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(
  __dirname,
  "../../node_modules/wasm-git/lg2.wasm"
);

vi.mock("wasm-git/lg2.wasm?url", () => ({
  default: wasmPath
}));

vi.mock("comlink", () => ({
  expose: vi.fn()
}));

const { WasmGitWorker } = await import("../../src/workers/wasmgitWorker.ts");

const wasmGitWorker = new WasmGitWorker();

describe("wasm-git Worker Tests", () => {
  test("can clone a repository", async () => {
    const proxyURL = "https://dawn-salad-f180.c-dethloff.workers.dev";

    // mock syncfs because FS does not work in the test environment
    // @ts-expect-error - accessing private property for testing
    const originalInit = wasmGitWorker.init.bind(wasmGitWorker);
    // @ts-expect-error - accessing private property for testing
    wasmGitWorker.init = async () => {
      await originalInit();
      // @ts-expect-error - accessing private property for testing
      wasmGitWorker.FS.syncfs = vi.fn((callback) => callback(null));
    };

    const progressLogs: string[] = [];

    await wasmGitWorker.cloneRepository(
      "https://github.com/christoph-det/test-repo-wasmocular",
      "test-repo",
      proxyURL,
      (progress, message) => {
        console.log(`Progress: ${progress}% - ${message}`);
        progressLogs.push(`${progress}% - ${message}`);
      }
    );
    const combinedLogs = progressLogs.join("");
    expect(combinedLogs).toContain("Counting");
    expect(combinedLogs).toContain("Compressing");
    expect(combinedLogs).toContain("Downloading");
    expect(combinedLogs).toContain("Resolving");
  });
});

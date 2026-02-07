import { mock } from "fsa-mock";
import { describe, vi, test, expect, beforeEach } from "vitest";

vi.mock("comlink", () => ({
  expose: vi.fn()
}));

vi.mock("../../src/workers/wasm-gix-library/wasm_gix.js", () => {
  return {
    default: vi.fn().mockResolvedValue({
      // Mocking ccall with logic for the indexer
      ccall: vi.fn((name, returnType, argTypes, args) => {
        if (name === "gitoxide_run_git_indexer") {
          return JSON.stringify({
            status: "success",
            new_sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
            path: "repoPath"
          });
        }

        return "";
      }),
      FS: {
        mkdir: vi.fn(),
        mount: vi.fn(),
        syncfs: vi
          .fn()
          .mockImplementation((populate, callback) => callback(null)),
        writeFile: vi.fn(),
        stat: vi.fn(() => ({ mode: 0 })),
        isDir: vi.fn(() => false),
        readdir: vi.fn(() => []),
        rmdir: vi.fn(),
        unlink: vi.fn(),
        readFile: vi.fn(() => new Uint8Array())
      },
      IDBFS: {},
      cwrap: vi.fn()
    })
  };
});

const exampleRepoPath = "minimal-repo";

const { WasmGixWorker } = await import("../../src/workers/wasmgixWorker.ts");

describe("wasm-gix Worker Tests", () => {
  let wasmGixWorker: InstanceType<typeof WasmGixWorker>;
  let repoHandle: FileSystemDirectoryHandle;

  beforeEach(async () => {
    vi.clearAllMocks();
    wasmGixWorker = new WasmGixWorker();
    mock.install();
    mock.makeDir(exampleRepoPath + "/.git");
    mock.createFile(
      exampleRepoPath + "/.git/HEAD",
      new TextEncoder().encode("ref: refs/heads/main\n")
    );
    mock.onDirectoryPicker(() => exampleRepoPath);
    repoHandle = await showDirectoryPicker();
  });

  test("delete does not error for unknown repo and syncs fs", async () => {
    await wasmGixWorker.deleteRepositoryData("test-repo");
    // @ts-ignore - accessing private method for testing
    expect(wasmGixWorker.gitoxide.FS.syncfs).toHaveBeenCalled();
  });

  test("mountRepository successfully mounts sucessfully in worker", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const mountingResponse = await wasmGixWorker.mountRepository(
      "test-repo",
      repoHandle as FileSystemDirectoryHandle,
      () => {}
    );

    expect(mountingResponse).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[gitoxide] Mounted repository at /repos/test-repo with 1 files."
      )
    );
    consoleSpy.mockRestore();
  });

  test("mountRepository successfully remounts sucessfully in worker", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const mountingResponse = await wasmGixWorker.remountRepository("test-repo");

    expect(mountingResponse).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Repository remounted at /repos/test-repo")
    );
    consoleSpy.mockRestore();
  });

  test("can start indexing process, which fails due to incomplete git repo", async () => {
    const errorMessages: string[] = [];
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation((message) => errorMessages.push(message.toString()));

    const progressUpdates: string[] = [];
    // @ts-expect-error - accessing private method for testing
    wasmGixWorker.gitoxideLogListener = (message: string) =>
      progressUpdates.push(message);

    await wasmGixWorker.mountRepository(
      "test-repo",
      repoHandle as FileSystemDirectoryHandle,
      (progress, message) => progressUpdates.push(progress + " - " + message)
    );

    await wasmGixWorker.startIndexing("test-repo", (progress, message) =>
      progressUpdates.push(progress + " - " + message)
    );

    const joinedMessages = progressUpdates.join("");

    expect(joinedMessages).toContain("99 - Finalizing repository mount");
    expect(errorMessages.join("")).toContain("Could not get HEAD SHA:");
    consoleSpy.mockRestore();
  });
});

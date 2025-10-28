/// <reference lib="webworker" />
import { generateRepoIdentifier } from "@/utils/utils.js";
import initGitoxide from "./wasm-gix-library/wasm_gix.js";
import { WasmGixWorkerMessage } from "./wasmGixWorker.types.js";

const GITOXIDE_LOG_PREFIX = "[gitoxide]";
const PERSIST_ROOT = "/repos";

// TODO: cleanup, maybe bring some methods outside of the worker
// TODO: open repo again on page reload
// TODO: handle incomplete mounts - ie delete data when page reloads during mount/index fex
// TODO: handle indexer
// TODO: handle data deletion
// TODO: progress callbacks

class WasmGixWorker {
  gitoxide: any = null;
  createdDirs = new Set<string>(["/"]);
  storedRepositories: string[] = [];

  async init() {
    this.gitoxide = await initGitoxide();
    console.log("gitoxide wasm module loaded");
    await this.setupPersistentFs();
  }

  async startIndexing(identifier: string) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    try {
      const resultFilePath = this.gitoxide.ccall(
        "gitoxide_run_git_indexer",
        "string",
        ["string"],
        [repoPath]
      );
      if (!resultFilePath || resultFilePath.startsWith("error:")) {
        throw new Error(resultFilePath);
      }
      const bytes = this.gitoxide.FS.readFile(resultFilePath, {
        encoding: "binary"
      });
      console.log(
        `${GITOXIDE_LOG_PREFIX} Indexing produced result file at ${resultFilePath} for repository at ${repoPath}.`
      );
      const buffer: Uint8Array =
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      console.log(
        `${GITOXIDE_LOG_PREFIX} Indexing completed for repository at ${repoPath}. Result sent to DB worker.`
      );
      self.postMessage(
        {
          type: "INDEXING_COMPLETED",
          identifier,
          buffer
        },
        [buffer.buffer]
      );
    } catch (error) {
      console.error(
        `${GITOXIDE_LOG_PREFIX} Indexing failed for repository at ${repoPath}:`,
        error
      );
      return;
    }
  }

  async remountRepository(identifier: string) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    await this.syncFs(true);
    console.log(`Repository remounted at ${repoPath}`);
  
  }

  async mountRepository(
    identifier: string,
    localFileHandle: FileSystemDirectoryHandle
  ) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    this.ensureDirExists(repoPath);

    const writeFile = async ({
      file,
      relativePath
    }: {
      file: File;
      relativePath: string;
    }) => {
      const destination = `${repoPath}/${relativePath}`.replace(/\\/g, "/");
      const directoryEnd = destination.lastIndexOf("/");
      if (directoryEnd > repoPath.length) {
        this.ensureDirExists(destination.slice(0, directoryEnd));
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      this.gitoxide.FS.writeFile(destination, buffer, { canOwn: true });
      return true;
    };

    const { files: gitFiles } = await this.collectGitDirectoryEntries(
      localFileHandle,
      (count: number) => {
        // TODO: Implement progress callback
      }
    );

    let writtenFiles = 0;

    for (const entry of gitFiles) {
      if (await writeFile(entry)) {
        writtenFiles += 1;
      }
    }

    await this.syncFs(false);

    const tracked = this.trackedPathsFor(repoPath);
    const trackedList = Array.from(tracked);
    let copiedTracked = 0;

    if (trackedList.length > 0) {
      const trackedFiles = await this.collectTrackedFileEntries(
        localFileHandle,
        trackedList,
        (processed, total) => {
          // TODO: Implement progress callback
        }
      );

      for (const entry of trackedFiles) {
        if (await writeFile(entry)) {
          writtenFiles += 1;
          copiedTracked += 1;
        }
      }
    }

    await this.syncFs(false);

    console.log(
      `${GITOXIDE_LOG_PREFIX} Mounted repository at ${repoPath} with ${writtenFiles} files.`
    );
  }

  async collectGitDirectoryEntries(
    localFileHandle: FileSystemDirectoryHandle,
    onProgress: any
  ) {
    let gitHandle;
    try {
      gitHandle = await localFileHandle.getDirectoryHandle(".git", {
        create: false
      });
    } catch (error) {
      throw new Error("Selected directory does not contain a .git directory.");
    }

    const files = [];
    let count = 0;
    const stack = [{ handle: gitHandle, path: ".git" }];

    while (stack.length > 0) {
      const popped = stack.pop();
      if (!popped) {
        continue;
      }
      const {
        handle,
        path
      }: {
        handle: FileSystemDirectoryHandle | undefined;
        path: string | undefined;
      } = popped;
      if (!handle) {
        continue;
      }
      for await (const entry of (handle as any).values()) {
        const nextPath = `${path}/${entry.name}`;
        if (entry.kind === "file") {
          // Avoid copying the Git index to the virtual FS. The index is large
          // and not needed for read-only history operations. Importing it
          // can cause the wasm runtime to read and hash it, triggering
          // memory pressure and out-of-bounds traps.
          if (nextPath === ".git/index") {
            continue;
          }
          try {
            const file = await entry.getFile();
            files.push({ file, relativePath: nextPath });
            count += 1;
            if (typeof onProgress === "function") {
              onProgress(count);
            }
          } catch (error) {
            console.warn("Failed to read .git entry", nextPath, error);
          }
        } else if (entry.kind === "directory") {
          stack.push({ handle: entry, path: nextPath });
        }
      }
    }

    return { files, fileCount: count };
  }

  // TODO: cleanup
  async collectTrackedFileEntries(
    localFileHandle: FileSystemDirectoryHandle,
    trackedPaths: string[],
    onProgress: (processed: number, total: number) => void
  ) {
    const entries = [];
    const directoryCache = new Map();
    directoryCache.set("", localFileHandle);

    const total = trackedPaths.length;
    let processed = 0;

    for (const rawPath of trackedPaths) {
      const relativePath = rawPath?.replace(/^[\\/]+/, "");
      if (!relativePath) {
        processed += 1;
        if (typeof onProgress === "function") {
          onProgress(processed, total);
        }
        continue;
      }

      const segments = relativePath.split("/").filter(Boolean);
      if (segments.length === 0) {
        processed += 1;
        if (typeof onProgress === "function") {
          onProgress(processed, total);
        }
        continue;
      }

      const fileName: string | undefined = segments.pop();
      const directoryPath = segments.join("/");

      try {
        const directoryHandle = await this.getDirectoryHandleCached(
          localFileHandle,
          directoryCache,
          directoryPath
        );
        if (!directoryHandle) {
          continue;
        }
        const fileHandle = await directoryHandle.getFileHandle(fileName!, {
          create: false
        });
        const file = await fileHandle.getFile();
        entries.push({ file, relativePath });
      } catch (error) {
        console.warn(`Failed to read tracked path ${relativePath}`, error);
      } finally {
        processed += 1;
        if (typeof onProgress === "function") {
          onProgress(processed, total);
        }
      }
    }

    return entries;
  }

  async getDirectoryHandleCached(
    localDirectoryHandle: FileSystemDirectoryHandle,
    cache: Map<string, FileSystemDirectoryHandle | null>,
    path: string
  ) {
    if (!path) {
      return localDirectoryHandle;
    }
    if (cache.has(path)) {
      return cache.get(path);
    }

    const segments = path.split("/").filter(Boolean);
    let currentHandle = localDirectoryHandle;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (cache.has(currentPath)) {
        const cachedHandle = cache.get(currentPath);
        if (!cachedHandle) {
          cache.set(path, null);
          return null;
        }
        currentHandle = cachedHandle;
        continue;
      }

      try {
        currentHandle = await currentHandle.getDirectoryHandle(segment, {
          create: false
        });
      } catch (error) {
        console.warn(`Failed to access directory ${currentPath}`, error);
        cache.set(currentPath, null);
        cache.set(path, null);
        return null;
      }

      cache.set(currentPath, currentHandle);
    }

    cache.set(path, currentHandle);
    return currentHandle;
  }

  ensureDirExists(path: string) {
    const parts = path.split("/").filter((part) => part.length > 0);
    let currentPath = "";
    for (const part of parts) {
      currentPath += `/${part}`;
      if (!this.createdDirs.has(currentPath)) {
        try {
          this.gitoxide.FS.mkdir(currentPath);
          this.createdDirs.add(currentPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            console.error(`Error creating directory ${currentPath}:`, error);
          }
        }
      }
    }
  }

  async setupPersistentFs() {
    try {
      this.gitoxide.FS.mkdir(PERSIST_ROOT);
    } catch (error) {
      console.error("Error creating PERSIST_ROOT:", error);
    }

    try {
      this.gitoxide.FS.mount(this.gitoxide.IDBFS, {}, PERSIST_ROOT);
    } catch (error) {
      console.error("Error mounting IDBFS:", error);
    }

    await this.syncFs(true);
    this.createdDirs.add(PERSIST_ROOT);
    //persistentReady = true;
    await this.refreshStoredRepos();
  }

  async syncFs(populate: boolean) {
    return new Promise((resolve, reject) => {
      this.gitoxide.FS.syncfs(populate, (error: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log("IDBFS sync complete");
          resolve(null);
        }
      });
    }).catch((error) => {
      console.error("IDBFS sync failed:", error);
    });
  }

  async refreshStoredRepos() {
    let repos: string[] = [];
    try {
      repos = this.gitoxide.FS.readdir(PERSIST_ROOT)
        .filter((name: string) => name !== "." && name !== "..")
        .sort((a: string, b: string) => a.localeCompare(b));
    } catch (error) {
      console.warn("Failed to enumerate stored repositories", error);
    }
    this.storedRepositories = repos;
  }

  trackedPathsFor(repositoryPath: string): Set<string> {
    const tracked = new Set<string>();

    try {
      const trackedList = this.gitoxide.ccall(
        "gitoxide_tracked_paths",
        "string",
        ["string"],
        [repositoryPath]
      );
      if (trackedList && !trackedList.startsWith("error:")) {
        trackedList
          .split("\n")
          .map((path: string) => path.trim())
          .filter(Boolean)
          .forEach((path: string) => tracked.add(path));
      } else if (trackedList?.startsWith("error:")) {
        console.warn(trackedList);
      }
    } catch (error) {
      console.warn("Could not determine tracked paths", error);
    }

    return tracked;
  }

  
}

onmessage = () => {
  console.log("wasmGixWorker: Received message but not initialized yet!");
};

const wasmGixWorker = new WasmGixWorker();

(async function () {
  await wasmGixWorker.init();

  onmessage = async function (event: MessageEvent<WasmGixWorkerMessage>) {
    const receivedMessage: WasmGixWorkerMessage = event.data;

    switch (receivedMessage.type) {
      case "LOAD_REPOSITORY": {
        console.log("Loading repository:", receivedMessage.identifier);
        await wasmGixWorker.mountRepository(
          receivedMessage.identifier,
          receivedMessage.localFileHandle
        );
        break;
      }
      case "RELOAD_REPOSITORY": {
        console.log("Reloading repository:", receivedMessage.identifier);
        // For now, re-mounting is the same as mounting
        //wasmGixWorker.remountRepository(receivedMessage.identifier);
        break;
      } 
      case "START_INDEXING": {
        console.log(
          "Starting indexing for repository:",
          receivedMessage.identifier
        );
        wasmGixWorker.startIndexing(receivedMessage.identifier);
        break;
      }
      default:
        console.warn("wasmGixWorker: Unknown message type:", receivedMessage);
    }

    //
  };
})();

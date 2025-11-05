import initGitoxide, {
  type GitoxideModule
} from "./wasm-gix-library/wasm_gix.js";
import * as Comlink from "comlink";

const GITOXIDE_LOG_PREFIX = "[gitoxide]";
const PERSIST_ROOT = "/repos";

// TODO: cleanup, maybe bring some methods outside of the worker
// TODO: open repo again on page reload
// TODO: handle incomplete mounts - ie delete data when page reloads during mount/index fex
// TODO: handle indexer
// TODO: handle data deletion
// TODO: progress callbacks

export class WasmGixWorker {
  gitoxide!: GitoxideModule;
  createdDirs: Set<string> = new Set<string>(["/"]);
  storedRepositories: string[] = [];
  private gitoxideLogListener?: (message: string) => void;

  async init() {
    this.gitoxide = await initGitoxide({
      print: (text: string) => this.forwardGitoxideLog(text, false),
      printErr: (text: string) => this.forwardGitoxideLog(text, true)
    });
    console.log("gitoxide wasm module loaded");
    await this.setupPersistentFs();
  }

  private forwardGitoxideLog(message: string, isError: boolean) {
    if (message.startsWith(GITOXIDE_LOG_PREFIX)) {
      const trimmed = message.slice(GITOXIDE_LOG_PREFIX.length).trim();
      if (this.gitoxideLogListener) {
        this.gitoxideLogListener(trimmed);
      } else if (trimmed.length > 0) {
        (isError ? console.error : console.log)(trimmed);
      }
      return;
    }
    (isError ? console.error : console.log)(message);
  }

  async startIndexing(
    identifier: string,
    progressCallback: (progress: number, message: string) => void
  ): Promise<Uint8Array | undefined> {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;

    await this.syncFs(true);

    // TODO: catch log messages from gitoxide and forward them via the progressCallback
    progressCallback(1, "Starting indexing process...");

    let commitCount = 0;
    let timestampLastEstimateUpdate = Date.now();
    let lastIndexedCommitCountForEstimate = 0;
    let currentEstimatedTimeLeft = "...";
    const estimateHistoryMs: number[] = [];
    const MAX_ESTIMATE_HISTORY = 8;

    this.gitoxideLogListener = (message: string) => {
      let currentlyIndexedCommits = 0;
      if (message.startsWith("Commit count: ")) {
        commitCount = parseInt(message.slice("Commit count: ".length - 1));
        lastIndexedCommitCountForEstimate = 0;
        timestampLastEstimateUpdate = Date.now();
      }
      if (message.startsWith("Indexed commits:")) {
        currentlyIndexedCommits = parseInt(
          message.slice("Indexed commits: ".length - 1)
        );
        const commitsSinceLastEstimate =
          currentlyIndexedCommits - lastIndexedCommitCountForEstimate;
        const remainingCommits = Math.max(
          0,
          commitCount - currentlyIndexedCommits
        );
        const commitsPerMs =
          commitsSinceLastEstimate / (Date.now() - timestampLastEstimateUpdate);
        const remainingMs = remainingCommits / commitsPerMs;
        estimateHistoryMs.push(remainingMs);
        if (estimateHistoryMs.length > MAX_ESTIMATE_HISTORY) {
          estimateHistoryMs.shift();
        }
        const averageRemainingMs =
          estimateHistoryMs.reduce((sum, value) => sum + value, 0) /
          estimateHistoryMs.length;
        currentEstimatedTimeLeft = Math.max(
          0,
          Math.round(averageRemainingMs / 1000)
        ).toString();
        timestampLastEstimateUpdate = Date.now();
        lastIndexedCommitCountForEstimate = currentlyIndexedCommits;
      }
      const progress =
        commitCount > 0
          ? Math.floor((currentlyIndexedCommits / commitCount) * 98) + 1
          : 1;
      const progressMessage = `Indexing commits: ${currentlyIndexedCommits} of ${commitCount}. Estimated ${currentEstimatedTimeLeft} seconds remaining.`;
      progressCallback(progress, progressMessage);
    };

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
      const buffer: Uint8Array =
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      progressCallback(
        99,
        "Indexing process completed. Inserting data into database..."
      );
      return buffer;
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
    localFileHandle: FileSystemDirectoryHandle,
    progressCallback: (progress: number, message: string) => void
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
        progressCallback(
          5,
          `Preparing to mount repository: processed ${count} .git entries...`
        );
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
          progressCallback(
            5 + Math.floor((processed / total) * 50),
            `Mounting repository: enumerating ${processed} of ${total} tracked files...`
          );
        }
      );

      for (const entry of trackedFiles) {
        if (await writeFile(entry)) {
          writtenFiles += 1;
          copiedTracked += 1;
          progressCallback(
            55 + Math.floor((copiedTracked / trackedList.length) * 45),
            `Copy repository: copied ${copiedTracked} of ${trackedList.length} tracked files...`
          );
        }
      }
    }

    progressCallback(
      99,
      "Finalizing repository mount, syncronizing file system..."
    );

    await this.syncFs(false);

    console.log(
      `${GITOXIDE_LOG_PREFIX} Mounted repository at ${repoPath} with ${writtenFiles} files.`
    );
  }

  async collectGitDirectoryEntries(
    localFileHandle: FileSystemDirectoryHandle,
    onProgress: (number: number) => void
  ) {
    let gitHandle;
    try {
      gitHandle = await localFileHandle.getDirectoryHandle(".git", {
        create: false
      });
    } catch (error: unknown) {
      throw new Error(
        "Selected directory does not contain a .git directory." +
          (error instanceof Error ? error.message : "")
      );
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
        handle: FileSystemDirectoryHandle;
        path: string;
      } = popped;
      if (!handle) {
        continue;
      }
      for await (const entry of handle.values()) {
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
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            files.push({ file, relativePath: nextPath });
            count += 1;
            if (typeof onProgress === "function") {
              onProgress(count);
            }
          } catch (error) {
            console.warn("Failed to read .git entry", nextPath, error);
          }
        } else if (entry.kind === "directory") {
          stack.push({
            handle: entry as FileSystemDirectoryHandle,
            path: nextPath
          });
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
    const directoryCache = new Map<string, FileSystemDirectoryHandle | null>();
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
    this.refreshStoredRepos();
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

  refreshStoredRepos() {
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
      const trackedList: string | undefined = this.gitoxide.ccall(
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

const wasmGixWorker = new WasmGixWorker();
await wasmGixWorker.init();
Comlink.expose(wasmGixWorker);

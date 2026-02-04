import initGitoxide, {
  type GitoxideModule
} from "./wasm-gix-library/wasm_gix.js";
import * as Comlink from "comlink";

const GITOXIDE_LOG_PREFIX = "[gitoxide]";
// path in the virtual FS
const PERSIST_ROOT = "/repos";

/**
 * WasmGixWorker provides methods to interact with git repositories using the gitoxide module.
 */
export class WasmGixWorker {
  private gitoxide!: GitoxideModule;
  private createdDirs: Set<string> = new Set<string>(["/"]);
  // route log messages from gitoxide to the UI
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
    // logs without prefix to console
    (isError ? console.error : console.log)(message);
  }

  /**
   * Deletes all data associated with a repository from the virtual emscripten file system.
   */
  async deleteRepositoryData(identifier: string) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    try {
      this.removePathRecursive(repoPath);
      await this.syncFs(false);
    } catch (error) {
      console.error(
        `${GITOXIDE_LOG_PREFIX} Failed to delete repository data at ${repoPath}:`,
        error
      );
    }
  }

  /**
   * Indexes the repository at the given identifier, providing progress updates via the callback. If a lastIndexedSha is provided, indexing only goes until that commit.
   * @returns a buffer containing the indexed repository data and the latest commit SHA for storing in the database, or undefined if indexing failed.
   */
  async startIndexing(
    identifier: string,
    progressCallback: (progress: number, message: string) => void,
    lastIndexedSha?: string
  ): Promise<{ buffer: Uint8Array; latestSha: string } | undefined> {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;

    progressCallback(1, "Starting indexing process...");
    // loading the repository from IndexedDB into the in-memory FS
    await this.syncFs(true);

    let commitCount = 0;
    let timestampLastEstimateUpdate = Date.now();
    let lastIndexedCommitCountForEstimate = 0;
    let currentEstimatedTimeLeft = "...";
    const estimateHistoryMs: number[] = [];
    const MAX_ESTIMATE_HISTORY = 8;

    // handle log messages from gitoxide to track progress
    this.gitoxideLogListener = (message: string) => {
      let currentlyIndexedCommits = 0;
      // total commit count message
      if (message.startsWith("Commit count: ")) {
        commitCount = parseInt(message.slice("Commit count: ".length - 1));
        lastIndexedCommitCountForEstimate = 0;
        timestampLastEstimateUpdate = Date.now();
      }
      // progress message
      else if (message.startsWith("Indexed commits:")) {
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
        // keep a sliding window of recent estimates
        if (estimateHistoryMs.length > MAX_ESTIMATE_HISTORY) {
          estimateHistoryMs.shift();
        }
        const averageRemainingMs =
          estimateHistoryMs.reduce((sum, value) => sum + value, 0) /
          estimateHistoryMs.length;
        const estimatedSeconds = Math.round(averageRemainingMs / 1000);
        currentEstimatedTimeLeft = Number.isFinite(estimatedSeconds)
          ? estimatedSeconds.toString()
          : "...";
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
      // call gitoxide Rust indexing function via ccall directly
      const resultFilePath = this.gitoxide.ccall(
        "gitoxide_run_git_indexer",
        "string",
        ["string", "string"],
        [repoPath, lastIndexedSha ?? ""]
      );
      if (!resultFilePath || resultFilePath.startsWith("error:")) {
        throw new Error(resultFilePath);
      }
      const buffer = this.gitoxide.FS.readFile(resultFilePath, {
        encoding: "binary"
      });

      this.gitoxide.FS.unlink(resultFilePath);

      // Get the latest commit SHA for reindexing purposes
      const latestSha = this.getLatestCommitSha(repoPath);

      progressCallback(
        99,
        "Indexing process completed. Inserting data into database..."
      );
      return { buffer, latestSha };
    } catch (error) {
      console.error(
        `${GITOXIDE_LOG_PREFIX} Indexing failed for repository at ${repoPath}:`,
        error
      );
      return;
    } finally {
      this.gitoxideLogListener = undefined;
    }
  }

  /**
   * Remounts the repository from IndexedDB into the in-memory FS.
   * Mainly used when cloning with wasm-git and analyzing afterwards.
   */
  async remountRepository(identifier: string) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    await this.syncFs(true);
    console.log(`Repository remounted at ${repoPath}`);
  }

  /**
   * Mounting a repository from a local directory handle into virtual FS and persisting it in IndexedDB.
   */
  async mountRepository(
    identifier: string,
    localFileHandle: FileSystemDirectoryHandle,
    progressCallback: (progress: number, message: string) => void
  ) {
    const repoPath = `${PERSIST_ROOT}/${identifier}`;
    this.ensureDirExists(repoPath);

    // write a single file to the virtual FS, making sure the directory exists
    const writeFile = async ({
      file,
      relativePath
    }: {
      file: File;
      relativePath: string;
    }) => {
      const destination = `${repoPath}/${this.normalizePath(relativePath)}`;
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

    // now write tracked files
    const tracked = this.trackedPathsFor(repoPath);
    const trackedList = Array.from(tracked);
    let copiedTracked = 0;

    if (trackedList.length > 0) {
      // collect paths first to provide progress updates
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

      // write tracked files
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

    // final sync to persist all data
    await this.syncFs(false);

    console.log(
      `${GITOXIDE_LOG_PREFIX} Mounted repository at ${repoPath} with ${writtenFiles} files.`
    );
  }

  // recursively collect all entries in the .git directory
  private async collectGitDirectoryEntries(
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

    // depth-first traversal of directory tree
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
          // and not needed for read-only analytics operations.
          if (nextPath === ".git/index") {
            continue;
          }
          try {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            files.push({ file, relativePath: nextPath });
            count += 1;
            onProgress(count);
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

  // collect entries for tracked files
  private async collectTrackedFileEntries(
    localFileHandle: FileSystemDirectoryHandle,
    trackedPaths: string[],
    onProgress: (processed: number, total: number) => void
  ) {
    const entries = [];
    const directoryCache = new Map<string, FileSystemDirectoryHandle | null>();
    directoryCache.set("", localFileHandle);

    const total = trackedPaths.length;
    let processed = 0;

    // iterate over all tracked paths
    for (const rawPath of trackedPaths) {
      // normalize path
      const relativePath = this.normalizePath(rawPath);
      if (!relativePath) {
        processed += 1;
        onProgress(processed, total);
        continue;
      }

      const segments = relativePath.split("/").filter(Boolean);
      if (segments.length === 0) {
        processed += 1;
        onProgress(processed, total);
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
        // add to entries
        entries.push({ file, relativePath });
      } catch (error) {
        console.warn(`Failed to read tracked path ${relativePath}`, error);
      } finally {
        processed += 1;
        onProgress(processed, total);
      }
    }

    return entries;
  }

  // get directory handle with caching to avoid redundant lookups
  private async getDirectoryHandleCached(
    localDirectoryHandle: FileSystemDirectoryHandle,
    cache: Map<string, FileSystemDirectoryHandle | null>,
    path: string
  ) {
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
          console.warn(`Directory ${currentPath} has invalid handle in cache`);
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

  // ensures that a directory path exists (all layers) in the virtual FS and create it if necessary
  private ensureDirExists(path: string) {
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

  // used for deleting repository data when project is removed
  private removePathRecursive(path: string) {
    let stat;
    try {
      stat = this.gitoxide.FS.stat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    if (this.gitoxide.FS.isDir(stat.mode)) {
      const entries = this.gitoxide.FS.readdir(path).filter(
        (name: string) => name !== "." && name !== ".."
      );
      for (const entry of entries) {
        this.removePathRecursive(`${path}/${entry}`);
      }
      this.gitoxide.FS.rmdir(path);
    } else {
      this.gitoxide.FS.unlink(path);
    }
  }

  // setup filesystem using IDBFS
  private async setupPersistentFs() {
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
  }

  // sync the in-memory FS with IndexedDB; if populate is true, data is loaded from IndexedDB into the in-memory FS, otherwise changes are written back to IndexedDB
  private async syncFs(populate: boolean) {
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

  // gets set of all tracked paths using gitoxide
  private trackedPathsFor(repositoryPath: string): Set<string> {
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

  private getLatestCommitSha(repositoryPath: string): string {
    try {
      const sha: string | undefined = this.gitoxide.ccall(
        "gitoxide_repo_head",
        "string",
        ["string"],
        [repositoryPath]
      );
      if (sha && !sha.startsWith("error:")) {
        return sha;
      }
      console.warn("Could not get HEAD SHA:", sha);
    } catch (error) {
      console.warn("Could not get HEAD SHA", error);
    }
    return "";
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^[\\/]+/, "");
  }
}

const wasmGixWorker = new WasmGixWorker();
(async function () {
  await wasmGixWorker.init();
  Comlink.expose(wasmGixWorker);
})().catch(console.error);

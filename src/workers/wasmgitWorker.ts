import * as Comlink from "comlink";
import createWasmGitModule, { type WasmGitModule } from "wasm-git/lg2.js";
import lg2WasmUrl from "wasm-git/lg2.wasm?url";

export class WasmGitWorker {
  private lg!: WasmGitModule;
  private repoURL = "";
  private FS!: typeof FS;
  private IDBFS!: Emscripten.FileSystemType;
  private readonly wasmGitLogPrefix = "[wasm-git] ";
  private isMounted = false;
  private logCallback: ((logMessage: string) => void) | null = null;

  private async init() {
    // Prevent lg2 from printing to the console by overriding Emscripten print handlers
    this.lg = await createWasmGitModule({
      locateFile: (path: string) => {
        if (path.endsWith(".wasm")) {
          return lg2WasmUrl;
        }
        return path;
      },
      print: (text: string) => {
        if (this.logCallback) {
          this.logCallback(text);
        }
      },
      printErr: (text: string) => {
        console.log(this.wasmGitLogPrefix + text);
      }
    });

    this.FS = this.lg.FS;
    this.IDBFS = this.lg.IDBFS;
  }

  /**
   * Clones a remote Git repository into IndexedDB using WasmGit.
   * @param gitRepoURL Expects the URL in the following format: https://github.com/repo-owner/repo-name.git
   */
  async cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    proxyURL: string,
    progressCallback: (progress: number, message: string) => void
  ) {
    await this.init();
    this.logCallback = (logMessage: string) => {
      const progress = this.parseCloneProgress(logMessage);
      if (!progress) {
        return;
      }
      const { phase, percent } = progress;
      progressCallback(
        percent,
        `${phase} - ${Number.isNaN(percent) ? 100 : percent} %`
      );
    };

    const repoPath = `/repos/${repoIdentifier}`;
    try {
      this.setCurrentRepository(gitRepoURL, proxyURL);
      await this.ensureRepositoryIsPublic();
      this.mountIDBFS();
      await this.syncFs(true);

      this.lg.callMain(["clone", this.repoURL, repoPath]);

      if (!this.repositoryExists(repoPath)) {
        throw new Error(
          `Clone did not create a valid git repository at ${repoPath}.`
        );
      }
      // NOTE: When syncing the fs to indexed DB, for some repos we get an error (code 43), here. For example the wasm-git repo itself. I am assuming this could be bacause the repo links
      // 2 alias files, and due to a bug in emscripten, this causes an error
      await this.syncFs(false);
    } finally {
      this.logCallback = null;
    }
  }

  /**
   * Checks if a repository with the given identifier exists in the Emscripten FS.
   */
  async hasRepository(repoIdentifier: string): Promise<boolean> {
    await this.init();
    this.mountIDBFS();
    await this.syncFs(true);

    const repoPath = `/repos/${repoIdentifier}`;
    return this.repositoryExists(repoPath);
  }

  /**
   * Instead of cloning the whole repo again, we can just pull changes to the virtual FS (given the files are still saved).
   */
  async pullChanges(
    gitRepoURL: string,
    repoIdentifier: string,
    proxyURL: string,
    progressCallback: (progress: number, message: string) => void
  ) {
    await this.init();
    this.logCallback = (logMessage: string) => {
      const progress = this.parseCloneProgress(logMessage);
      if (!progress) {
        return;
      }
      const { phase, percent } = progress;
      progressCallback(
        percent,
        `${phase} - ${Number.isNaN(percent) ? 100 : percent} %`
      );
    };

    const repoPath = `/repos/${repoIdentifier}`;
    try {
      this.setCurrentRepository(gitRepoURL, proxyURL);
      // could be removed but just to be sure the repo is still accessible before pulling changes
      await this.ensureRepositoryIsPublic();
      this.mountIDBFS();
      await this.syncFs(true);

      this.lg.callMain(["pull", this.repoURL, repoPath]);
      await this.syncFs(false);
    } finally {
      this.logCallback = null;
    }
  }

  private repositoryExists(repoPath: string): boolean {
    try {
      this.FS.stat(`${repoPath}/.git/HEAD`);
      return true;
    } catch {
      return false;
    }
  }

  private async syncFs(populate: boolean): Promise<void> {
    await new Promise<void>((resolve) => {
      this.FS.syncfs(populate, (error: unknown) => {
        if (error) {
          console.error(
            `${this.wasmGitLogPrefix} Failed to sync filesystem`,
            error
          );
        }
        resolve();
      });
    });
  }

  private extractPercent(line: string): number | undefined {
    const match = /(\d+)%/.exec(line);
    return match ? Number(match[1]) : undefined;
  }

  COUNTING_MARKER = "counting objects";
  COMPRESSING_MARKER = "compressing objects";
  RESOLVING_MARKER = "resolving deltas";
  DOWNLOAD_MARKER = "net";

  /** Used for We get the git cloning separate lines for the download phase, so we can parse percent there.
   */
  private parseCloneProgress(
    line: string
  ): { phase: string; percent: number } | null {
    const lowered = line.toLowerCase();
    if (lowered.includes(this.DOWNLOAD_MARKER)) {
      const percent = this.extractPercent(line);
      return percent === undefined ? null : { phase: "Downloading", percent };
    }
    if (lowered.includes(this.COUNTING_MARKER)) {
      return { phase: "Counting", percent: 0 };
    }
    if (lowered.includes(this.COMPRESSING_MARKER)) {
      return { phase: "Compressing", percent: 0 };
    }
    if (lowered.includes(this.RESOLVING_MARKER)) {
      return { phase: "Resolving", percent: 100 };
    }
    return null;
  }

  private setCurrentRepository(url: string, proxyURL: string) {
    // if the url contains github remove everything before and including github.com/
    if (url.includes("https://github.com/")) {
      this.repoURL = url.substring(url.indexOf("https://github.com/") + 19);
    } else {
      this.repoURL = url;
    }
    // use git-proxy to avoid CORS issues
    this.repoURL = proxyURL + `/git-proxy/` + this.repoURL;
  }

  // mounts the indexedDB filesystem at /repos, it is provided by emscripten and thus can also be used by wasm-gix
  private mountIDBFS() {
    if (this.isMounted) {
      return;
    }
    const mountPath = "/repos";
    try {
      this.FS.mkdir(mountPath);
    } catch (error: unknown) {
      const err = error as { code?: string | number } | undefined;
      if (err?.code !== "EEXIST") {
        throw error;
      }
    }
    this.FS.mount(this.IDBFS, {}, mountPath);
    this.isMounted = true;
  }

  private async ensureRepositoryIsPublic() {
    const infoRefsUrl = `${this.repoURL}/info/refs?service=git-upload-pack`;
    let response: Response;
    try {
      response = await fetch(infoRefsUrl, {
        method: "GET",
        headers: {
          Accept: "application/x-git-upload-pack-advertisement"
        },
        credentials: "omit",
        redirect: "follow"
      });
    } catch (error) {
      throw new Error(
        `Could not reach repository via proxy (${infoRefsUrl}). Please ensure the proxy URL is reachable. Cause: ${
          (error as Error)?.message ?? error
        }`
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "The repository is private or requires authentication. Only public repositories are supported."
        );
      }
      if (response.status === 404) {
        throw new Error(
          "The repository could not be found. Please check the URL."
        );
      }
      throw new Error(
        `Failed to verify repository accessibility (status ${response.status}).`
      );
    }
  }
}

const wasmGitWorker = new WasmGitWorker();
Comlink.expose(wasmGitWorker);

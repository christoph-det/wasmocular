import * as Comlink from "comlink";
import { parseCloneProgress } from "../lib/utils.ts";
import createWasmGitModule from "./wasm-git-library/lg2.js";
import lg2WasmUrl from "./wasm-git-library/lg2.wasm?url";
import type { WasmGitModule } from "./wasm-git-library/lg2.ts";

export class WasmGitWorker {
  private lg!: WasmGitModule;
  private repoURL = "";
  private FS!: typeof FS;
  private IDBFS!: Emscripten.FileSystemType;
  private readonly wasmGitLogPrefix = "[wasm-git] ";
  private isMounted = false;
  private logCallback: ((logMessage: string) => void) | null = null;

  async init() {
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
   * @param repoIdentifier Repository identifier to be used as folder name in IndexedDB and as DB name
   */
  async cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    proxyURL: string,
    progressCallback: (progress: number, message: string) => void
  ) {
    this.logCallback = (logMessage: string) => {
      const progress = parseCloneProgress(logMessage);
      if (!progress) {
        return;
      }
      const { phase, percent } = progress;
      progressCallback(
        percent,
        `${phase} - ${Number.isNaN(percent) ? 100 : percent} %`
      );
    };
    this.setCurrentRepository(gitRepoURL, proxyURL);
    await this.ensureRepositoryIsPublic();
    this.mountIDBFS();
    this.lg.callMain(["clone", this.repoURL, `/repos/${repoIdentifier}`]);
    try {
      // remove git index to reduce memory usage and bc gitoxide runs into memory issues with it
      this.FS.unlink(`/repos/${repoIdentifier}/.git/index`);
    } catch (error: unknown) {
      const err = error as { code?: string | number } | undefined;
      if (err?.code !== "ENOENT") {
        console.error(
          `${this.wasmGitLogPrefix} Failed to remove Git index`,
          error
        );
        throw error;
      }
    }
    // NOTE: When syncing the fs to indexed DB, for some repos we get an error (code 43), here. For example the wasm-git repo itself. I am assuming this could be bacause the repo links
    // 2 alias files, and due to a bug in emscripten, this causes an error
    this.FS.syncfs((err: unknown) => {
      if (err)
        console.error(`${this.wasmGitLogPrefix} syncfs(save) error:`, err);
    });
  }

  /**
   * Sets the current repository URL.
   * @param url
   */
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

  private mountIDBFS() {
    if (this.isMounted) {
      return;
    }
    const mountPath = "/repos";
    this.isMounted = true;
    this.FS.mkdir(mountPath);
    this.FS.mount(this.IDBFS, {}, mountPath);
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
        `Could not reach repository. Please ensure the URL is correct. Cause: ${
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

(async function () {
  await wasmGitWorker.init();
  Comlink.expose(wasmGitWorker);
})().catch(console.error);

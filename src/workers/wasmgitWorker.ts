import * as Comlink from "comlink";

const COUNTING_MARKER = "counting objects";
const COMPRESSING_MARKER = "compressing objects";
const RESOLVING_MARKER = "resolving deltas";
const DOWNLOAD_MARKER = "net";

function extractPercent(line: string): number | undefined {
  const match = line.match(/(\d+)%/);
  return match ? Number(match[1]) : undefined;
}

// we only get seperate lines for the download phase, so we can parse percent there
function parseCloneProgress(
  line: string
): { phase: string; percent: number } | null {
  const lowered = line.toLowerCase();
  if (lowered.includes(DOWNLOAD_MARKER)) {
    const percent = extractPercent(line);
    return percent === undefined ? null : { phase: "Downloading", percent };
  }
  if (lowered.includes(COUNTING_MARKER)) {
    return { phase: "Counting", percent: 0 };
  }
  if (lowered.includes(COMPRESSING_MARKER)) {
    return { phase: "Compressing", percent: 0 };
  }
  if (lowered.includes(RESOLVING_MARKER)) {
    return { phase: "Resolving", percent: 100 };
  }
  return null;
}
class WasmGitWorker {
  private lg: any;
  private repoURL = "";
  private FS: any;
  private IDBFS: any;
  private baseOrigin = "";
  private readonly wasmGitLogPrefix = "[wasm-git] ";
  private isMounted: boolean = false;
  private logCallback: ((logMessage: string) => void) | null = null;

  async init(baseOrigin: string) {
    this.baseOrigin = baseOrigin;
    const lg2mod = await import(
      /* @vite-ignore */
      new URL("wasm-git-library/lg2.js", import.meta.url).href
    );
    // Prevent lg2 from printing to the console by overriding Emscripten print handlers
    this.lg = await lg2mod.default({
      print: (text: any) => {
        if (this.logCallback) {
          this.logCallback(text);
        }
      },
      printErr: (text: any) => {
        console.log(this.wasmGitLogPrefix + text);
      }
    });

    this.FS = this.lg.FS;
    this.IDBFS = this.lg.IDBFS;
  }

  /**
   * Sets the current repository URL.
   * @param url
   */
  private setCurrentRepository(url: string) {
    // if the url contains github remove everything before and including github.com/
    if (url.includes("https://github.com/")) {
      this.repoURL = url.substring(url.indexOf("https://github.com/") + 19);
    } else {
      this.repoURL = url;
    }
    // use git-proxy to avoid CORS issues
    this.repoURL = this.baseOrigin + `/git-proxy/` + this.repoURL;
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

  /**
   * Clones a remote Git repository into IndexedDB using WasmGit.
   * @param gitRepoURL Expects the URL in the following format: https://github.com/repo-owner/repo-name.git
   * @param repoIdentifier Repository identifier to be used as folder name in IndexedDB and as DB name
   */
  async cloneRepository(
    gitRepoURL: string,
    repoIdentifier: string,
    progressCallback: (progress: number, message: string) => void
  ) {
    this.logCallback = (logMessage: string) => {
      const progress = parseCloneProgress(logMessage);
      if (!progress) {
        return;
      }
      let { phase, percent } = progress;
      if (Number.isNaN(percent)) {
        percent = 100;
      }
      progressCallback(percent, `${phase} - ${percent} %`);
    };
    this.setCurrentRepository(gitRepoURL);
    await this.ensureRepositoryIsPublic();
    this.mountIDBFS();
    this.lg.callMain(["clone", this.repoURL, `/repos/${repoIdentifier}`]);
    try {
      // remove git index to reduce memory usage and bc gitoxide runs into memory issues with it
      this.FS.unlink(`/repos/${repoIdentifier}/.git/index`);
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.error(
          `${this.wasmGitLogPrefix} Failed to remove Git index`,
          error
        );
        throw error;
      }
    }
    // NOTE: When syncing the fs to indexed DB, for some repos we get an error (code 43), here. For example the wasm-git repo itself. I am assuming this could be bacause the repo links
    // 2 alias files, and due to a bug in emscripten, this causes an error
    await this.FS.syncfs((err: any) => {
      if (err)
        console.error(`${this.wasmGitLogPrefix} syncfs(save) error:`, err);
    });
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
await wasmGitWorker.init(self.location.origin);

Comlink.expose(wasmGitWorker);

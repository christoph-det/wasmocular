import * as Comlink from "comlink";

class WasmGitWorker {
  stdout: string[] = [];
  stderr: string[] = [];
  lg2mod: any;
  lg: any;
  repoURL = "";
  currentRepoRootDir: string | null = null;
  FS: any;
  IDBFS: any;
  baseOrigin = "";

  async init(baseOrigin: string) {
    this.baseOrigin = baseOrigin;
    this.lg2mod = await import(
      /* @vite-ignore */
      new URL("wasm-git-library/lg2.js", import.meta.url).href
    );
    // Prevent lg2 from printing to the console by overriding Emscripten print handlers
    this.lg = await this.lg2mod.default({
      print: (text: any) => {
        //console.log(text);
        this.stdout.push(text);
      },
      printErr: (text: any) => {
        console.log(text);
        this.stderr.push(text);
      },
      callMainWithResetStream: (...args: any[]) => {
        this.resetOutput();
        this.lg.callMain(...args);
      }
    });

    this.FS = this.lg.FS;
    this.IDBFS = this.lg.IDBFS;

  }

  flushStdout() {
    const capturedOutput = this.stdout;
    this.stdout = [];
    return capturedOutput;
  }

  resetOutput() {
    this.stdout = [];
    this.stderr = [];
  }

  setCurrentRepository(url: string) {
    // if the url contains github remove everything before and including github.com/
    if (url.includes("github.com/")) {
      this.repoURL = url.substring(url.indexOf("https://github.com/") + 19);
    } else {
      this.repoURL = url;
    }
    this.repoURL = this.baseOrigin + `/git-proxy/` + this.repoURL;
    console.log("Set repo URL to:", this.repoURL);
    this.currentRepoRootDir = this.repoURL.substring(
      this.repoURL.lastIndexOf("/") + 1
    );
  }

  mountIDBFS(repoIdentifier: string) {
    const mountPath = "/repos"
    const repoPath = `${mountPath}/${repoIdentifier}`;
    try {
      this.FS.mkdir(mountPath);
      //this.FS.mkdir(repoPath);
    } catch {
      console.log("Mount path already exists");
    }
    this.FS.mount(this.IDBFS, {}, mountPath);
  }

  async cloneRepository(gitRepoURL: string, repoIdentifier: string) {
    this.setCurrentRepository(gitRepoURL);
    this.mountIDBFS(repoIdentifier);
    this.lg.callMain(["clone", this.repoURL, `/repos/${repoIdentifier}`]);
    console.log("Cloned repo");
    try {
      this.FS.unlink(`/repos/${repoIdentifier}/.git/index`);
      console.log("Removed Git index to reduce wasm memory usage");
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.warn("Failed to remove Git index", error);
      }
    }
    // NOTE: When syncing the fs to indexed DB, for some repos we get an error (code 43), here. For example the wasm-git repo itself. I am assuming this could be bacause the repo links
    // 2 alias files, and due to a bug in emscripten, this causes an error
    await this.FS.syncfs((err: any) => {
      if (err) console.error("syncfs(save) error:", err);
      console.log(this.currentRepoRootDir, "stored to indexeddb");
    });
  }


}

onmessage = () => {
  console.log("wasmGitWorker: Received message but not initialized yet!");
};

const wasmGitWorker = new WasmGitWorker();
await wasmGitWorker.init(self.location.origin);


Comlink.expose(wasmGitWorker);

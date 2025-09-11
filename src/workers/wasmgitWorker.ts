class WasmGitWorker {
  stdout: string[] = [];
  stderr: string[] = [];
  lg2mod: any;
  lg: any;
  repoURL: string = "";
  currentRepoRootDir: string | null = null;
  FS: any;
  IDBFS: any;
  baseOrigin: string = "";

  async init(baseOrigin: string) {
    this.baseOrigin = baseOrigin;
    this.lg2mod = await import(new URL("wasm-git-library/lg2.js", import.meta.url).href);
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

    const username = "Test User";
    const useremail = "test@example.com";

    this.FS.writeFile(
      "/home/web_user/.gitconfig",
      `[user]
    name = ${username}
    email = ${useremail}`
    );
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
      this.repoURL = url.substring(url.indexOf('https://github.com/') + 19);
    } else {
      this.repoURL = url;
    }
    this.repoURL = this.baseOrigin + `/git-proxy/` + this.repoURL;
    console.log("Set repo URL to:", this.repoURL);
    this.currentRepoRootDir = this.repoURL.substring(this.repoURL.lastIndexOf('/') + 1);
  }

  mountIDBFS(loadExisting: boolean) {
    const mountPath = `/${this.currentRepoRootDir}`;
    try {
      this.FS.mkdir(mountPath);
    } catch {
      console.log("Mount path already exists");
    }
    this.FS.mount(this.IDBFS, {}, mountPath);
    if (loadExisting) {
      this.FS.syncfs(true, (err: any) => {
      if (err) console.error('syncfs(load) error:', err);
      if (this.FS.readdir(`/${this.currentRepoRootDir}`).find((file: string) => file === '.git')) {
        this.FS.chdir(`/${this.currentRepoRootDir}`);
        postMessage({ dircontents: this.FS.readdir('.') });
        console.log(this.currentRepoRootDir, 'restored from indexeddb');
      } else {
        postMessage({ notfound: true });
      }
    });
    }
  }

  cloneRepository(gitRepoURL: string) {
    this.setCurrentRepository(gitRepoURL);
    this.mountIDBFS(false);
    this.lg.callMain(['clone', this.repoURL, `/${this.currentRepoRootDir}`]);
    console.log("Cloned repo");
    this.FS.chdir(`/${this.currentRepoRootDir}`);
    // NOTE: When syncing the fs to indexed DB, for some repos we get an error (code 43), here. For example the wasm-git repo itself. I am assuming this could be bacause the repo links
    // 2 alias files, and due to a bug in emscripten, this causes an error
    this.FS.syncfs(false, (err: any) => {
      if (err) console.error('syncfs(save) error:', err);
      console.log(this.currentRepoRootDir, 'stored to indexeddb');
      postMessage({ dircontents: this.FS.readdir('.') });
    });

  }

  reloadRepo(gitRepoURL: string) {
    this.setCurrentRepository(gitRepoURL);
    this.mountIDBFS(true);
  }


  countCommits() {
    this.lg.callMainWithResetStream(["rev-list", "HEAD"]);
    console.log('Commit count:', this.stdout.length);
  }
}

onmessage = () => {
  console.log("wasmGitWorker: Received message but not initialized yet!");
};

const wasmGitWorker = new WasmGitWorker();

// Initialize once and handle messages
(async function () {
  await wasmGitWorker.init(self.location.origin);

  onmessage = async function (event) {
    const data = event.data || {};
    console.log("wasmGitWorker: Received message:", data);
    if (data.action === "cloneRepository") {
      wasmGitWorker.cloneRepository(data.gitRepoURL);
    } else if (data.action === "reloadRepo") {
      wasmGitWorker.reloadRepo(data.gitRepoURL);
    } else if (data.action === "countCommits") {
      wasmGitWorker.countCommits();
    } else {
      console.warn("wasmGitWorker: Unknown action:", data.action);
    }
  };
})();

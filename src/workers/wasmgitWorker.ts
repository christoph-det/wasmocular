class WasmGitWorker {
  stdout: string[] = [];
  stderr: string[] = [];
  lg2mod: any;
  lg: any;
  currentRepoRootDir: string | null = null;
  FS: any;
  IDBFS: any;
  baseOrigin: string | null = null;

  async init() {
    this.lg2mod = await import(new URL("lg2.js", import.meta.url).href);
    this.lg = await this.lg2mod.default();

    globalThis.wasmGitModuleOverrides = {
      print: (text: any) => {
        console.log(text);
        this.stdout.push(text);
      },
      printErr: (text: any) => {
        console.error(text);
        this.stderr.push(text);
      }
    };

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

  runTest() {
    const repoURL = this.baseOrigin
      ? `${this.baseOrigin}/git-proxy/petersalomonsen/wasm-git.git`
      : "/git-proxy/petersalomonsen/wasm-git.git";
    this.currentRepoRootDir = repoURL.substring(repoURL.lastIndexOf('/') + 1);

    this.lg.callMain(['clone', repoURL, this.currentRepoRootDir]);
    this.FS.chdir(this.currentRepoRootDir);

    this.FS.syncfs(false, () => {
      console.log(this.currentRepoRootDir, 'stored to indexeddb');
      console.log('Current directory files:', this.FS.readdir('.'));
    });
    this.lg.callMain(["status"]);
  }
}

onmessage = () => {
  console.log("wasmGitWorker: Received message but not initialized yet!");
};

const wasmGitWorker = new WasmGitWorker();

// Initialize once and handle messages
(async function () {
  await wasmGitWorker.init();

  onmessage = async function (event) {
    const data = event.data || {};
    if (data.origin && typeof data.origin === "string") {
      wasmGitWorker.baseOrigin = data.origin;
    }
    console.log("wasmGitWorker: Received message:", data);
    wasmGitWorker.runTest();
  };
})();

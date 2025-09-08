import { stdout } from "process";

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

    /*const username = "Test User";
    const useremail = "test@example.com";

    this.FS.writeFile(
      "/home/web_user/.gitconfig",
      `[user]
    name = ${username}
    email = ${useremail}`
    );*/
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

  

  runTest() {
    const repoURL = this.baseOrigin
      ? `${this.baseOrigin}/git-proxy/INSO-World/Binocular.git`
      : "";
    this.currentRepoRootDir = repoURL.substring(repoURL.lastIndexOf('/') + 1);

    // clone repo
    this.lg.callMain(['clone', repoURL, this.currentRepoRootDir]);

    //
    this.FS.chdir(this.currentRepoRootDir);


    // count files
    this.lg.callMainWithResetStream(["ls-files"]);
    console.log('File count git:', this.stdout.length);

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

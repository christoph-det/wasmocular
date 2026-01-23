declare module "wasm-git/lg2.js" {
  export interface WasmGitModule extends EmscriptenModule {
    callMain: (args: string[]) => void;
    FS: typeof FS;
    IDBFS: Emscripten.FileSystemType;
  }

  const init: EmscriptenModuleFactory<WasmGitModule>;
  export default init;
}

declare module "wasm-git/lg2.wasm?url" {
  const url: string;
  export default url;
}

export interface WasmGitModule extends EmscriptenModule {
  callMain: (args: string[]) => void;
  FS: typeof FS;
  IDBFS: Emscripten.FileSystemType;
}

declare const init: EmscriptenModuleFactory<WasmGitModule>;
export default init;
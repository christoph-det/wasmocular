/// <reference types="emscripten" />

export interface GitoxideModule extends EmscriptenModule {
  ccall: typeof ccall;
  FS: typeof FS;
  IDBFS: Emscripten.FileSystemType;
}

declare const initGitoxide: EmscriptenModuleFactory<GitoxideModule>;
export default initGitoxide;

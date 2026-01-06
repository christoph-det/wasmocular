/// <reference types="vite/client" />

// Allow importing .wasm files as URLs
declare module "*.wasm?url" {
  const src: string;
  export default src;
}

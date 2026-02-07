import { webcrypto } from "crypto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// needed because in CI the crypto API is not availible by default
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as Crypto;
}

// fsa-mock references `self` at module top-level; provide it for Node
if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis as any;
}

afterEach(() => {
  if (typeof globalThis.window !== "undefined") {
    cleanup();
  }
});

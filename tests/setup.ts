import { webcrypto } from "crypto";

// needed because in CI the crypto API is not availible by default
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as Crypto;
}

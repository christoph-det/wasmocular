/* eslint-disable */

/* Source: https://github.com/INSO-World/Binocular/blob/main/binocular-frontend/src/utils/crypto-utils.ts
Accessed: 2025-11-18
*/

const token = "Binocular";

export const hash = async (value: any) => {
  "use strict";

  const enc = new TextEncoder();
  const algorithm = { name: "HMAC", hash: "SHA-256" };

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(token),
    algorithm,
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign(
    algorithm.name,
    key,
    enc.encode(value)
  );
  const digest = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return digest;
};

import { randomBytes } from "node:crypto";
import { sha256Hex } from "../import/hash";

export interface FetchNonce {
  nonce: string; // goes in the one-time `fetch` URL
  hash: string; // stored server-side (registration_sessions.fetch_nonce_hash)
}

export function generateFetchNonce(): FetchNonce {
  const nonce = randomBytes(32).toString("base64url");
  return { nonce, hash: sha256Hex(nonce) };
}

export function fetchNonceMatches(nonce: string, hash: string): boolean {
  return sha256Hex(nonce) === hash;
}

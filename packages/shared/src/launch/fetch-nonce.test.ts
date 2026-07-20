import { describe, expect, it } from "vitest";
import { fetchNonceMatches, generateFetchNonce } from "./fetch-nonce";

describe("fetch nonce", () => {
  it("generates a nonce whose hash matches itself", () => {
    const { nonce, hash } = generateFetchNonce();
    expect(fetchNonceMatches(nonce, hash)).toBe(true);
  });

  it("rejects a wrong nonce against a given hash", () => {
    const { hash } = generateFetchNonce();
    const { nonce: otherNonce } = generateFetchNonce();
    expect(fetchNonceMatches(otherNonce, hash)).toBe(false);
  });

  it("generates distinct nonces per call", () => {
    const a = generateFetchNonce();
    const b = generateFetchNonce();
    expect(a.nonce).not.toBe(b.nonce);
  });
});

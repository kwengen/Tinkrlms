import { sha256Hex } from "../import/hash";

/**
 * Deterministic canonicalization for idempotency hashing (bestilling §5):
 * recursively sorts object keys so property order never affects the hash,
 * and strips `stored`/`authority` — the two fields the LRS itself populates
 * on write, which must NOT be part of the client-content hash (otherwise a
 * verbatim resend of an already-stored statement would hash differently and
 * incorrectly trigger a 409 instead of being recognized as the same content).
 * `timestamp` is deliberately NOT stripped — Studio holds it stable across
 * resends, and bestilling requires it be part of the hash.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      sorted[key] = canonicalize(input[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalizeStatement(statement: Record<string, unknown>): string {
  const { stored: _stored, authority: _authority, ...rest } = statement;
  return JSON.stringify(canonicalize(rest));
}

export function statementHash(statement: Record<string, unknown>): string {
  return sha256Hex(canonicalizeStatement(statement));
}

import { describe, expect, it } from "vitest";
import { statementHash } from "./statement-hash";

describe("statementHash", () => {
  it("is independent of key order", () => {
    const a = { id: "1", verb: { id: "v" }, timestamp: "2026-01-01T00:00:00Z" };
    const b = { timestamp: "2026-01-01T00:00:00Z", id: "1", verb: { id: "v" } };
    expect(statementHash(a)).toBe(statementHash(b));
  });

  it("ignores stored/authority (LRS-populated fields)", () => {
    const withoutLrsFields = { id: "1", verb: { id: "v" } };
    const withLrsFields = { id: "1", verb: { id: "v" }, stored: "2026-01-01T00:00:00Z", authority: { x: 1 } };
    expect(statementHash(withoutLrsFields)).toBe(statementHash(withLrsFields));
  });

  it("changes when timestamp changes (timestamp IS part of the hash)", () => {
    const a = { id: "1", timestamp: "2026-01-01T00:00:00Z" };
    const b = { id: "1", timestamp: "2026-01-02T00:00:00Z" };
    expect(statementHash(a)).not.toBe(statementHash(b));
  });

  it("changes when any other client content changes", () => {
    const a = { id: "1", result: { score: { scaled: 0.5 } } };
    const b = { id: "1", result: { score: { scaled: 0.6 } } };
    expect(statementHash(a)).not.toBe(statementHash(b));
  });

  it("is stable across nested key reordering", () => {
    const a = { context: { extensions: { x: 1, y: 2 } }, id: "1" };
    const b = { id: "1", context: { extensions: { y: 2, x: 1 } } };
    expect(statementHash(a)).toBe(statementHash(b));
  });
});

import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { isPathSafe, safeExtractZip } from "./extract-zip";
import { readFixtureZip } from "../test-utils/fixtures";

describe("safeExtractZip against a real CATAPULT package", () => {
  it("extracts single_au_basic_framed.zip cleanly", () => {
    const buffer = readFixtureZip("single_au_basic_framed.zip");
    const result = safeExtractZip(buffer);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("cmi5.xml");
    expect(paths).toContain("index.html");
    expect(result.files.every((f) => f.content.length > 0)).toBe(true);
  });
});

describe("safeExtractZip security guards (bestilling §9c)", () => {
  // AdmZip's own addFile() sanitizes "../" prefixes and leading "/" before the
  // bytes are ever written, so a zip built through its API can't actually
  // carry a malicious entryName — a real attacker crafts raw zip bytes by
  // hand (or with a non-sanitizing tool), bypassing that. isPathSafe() is the
  // guard that matters at read time, tested directly below without relying
  // on AdmZip to (not) get in the way.
  it("isPathSafe rejects zip-slip and absolute-path traversal", () => {
    expect(isPathSafe("../../evil.sh")).toBe(false);
    expect(isPathSafe("../evil.sh")).toBe(false);
    expect(isPathSafe("a/../../evil.sh")).toBe(false);
    expect(isPathSafe("/etc/passwd")).toBe(false);
    expect(isPathSafe("C:\\Windows\\System32\\evil.dll")).toBe(false);
  });

  it("isPathSafe accepts normal relative package paths", () => {
    expect(isPathSafe("index.html")).toBe(true);
    expect(isPathSafe("img/logo.png")).toBe(true);
    expect(isPathSafe("js/vendor/cmi5.min.js")).toBe(true);
  });

  it("rejects disallowed file extensions", () => {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html></html>"));
    zip.addFile("payload.exe", Buffer.from("MZ"));
    const result = safeExtractZip(zip.toBuffer());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("disallowed file type"))).toBe(true);
  });

  it("rejects packages exceeding the file-count limit", () => {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html></html>"));
    const result = safeExtractZip(zip.toBuffer(), {
      maxTotalUncompressedBytes: 10_000,
      maxFileCount: 0,
      maxSingleFileBytes: 10_000,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("max is 0"))).toBe(true);
  });

  it("rejects a single file exceeding the per-file size limit", () => {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.alloc(1000, "a"));
    const result = safeExtractZip(zip.toBuffer(), {
      maxTotalUncompressedBytes: 10_000,
      maxFileCount: 10,
      maxSingleFileBytes: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("exceeds per-file limit"))).toBe(true);
  });

  it("rejects a package exceeding total uncompressed size", () => {
    const zip = new AdmZip();
    zip.addFile("a.html", Buffer.alloc(600, "a"));
    zip.addFile("b.html", Buffer.alloc(600, "b"));
    const result = safeExtractZip(zip.toBuffer(), {
      maxTotalUncompressedBytes: 1000,
      maxFileCount: 10,
      maxSingleFileBytes: 10_000,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("exceeds limit of 1000"))).toBe(true);
  });
});

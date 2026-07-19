import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { safeExtractZip } from "../import/extract-zip";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test/fixtures/cmi5-packages",
);

/** Reads a vendored CATAPULT fixture zip and returns its cmi5.xml contents. */
export function readFixtureCmi5Xml(fixtureName: string): string {
  const buffer = readFileSync(path.join(FIXTURES_DIR, fixtureName));
  const result = safeExtractZip(buffer);
  if (!result.ok) {
    throw new Error(`Failed to extract fixture ${fixtureName}: ${result.errors.join("; ")}`);
  }
  const cmi5xml = result.files.find((f) => f.path === "cmi5.xml");
  if (!cmi5xml) {
    throw new Error(`Fixture ${fixtureName} has no cmi5.xml at package root`);
  }
  return cmi5xml.content.toString("utf-8");
}

export function readFixtureZip(fixtureName: string): Buffer {
  return readFileSync(path.join(FIXTURES_DIR, fixtureName));
}

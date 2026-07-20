import AdmZip from "adm-zip";
import path from "node:path";

export interface ZipLimits {
  maxTotalUncompressedBytes: number;
  maxFileCount: number;
  maxSingleFileBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxTotalUncompressedBytes: 200 * 1024 * 1024, // 200 MB
  maxFileCount: 5000,
  maxSingleFileBytes: 100 * 1024 * 1024, // 100 MB
};

// cmi5 packages are HTML/JS/CSS + media. Anything outside this allowlist
// (executables, scripts, server config, …) is rejected — bestilling §9c.
const ALLOWED_EXTENSIONS = new Set([
  ".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
  ".mp4", ".webm", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".txt", ".vtt", ".map", ".xsd",
]);

export interface ExtractedFile {
  path: string; // normalized, forward-slash, relative to package root
  content: Buffer;
}

export interface ZipExtractResult {
  ok: boolean;
  files: ExtractedFile[];
  errors: string[];
}

/** Rejects absolute paths and any ../ segment that would escape the extraction root. */
export function isPathSafe(entryName: string): boolean {
  if (path.isAbsolute(entryName) || /^[a-zA-Z]:/.test(entryName)) return false;
  const normalized = path.posix.normalize(entryName.replace(/\\/g, "/"));
  if (normalized === ".." || normalized.startsWith("../")) return false;
  return true;
}

export function safeExtractZip(zipBuffer: Buffer, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipExtractResult {
  const errors: string[] = [];
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (e) {
    return { ok: false, files: [], errors: [`Not a valid zip file: ${(e as Error).message}`] };
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  if (entries.length > limits.maxFileCount) {
    return { ok: false, files: [], errors: [`Package has ${entries.length} files, max is ${limits.maxFileCount}`] };
  }

  // Check declared (header) sizes BEFORE decompressing anything, so a zip
  // bomb never actually gets inflated.
  let totalSize = 0;
  for (const entry of entries) {
    const size = entry.header.size;
    if (size > limits.maxSingleFileBytes) {
      errors.push(`"${entry.entryName}" is ${size} bytes, exceeds per-file limit of ${limits.maxSingleFileBytes}`);
    }
    totalSize += size;
  }
  if (totalSize > limits.maxTotalUncompressedBytes) {
    errors.push(`Package uncompressed size ${totalSize} bytes exceeds limit of ${limits.maxTotalUncompressedBytes}`);
  }
  if (errors.length > 0) {
    return { ok: false, files: [], errors };
  }

  const files: ExtractedFile[] = [];
  for (const entry of entries) {
    if (!isPathSafe(entry.entryName)) {
      errors.push(`Rejected unsafe path (zip-slip): "${entry.entryName}"`);
      continue;
    }
    const ext = path.extname(entry.entryName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(`Rejected disallowed file type: "${entry.entryName}"`);
      continue;
    }
    files.push({
      path: path.posix.normalize(entry.entryName.replace(/\\/g, "/")),
      content: entry.getData(),
    });
  }

  if (errors.length > 0) {
    return { ok: false, files: [], errors };
  }

  return { ok: true, files, errors: [] };
}

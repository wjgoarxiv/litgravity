// Turns an artifact into plain text for the detector. Text formats decode as UTF-8; DOCX and PPTX go through
// extract_office_text.py (python3, stdlib only); PDF goes through pdftotext when it is on PATH. Every extractor
// runs with a byte cap and a timeout, and a missing extractor is an error the caller reports as an unchecked file.
import { spawnSync } from "node:child_process";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const extractionTimeoutMs = 2500;
const textExtensions = new Set([".adoc", ".csv", ".htm", ".html", ".markdown", ".md", ".rst", ".svg", ".tex", ".tsv", ".txt", ".xml"]);

const runExtractor = (command, args, input, label) => {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    timeout: extractionTimeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (result.error?.code === "ETIMEDOUT") throw new Error(`${label} extraction timed out`);
  if (result.error?.code === "ENOENT") throw new Error(`${label} extractor is unavailable`);
  if (result.error) throw new Error(`${label} extraction failed`);
  if (result.status !== 0) throw new Error(`${label} extraction failed`);
  return result.stdout;
};

export function extractArtifactText(extension, bytes) {
  const normalized = typeof extension === "string" && extension.startsWith(".")
    ? extension.toLowerCase()
    : extname(String(extension)).toLowerCase();
  if (!Buffer.isBuffer(bytes)) throw new TypeError("artifact bytes must be a Buffer");
  if (bytes.length > MAX_INPUT_BYTES) throw new Error("artifact exceeds the bounded extraction size");
  if (textExtensions.has(normalized)) return bytes.toString("utf8");
  if (normalized === ".docx" || normalized === ".pptx") {
    return runExtractor(process.platform === "win32" ? "python" : "python3", [resolve(here, "extract_office_text.py"), "--stdin", normalized], bytes, "Office document");
  }
  if (normalized === ".pdf") return runExtractor("pdftotext", ["-layout", "-", "-"], bytes, "PDF");
  throw new Error(`unsupported document format: ${normalized || "unknown"}`);
}

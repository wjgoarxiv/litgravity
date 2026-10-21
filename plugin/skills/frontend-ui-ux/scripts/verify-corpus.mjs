#!/usr/bin/env node
// Verify the canonical frontend library against references/_canonical-corpus/manifest.json
// before any file in it is read. Read-only: it hashes files and executes none of them.
//
//   node verify-corpus.mjs [--json]
//
// Exit 0: PASS (every listed file present with the listed size and SHA-256, no extra or
// non-regular entry under the four corpus roots, aggregate and byte count match, the three
// legal companions match). Exit 1: FAIL with one failure object per defect. Exit 2: the manifest
// itself could not be read or has the wrong shape. A failed corpus is not opened; the normalized
// dataset at data/design-intelligence.json and the focused references stay usable.
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES = join(SKILL_ROOT, "references");
const MANIFEST = join(REFERENCES, "_canonical-corpus", "manifest.json");
const ROOTS = ["design", "designpowers", "perfection", "ui-ux-db"];
const SCHEMA = "litgravity.canonical-frontend-corpus/v1";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safe = (path) => typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.includes("\\")
  && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");

function walk(rel, files, failures) {
  for (const name of readdirSync(join(REFERENCES, rel)).sort()) {
    const path = `${rel}/${name}`;
    const stat = lstatSync(join(REFERENCES, path));
    if (stat.isDirectory()) walk(path, files, failures);
    else if (stat.isFile()) files.add(path);
    else failures.push({ code: "CORPUS_NON_REGULAR", path });
  }
}

export function verifyCorpus() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch (error) {
    return { status: "ERROR", failures: [{ code: "MANIFEST_UNREADABLE", detail: error.code ?? error.message }] };
  }
  const shapeOk = manifest && manifest.schema_version === SCHEMA && Array.isArray(manifest.files) && Array.isArray(manifest.legal)
    && manifest.files.length === manifest.file_count && manifest.legal.length === 3
    && [...manifest.files, ...manifest.legal].every((entry) => safe(entry.path) && Number.isSafeInteger(entry.size) && /^[0-9a-f]{64}$/u.test(entry.sha256))
    && manifest.files.every((entry) => ROOTS.some((root) => entry.path.startsWith(`${root}/`)));
  if (!shapeOk) return { status: "ERROR", failures: [{ code: "MANIFEST_SCHEMA_INVALID" }] };

  const failures = [];
  const actual = new Set();
  for (const root of [...ROOTS, "_canonical-corpus"]) {
    try { walk(root, actual, failures); } catch { failures.push({ code: "CORPUS_UNREADABLE", path: root }); }
  }
  const expected = new Map([...manifest.files, ...manifest.legal].map((entry) => [entry.path, entry]));
  expected.set("_canonical-corpus/manifest.json", null);
  for (const path of actual) if (!expected.has(path)) failures.push({ code: "CORPUS_EXTRA", path });
  for (const path of expected.keys()) if (!actual.has(path)) failures.push({ code: "CORPUS_MISSING", path });

  const hashes = new Map();
  let corpusBytes = 0;
  for (const [path, entry] of expected) {
    if (!entry || !actual.has(path)) continue;
    const stat = lstatSync(join(REFERENCES, path));
    if (stat.size > MAX_FILE_BYTES) { failures.push({ code: "CORPUS_FILE_TOO_LARGE", path }); continue; }
    const bytes = readFileSync(join(REFERENCES, path));
    const hash = sha256(bytes);
    hashes.set(path, hash);
    if (bytes.length !== entry.size) failures.push({ code: "CORPUS_SIZE_MISMATCH", path, expected: entry.size, actual: bytes.length });
    if (hash !== entry.sha256) failures.push({ code: "CORPUS_HASH_MISMATCH", path, expected: entry.sha256, actual: hash });
    if ((stat.mode & 0o111) !== 0) failures.push({ code: "CORPUS_MODE_MISMATCH", path });
    if (ROOTS.some((root) => path.startsWith(`${root}/`))) corpusBytes += bytes.length;
  }
  const aggregate = manifest.files.every(({ path }) => hashes.has(path))
    ? sha256(manifest.files.map(({ path }) => `${hashes.get(path)}  ${path}\n`).join(""))
    : null;
  if (corpusBytes !== manifest.byte_count) failures.push({ code: "CORPUS_BYTE_COUNT_MISMATCH", expected: manifest.byte_count, actual: corpusBytes });
  if (aggregate !== manifest.aggregate_sha256) failures.push({ code: "CORPUS_AGGREGATE_MISMATCH", expected: manifest.aggregate_sha256, actual: aggregate });
  return { status: failures.length ? "FAIL" : "PASS", checkedFiles: hashes.size, corpusBytes, aggregateSha256: aggregate, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = verifyCorpus();
  process.stdout.write(process.argv.includes("--json")
    ? `${JSON.stringify(report)}\n`
    : `${report.status}: ${report.checkedFiles ?? 0} files, ${report.corpusBytes ?? 0} corpus bytes${report.failures.length ? `\n${report.failures.slice(0, 20).map((f) => `  ${f.code} ${f.path ?? ""}`).join("\n")}` : ""}\n`);
  process.exitCode = report.status === "PASS" ? 0 : report.status === "FAIL" ? 1 : 2;
}

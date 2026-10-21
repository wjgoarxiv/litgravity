import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";

import { stableJson } from "./strict-json.mjs";
import { DATASET_MAX_BYTES, DATASET_RECORDS, DATASET_SHA256 } from "./design-data.mjs";
import { UiuxContractError } from "./errors.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseCsv(text, label) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        field += "\""; index += 1;
      } else if (char === "\"") {
        quoted = false; closed = true;
      } else field += char;
    } else if (closed) {
      if (char === ",") {
        row.push(field); field = ""; closed = false;
      } else if (char === "\n") {
        row.push(field); rows.push(row); row = []; field = ""; closed = false;
      } else throw new UiuxContractError("SOURCE_CSV_INVALID", `${label}: data after quote`);
    } else if (char === "\"" && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new UiuxContractError("SOURCE_CSV_INVALID", `${label}: unterminated quote`);
  if (closed || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 2 || rows.some((candidate) => candidate.length !== rows[0].length)) {
    throw new UiuxContractError("SOURCE_CSV_INVALID", `${label}: inconsistent row width`);
  }
  return rows;
}

export function validateSourceManifest(manifest) {
  if (manifest.schema_version !== "litfamily.source-import-manifest/v1"
    || manifest.source?.commit !== "1307d97a72e6c1cda572cb65471ae5ce82995218"
    || !Array.isArray(manifest.sources) || manifest.sources.length !== 34
    || new Set(manifest.sources.map(({ path }) => path)).size !== 34
    || manifest.sources.reduce((sum, entry) => sum + entry.normalized_record_count, 0) !== 2277
    || manifest.sources.some((entry) =>
      typeof entry.path !== "string" || !/^[a-f0-9]{64}$/u.test(entry.raw_sha256)
      || !Array.isArray(entry.header) || !Array.isArray(entry.selected_columns)
      || !Number.isInteger(entry.data_row_count)
      || entry.normalized_record_count !== entry.data_row_count)) {
    throw new UiuxContractError("SOURCE_MANIFEST_INVALID", "exact 34-source allowlist is required");
  }
}

function sourceBytes(sourceRoot, entry) {
  const path = resolve(sourceRoot, entry.path);
  const rel = relative(sourceRoot, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new UiuxContractError("SOURCE_PATH_INVALID", entry.path);
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new UiuxContractError("SOURCE_PATH_INVALID", entry.path);
  }
  return readFileSync(path);
}

function normalizeSource(bytes, entry) {
  if (bytes.includes(0)) throw new UiuxContractError("SOURCE_CSV_INVALID", `${entry.path}: NUL`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UiuxContractError("SOURCE_CSV_INVALID", `${entry.path}: invalid UTF-8`);
  }
  text = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  if (entry.repair) {
    const approved = entry.path === "src/ui-ux-pro-max/data/stacks/javafx.csv"
      && entry.repair.rule === "backslash_quote_to_rfc4180_double_quote"
      && entry.repair.occurrences === 18 && text.split("\\\"").length - 1 === 18;
    if (!approved) throw new UiuxContractError("SOURCE_REPAIR_INVALID", entry.path);
    text = text.replaceAll("\\\"", "\"\"");
    if (hash(Buffer.from(text)) !== entry.repair.repaired_sha256) {
      throw new UiuxContractError("SOURCE_REPAIR_INVALID", `${entry.path}: repaired hash`);
    }
  }
  return text;
}

function recordsFor(rows, entry) {
  const header = rows[0];
  if (JSON.stringify(header) !== JSON.stringify(entry.header)
    || rows.length - 1 !== entry.data_row_count) {
    throw new UiuxContractError("SOURCE_SHAPE_MISMATCH", entry.path);
  }
  const indexes = entry.selected_columns.map((column) => header.indexOf(column));
  if (indexes.some((index) => index < 0)) {
    throw new UiuxContractError("SOURCE_SHAPE_MISMATCH", `${entry.path}: selected columns`);
  }
  const stack = entry.path.includes("/stacks/") ? basename(entry.path, ".csv") : undefined;
  const domain = stack ? `stack/${stack}` : basename(entry.path, ".csv");
  return rows.slice(1).map((row, offset) => {
    const record = Object.fromEntries(entry.selected_columns.map(
      (column, index) => [column, row[indexes[index]].trim()],
    ));
    const number = Number(record.No);
    if (!Number.isSafeInteger(number) || number < 1 || String(number) !== record.No) {
      throw new UiuxContractError("SOURCE_SHAPE_MISMATCH", `${entry.path}:${offset + 2}`);
    }
    record.No = number;
    record.domain = domain;
    record.record_id = `${domain}/${number}`;
    if (stack) record.stack = stack;
    return record;
  });
}

export function replayPinnedSources(sourceRoot, manifest, packagedPath) {
  const records = [];
  const ids = new Set();
  for (const entry of manifest.sources) {
    const raw = sourceBytes(sourceRoot, entry);
    if (hash(raw) !== entry.raw_sha256) {
      throw new UiuxContractError("SOURCE_HASH_MISMATCH", `${entry.path} hash mismatch`);
    }
    for (const record of recordsFor(parseCsv(normalizeSource(raw, entry), entry.path), entry)) {
      if (ids.has(record.record_id)) {
        throw new UiuxContractError("SOURCE_SHAPE_MISMATCH", `duplicate ${record.record_id}`);
      }
      ids.add(record.record_id);
      records.push(record);
    }
  }
  const bytes = Buffer.from(`${stableJson({
    records,
    schema_version: "litfamily.design-intelligence/v1",
    source_commit: manifest.source.commit,
  })}\n`);
  if (records.length !== DATASET_RECORDS || bytes.length > DATASET_MAX_BYTES
    || hash(bytes) !== DATASET_SHA256 || !readFileSync(packagedPath).equals(bytes)) {
    throw new UiuxContractError("SOURCE_CONTRACT_MISMATCH", "replayed canonical bytes differ");
  }
  return { records: records.length, bytes: bytes.length, sha256: hash(bytes) };
}

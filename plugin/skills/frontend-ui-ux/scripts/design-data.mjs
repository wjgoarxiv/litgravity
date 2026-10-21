import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { UiuxContractError } from "./errors.mjs";
import { readBoundedJson, requireFields } from "./json-boundary.mjs";

export const DATASET_MAX_BYTES = 4 * 1024 * 1024;
export const DATASET_SCHEMA = "litfamily.design-intelligence/v1";
export const DATASET_RECORDS = 2277;
export const DATASET_SHA256 = "a89011236a6ff14e12ec55fccbfab1bbd40ae34614cea5710c022121aa841bb8";

export const defaultDataPath = fileURLToPath(new URL("../data/design-intelligence.json", import.meta.url));
export const defaultProvenancePath = fileURLToPath(new URL("../PROVENANCE.json", import.meta.url));

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseProvenance(path) {
  const parsed = readBoundedJson(path, {
    maxBytes: 256 * 1024,
    invalidCode: "PROVENANCE_INVALID_JSON",
  });
  requireFields(parsed.value, ["canonical_dataset"], "PROVENANCE_SCHEMA_INVALID", "PROVENANCE.json");
  const canonical = parsed.value.canonical_dataset;
  requireFields(
    canonical,
    ["byte_count", "record_count", "schema_version", "sha256"],
    "PROVENANCE_SCHEMA_INVALID",
    "canonical_dataset",
  );
  return canonical;
}

export function loadDesignData({
  dataPath = defaultDataPath,
  provenancePath = defaultProvenancePath,
} = {}) {
  const parsed = readBoundedJson(dataPath, {
    maxBytes: DATASET_MAX_BYTES,
    invalidCode: "DATASET_INVALID_JSON",
  });
  const provenance = parseProvenance(provenancePath);
  const actualHash = sha256(parsed.bytes);
  if (actualHash !== provenance.sha256) {
    throw new UiuxContractError(
      "DATASET_HASH_MISMATCH",
      `dataset SHA-256 ${actualHash} does not match provenance ${provenance.sha256}`,
    );
  }
  requireFields(parsed.value, ["records", "schema_version", "source_commit"], "DATASET_SCHEMA_INVALID", "dataset");
  if (parsed.value.schema_version !== DATASET_SCHEMA || !Array.isArray(parsed.value.records)) {
    throw new UiuxContractError("DATASET_SCHEMA_INVALID", `expected ${DATASET_SCHEMA} records`);
  }
  if (parsed.value.records.length !== provenance.record_count) {
    throw new UiuxContractError(
      "DATASET_RECORD_COUNT_MISMATCH",
      `dataset has ${parsed.value.records.length} records; provenance requires ${provenance.record_count}`,
    );
  }
  return Object.freeze({
    bytes: parsed.bytes.length,
    records: parsed.value.records,
    schema: parsed.value.schema_version,
    sha256: actualHash,
    sourceCommit: parsed.value.source_commit,
  });
}

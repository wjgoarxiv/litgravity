#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  DATASET_MAX_BYTES,
  DATASET_RECORDS,
  DATASET_SHA256,
  loadDesignData,
} from "./design-data.mjs";
import { errorMessage, UiuxContractError } from "./errors.mjs";
import { readBoundedJson } from "./json-boundary.mjs";
import { replayPinnedSources, validateSourceManifest } from "./source-replay.mjs";

const DEFAULT_SKILL_ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMPANIONS = Object.freeze([
  ["LICENSE", "738f69dfa83db5c347c678fb9d90e560877059f0de93a327c39001bff92dc014"],
  ["PROVENANCE.json", "a00be969523fe376a07d310b7418be0c41824f01241294bdf00e82eb4d736e87"],
  ["SOURCE-MANIFEST.json", "9adf471d95aaf17e7866e1c7674cb1a101daae9abdab87c71c96a60f2a58e6fa"],
  ["THIRD-PARTY-NOTICE.txt", "ca1e7d88104177450ff848296cf9340f5f69aa421c4f215673a72a33c03c927e"],
]);

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const options = {};
  const allowed = new Set(["--skill-root", "--source-root", "--expect-records", "--max-bytes"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--check") {
      if (options.check) throw new UiuxContractError("INVALID_ARGUMENT", "duplicate --check");
      options.check = true;
      continue;
    }
    const value = argv[++index];
    if (!allowed.has(flag) || value === undefined || value.length === 0) {
      throw new UiuxContractError("INVALID_ARGUMENT", `invalid importer argument: ${flag ?? ""}`);
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (options[key] !== undefined) throw new UiuxContractError("INVALID_ARGUMENT", `duplicate ${flag}`);
    options[key] = value;
  }
  if (!options.check) throw new UiuxContractError("CHECK_MODE_REQUIRED", "--check is required");
  if (options.sourceRoot
    && (options.expectRecords !== String(DATASET_RECORDS)
      || options.maxBytes !== String(DATASET_MAX_BYTES))) {
    throw new UiuxContractError(
      "INVALID_ARGUMENT",
      `source replay requires --expect-records ${DATASET_RECORDS} --max-bytes ${DATASET_MAX_BYTES}`,
    );
  }
  return options;
}

function verifyCompanions(skillRoot) {
  return COMPANIONS.map(([path, expected]) => {
    const absolutePath = join(skillRoot, path);
    if (!existsSync(absolutePath)) throw new UiuxContractError("COMPANION_MISSING", path);
    const actual = hash(readFileSync(absolutePath));
    if (actual !== expected) {
      throw new UiuxContractError("COMPANION_HASH_MISMATCH", `${path}: ${actual}`);
    }
    return { path, sha256: actual };
  });
}

function loadManifest(manifestPath) {
  const manifest = readBoundedJson(manifestPath, {
    maxBytes: DATASET_MAX_BYTES,
    invalidCode: "SOURCE_MANIFEST_INVALID",
  }).value;
  validateSourceManifest(manifest);
  return manifest;
}

export function runImportCheck(argv) {
  const options = parseArgs(argv);
  const skillRoot = resolve(options.skillRoot ?? DEFAULT_SKILL_ROOT);
  const companions = verifyCompanions(skillRoot);
  const manifestPath = join(skillRoot, "SOURCE-MANIFEST.json");
  const manifest = loadManifest(manifestPath);
  const data = loadDesignData({
    dataPath: join(skillRoot, "data/design-intelligence.json"),
    provenancePath: join(skillRoot, "PROVENANCE.json"),
  });
  if (data.records.length !== DATASET_RECORDS
    || data.bytes > DATASET_MAX_BYTES
    || data.sha256 !== DATASET_SHA256) {
    throw new UiuxContractError("SOURCE_CONTRACT_MISMATCH", "packaged corpus is outside contract");
  }
  const replay = options.sourceRoot
    ? replayPinnedSources(realpathSync(resolve(options.sourceRoot)), manifest, join(skillRoot, "data/design-intelligence.json"))
    : null;
  return {
    schema_id: "litfamily.design-intelligence-import-check/v1",
    status: "PASS",
    dataset: {
      schema_version: data.schema,
      record_count: data.records.length,
      byte_count: data.bytes,
      sha256: data.sha256,
      source_commit: data.sourceCommit,
    },
    companions,
    replay,
  };
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(runImportCheck(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    const code = error instanceof UiuxContractError ? error.code : "SOURCE_CONTRACT_FAILED";
    process.stderr.write(`${code}: ${errorMessage(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main();

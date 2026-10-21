#!/usr/bin/env node
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadDesignData } from "./design-data.mjs";
import { errorMessage, UiuxContractError } from "./errors.mjs";
import { normalizeQuery, searchRecords } from "./search.mjs";

const QUERY_MAX_BYTES = 4096;
const OUTPUT_MAX_BYTES = 256 * 1024;
const RESULT_MAX = 20;

function parseArgs(argv) {
  const options = { limit: 5, minScore: 0.000001, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--json") {
      options.json = true;
      continue;
    }
    if (!["--query", "--domain", "--limit", "--min-score", "--data", "--provenance"].includes(flag)) {
      throw new UiuxContractError("INVALID_ARGUMENT", `unknown argument ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined) throw new UiuxContractError("INVALID_ARGUMENT", `${flag} requires a value`);
    options[flag.slice(2).replace("-", "")] = value;
    index += 1;
  }
  return options;
}

function positiveNumber(value, fallback, maximum, label, { integer = false } = {}) {
  if (value !== undefined && typeof value !== "number" && (value.trim() !== value
    || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
    || (integer && !/^[1-9]\d*$/u.test(value)))) {
    throw new UiuxContractError("INVALID_ARGUMENT", `${label} has invalid numeric syntax`);
  }
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) {
    throw new UiuxContractError("INVALID_ARGUMENT", `${label} must be greater than 0 and at most ${maximum}`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new UiuxContractError("INVALID_ARGUMENT", `${label} must be an integer`);
  }
  return parsed;
}

export function runQuery(argv) {
  const options = parseArgs(argv);
  if (typeof options.query !== "string" || typeof options.domain !== "string") {
    throw new UiuxContractError("INVALID_ARGUMENT", "--query and --domain are required");
  }
  const queryBytes = Buffer.byteLength(options.query, "utf8");
  if (queryBytes > QUERY_MAX_BYTES) {
    throw new UiuxContractError(
      "QUERY_TOO_LARGE",
      `query is ${queryBytes} bytes; maximum is 4096 bytes`,
    );
  }
  const query = normalizeQuery(options.query);
  if (query.length === 0) throw new UiuxContractError("QUERY_EMPTY", "--query must contain searchable text");
  const limit = positiveNumber(options.limit, 5, RESULT_MAX, "--limit", { integer: true });
  const minScore = positiveNumber(options.minscore, 0.000001, 1_000_000, "--min-score");
  const data = loadDesignData({
    dataPath: options.data,
    provenancePath: options.provenance,
  });
  const domains = new Set(data.records.map((record) => record.domain));
  if (!domains.has(options.domain)) {
    throw new UiuxContractError("UNKNOWN_DOMAIN", `unknown design-intelligence domain: ${options.domain}`);
  }
  const results = searchRecords(data.records, {
    query,
    domain: options.domain,
    limit,
    minScore,
  }).map((record) => ({ ...record, dataset_sha256: data.sha256 }));
  const report = {
    schema_id: "litfamily.design-intelligence-query/v1alpha1",
    status: results.length === 0 ? "NO_RESULTS" : "RESULTS",
    query: options.query,
    normalized_query: query,
    domain: options.domain,
    dataset_sha256: data.sha256,
    fallback: false,
    results,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (Buffer.byteLength(output) > OUTPUT_MAX_BYTES) {
    throw new UiuxContractError("OUTPUT_TOO_LARGE", `query output exceeds ${OUTPUT_MAX_BYTES} bytes`);
  }
  return output;
}

function main() {
  try {
    process.stdout.write(runQuery(process.argv.slice(2)));
  } catch (error) {
    const code = error instanceof UiuxContractError ? error.code : "QUERY_FAILED";
    process.stderr.write(`${code}: ${errorMessage(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main();

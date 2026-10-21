#!/usr/bin/env node
// Validate one litfamily.design-contract/v1alpha1 artifact.
//
// Exit-code contract:
//   0  the contract is valid. stdout carries exactly one line of JSON with the keys
//      valid, schema, and issues (an empty array). stderr stays empty.
//   1  the bytes parsed but the contract is invalid. stdout carries the same one-line
//      envelope with valid false and a populated issues array, so a caller can machine-read
//      every defect from a single run.
//   2  the input could not be trusted at all: missing, non-regular, oversize, non-UTF-8,
//      malformed JSON, or carrying duplicate object keys. A human-readable line goes to
//      stderr and stdout stays empty, because there is nothing trustworthy to report.
//
// The code is always assigned to process.exitCode and never passed to process.exit(). An
// immediate exit can discard a buffered stdout write when stdout is a pipe, which would turn
// a populated exit-1 envelope into silence. Assigning the code lets Node flush and then exit.
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { errorMessage, UiuxContractError } from "./errors.mjs";
import { readDesignContract } from "./design-contract-format.mjs";
import { designContractReport } from "./design-contract-rules.mjs";

const USAGE = "usage: validate-design-contract <design-contract.json>";

export function validateDesignContract(path) {
  const { value } = readDesignContract(path);
  return designContractReport(value);
}

function main() {
  const [path, ...extra] = process.argv.slice(2);
  if (typeof path !== "string" || path.length === 0 || extra.length > 0) {
    process.stderr.write(`INVALID_ARGUMENT: ${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  let report;
  try {
    report = validateDesignContract(path);
  } catch (error) {
    const code = error instanceof UiuxContractError ? error.code : "DESIGN_CONTRACT_UNTRUSTED_INPUT";
    process.stderr.write(`${code}: ${errorMessage(error)}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.valid ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main();

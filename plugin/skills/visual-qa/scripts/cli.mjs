#!/usr/bin/env node
import {
  closeSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validateEvidence, validateReviewReceipt } from "./evidence.mjs";
import { messageOf, VisualQaError } from "./errors.mjs";
import { diffImages } from "./image-diff.mjs";
import { hasRegularAncestors, readBoundRegularFile } from "./evidence-io.mjs";
import { PNG_MAX_BYTES } from "./png-chunks.mjs";
import { decodePng } from "./png-decode.mjs";
import { checkTui, TUI_MAX_BYTES } from "./tui-check.mjs";

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function readPng(path) {
  if (!path) throw new VisualQaError("INVALID_ARGUMENT", "image path is required");
  try {
    if (!hasRegularAncestors(path)) throw new Error("PNG path has a symlinked or non-directory ancestor");
    return decodePng(readBoundRegularFile(path, PNG_MAX_BYTES));
  } catch (error) {
    if (error instanceof VisualQaError) throw error;
    if (error instanceof Error && error.message === "input exceeds bounds") {
      throw new VisualQaError("PNG_FILE_TOO_LARGE", "PNG_FILE_TOO_LARGE: maximum 25 MiB");
    }
    throw new VisualQaError("PNG_FILE_INVALID", `PNG_FILE_INVALID: ${messageOf(error)}`);
  }
}

function imageDiff(args) {
  if (!args[0] || !args[1]) {
    throw new VisualQaError("INVALID_ARGUMENT", "usage: image-diff <reference.png> <actual.png>");
  }
  return diffImages(readPng(args[0]), readPng(args[1]));
}

function tuiCheck(args) {
  const path = args[0];
  const columns = Number(valueAfter(args, "--cols") ?? 80);
  if (!path || !Number.isInteger(columns) || columns < 1) {
    throw new VisualQaError("INVALID_ARGUMENT", "usage: tui-check <capture.txt> --cols <positive integer>");
  }
  if (statSync(path).size > TUI_MAX_BYTES) {
    throw new VisualQaError("TUI_INPUT_TOO_LARGE", "TUI capture exceeds the 1 MiB byte limit");
  }
  const file = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(TUI_MAX_BYTES + 1);
    let length = 0;
    while (length <= TUI_MAX_BYTES) {
      const count = readSync(file, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length > TUI_MAX_BYTES) {
      throw new VisualQaError("TUI_INPUT_TOO_LARGE", "TUI capture exceeds the 1 MiB byte limit");
    }
    return checkTui(buffer.subarray(0, length).toString("utf8"), columns);
  } finally {
    closeSync(file);
  }
}

export function run(argv) {
  const [command, ...args] = argv;
  if (command === "image-diff") return imageDiff(args);
  if (command === "tui-check") return tuiCheck(args);
  if (command === "validate-evidence") {
    return validateEvidence(args[0], {
      tier: valueAfter(args, "--tier"),
      now: valueAfter(args, "--now"),
      currentSourceHash: valueAfter(args, "--current-source-hash"),
      currentSourceRevision: valueAfter(args, "--current-source-revision"),
    });
  }
  if (command === "validate-review") return validateReviewReceipt(args[0]);
  throw new VisualQaError("INVALID_ARGUMENT", `unknown command: ${command ?? ""}`);
}

function main() {
  try {
    const report = run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.verdict && report.verdict !== "PASS") process.exitCode = 2;
  } catch (error) {
    const code = error instanceof VisualQaError ? error.code : "VISUAL_QA_FAILED";
    process.stderr.write(`${code}: ${messageOf(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main();

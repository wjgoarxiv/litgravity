#!/usr/bin/env node
// lit-humanizer detector for LitGravity. Reads Markdown, plain text and similar files directly, DOCX and PPTX
// through the stdlib Python extractor, PDF through pdftotext. Findings are wording signals for an editor;
// they say nothing about who wrote a text.
// Exit codes: 0 no findings, 1 findings (the summary line splits block and warn), 2 usage or extraction error.
import { lstatSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractArtifactText } from "./artifact-text.mjs";
import { parseRules, scanNegationClusters, scanText } from "./core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const usage = "Usage: node scripts/detect.mjs [--json] [--rules FILE] [FILE ...] (use - or omit FILE to read stdin)";

class UsageError extends Error {}

const readRegular = (file) => {
  const info = lstatSync(file);
  if (info.isSymbolicLink()) throw new Error("refusing a symbolic link");
  if (!info.isFile()) throw new Error("not a regular file");
  return readFileSync(file);
};

const contentFor = (file) => file === "-"
  ? readFileSync(0, "utf8")
  : extractArtifactText(extname(file), readRegular(file));

const main = () => {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  if (args.includes("--help")) {
    process.stdout.write(`${usage}\n`);
    return 0;
  }
  let rulesPath = resolve(here, "../rules.json");
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") continue;
    if (arg === "--rules") {
      index += 1;
      if (!args[index]) throw new UsageError("--rules requires a path");
      rulesPath = resolve(args[index]);
    } else if (arg.startsWith("--")) throw new UsageError(`unknown option: ${arg}`);
    else files.push(arg);
  }
  if (files.length === 0) files.push("-");
  const rules = parseRules(readRegular(rulesPath).toString("utf8"));
  const findings = [];
  const errors = [];
  const scanned = [];
  for (const file of files) {
    try {
      const text = contentFor(file);
      findings.push(...scanText(text, rules, file), ...scanNegationClusters(text, file));
      scanned.push(file);
    } catch (error) {
      errors.push({ file, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const block = findings.filter((item) => item.severity === "block").length;
  const warn = findings.filter((item) => item.severity === "warn").length;
  if (json) process.stdout.write(`${JSON.stringify({ scanned, summary: { block, warn }, findings, errors }, null, 2)}\n`);
  else {
    for (const item of findings) process.stdout.write(`${item.file}:${item.line}: ${item.severity} ${item.rule}: ${item.excerpt}\n`);
    for (const item of errors) process.stderr.write(`${item.file}: error: ${item.message}\n`);
    process.stdout.write(`Scanned ${scanned.length} file(s): ${block} block, ${warn} warning hit(s)${errors.length ? `, ${errors.length} unchecked` : ""}.\n`);
  }
  if (errors.length) return 2;
  return findings.length ? 1 : 0;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${usage}\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}

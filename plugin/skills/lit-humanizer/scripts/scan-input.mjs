#!/usr/bin/env node
// Bounded JSON-in, JSON-out scanner for callers that hold text in memory (a hook, a test, a wrapper).
// stdin: {"artifacts":[{"path":"docs/a.md","text":"...","changed":[[3,9]]}]}  (at most 16 artifacts, 2 MiB in total)
// stdout: {"findings":[...],"total":N}. Exit 0 on a completed scan (read the findings), 2 on bad or oversized input.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRules, scanNegationClusters, scanText } from "./core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACTS = 16;
// Callers read this output through a bounded pipe. A flood of repeated hits must stay under that bound,
// because an overflowing pipe looks like a scanner failure to the caller.
const MAX_FINDINGS = 64;

// Every block finding is kept ahead of warnings so trimming can never drop a block; scan order is then restored.
const boundFindings = (findings) => {
  if (findings.length <= MAX_FINDINGS) return findings;
  const indexed = findings.map((finding, index) => ({ finding, index }));
  const blocks = indexed.filter(({ finding }) => finding.severity === "block");
  const others = indexed.filter(({ finding }) => finding.severity !== "block");
  return [...blocks, ...others].slice(0, MAX_FINDINGS).sort((a, b) => a.index - b.index).map(({ finding }) => finding);
};

// An edit is scanned as the whole proposed file so fences, quotes and paragraph breaks keep their meaning.
// `changed` lists the edited 1-based line ranges; only findings touching one survive. A document-scope finding
// carries the lines its occurrences sit on, so an edit between two old occurrences leaves it out. The filter
// runs before the bound, so findings on untouched lines cannot crowd out a new one.
const touchesChange = (finding, changed) => changed.some(([start, end]) => (Array.isArray(finding.lines)
  ? finding.lines.some((line) => line >= start && line <= end)
  : finding.line <= end && (finding.endLine ?? finding.line) >= start));

try {
  const raw = readFileSync(0);
  if (raw.length > MAX_INPUT_BYTES) throw new Error("input exceeds the bounded scan size");
  const request = JSON.parse(raw.toString("utf8"));
  if (!Array.isArray(request.artifacts) || request.artifacts.length > MAX_ARTIFACTS) throw new Error("invalid artifact list");
  let totalBytes = 0;
  const rules = parseRules(readFileSync(resolve(here, "../rules.json"), "utf8"));
  const findings = [];
  for (const artifact of request.artifacts) {
    if (typeof artifact?.text !== "string" || typeof artifact?.path !== "string") throw new Error("invalid artifact record");
    totalBytes += Buffer.byteLength(artifact.text, "utf8");
    if (totalBytes > MAX_INPUT_BYTES) throw new Error("aggregate content exceeds the bounded scan size");
    const changed = artifact.changed;
    if (changed !== undefined && (!Array.isArray(changed) || !changed.every((range) => Array.isArray(range)
      && range.length === 2 && range.every(Number.isInteger)))) throw new Error("invalid changed ranges");
    const hits = [...scanText(artifact.text, rules, artifact.path), ...scanNegationClusters(artifact.text, artifact.path)];
    findings.push(...(changed ? hits.filter((finding) => touchesChange(finding, changed)) : hits));
  }
  process.stdout.write(`${JSON.stringify({ findings: boundFindings(findings), total: findings.length })}\n`);
} catch {
  process.stderr.write("lit-humanizer scanner failed: expected {\"artifacts\":[{\"path\",\"text\",\"changed\"?}]} within 16 artifacts and 2 MiB\n");
  process.exitCode = 2;
}

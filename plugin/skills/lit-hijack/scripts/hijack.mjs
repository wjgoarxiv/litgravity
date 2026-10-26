#!/usr/bin/env node
// lit-hijack run helper for LitGravity. Captures sources with provenance, applies the licence
// table, finds verbatim carry-over, builds the implementer brief from the spec alone, and checks
// each phase of a run folder. Zero dependencies: Node built-ins plus git and pdftotext on PATH.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { isIP, isIPv4, isIPv6 } from "node:net";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

export const LEDGER_SCHEMA = "litgravity.hijack-ledger.v1";
export const PHASES = Object.freeze(["frame", "capture", "licence", "distil", "gap", "spec", "build", "parity", "report"]);
const KINDS = new Set(["x-post", "x-article", "github-repo", "gist", "web", "pdf", "video", "file"]);
const DECISIONS = new Set(["ideas-credit", "ideas-only", "no-go"]);
const EVIDENCE = new Set(["evidenced", "anecdotal", "opinion"]);
const GAP_STATUS = new Set(["has", "weak", "lacks"]);
const PORT = new Set(["take", "adapt", "leave"]);
const DEFAULT_MIN_WORDS = 12;
const FETCH_LIMIT = 20 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".rst", ".json", ".yaml", ".yml", ".toml", ".mjs", ".js", ".cjs", ".ts", ".tsx",
  ".jsx", ".py", ".sh", ".zsh", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".cs", ".lua",
  ".html", ".css", ".scss", ".svelte", ".vue", ".sql", ".tex", ".ipynb", "",
]);

// ---------------------------------------------------------------------------------------------
// Capture helpers

export const parseXStatusUrl = (url) => {
  const match = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/(\d+)/u.exec(String(url ?? "").trim());
  return match ? match[1] : null;
};

const toIso = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const entityLookup = (entityMap) => {
  const entries = Array.isArray(entityMap)
    ? entityMap
    : Object.entries(entityMap ?? {}).map(([key, value]) => ({ key, value }));
  return new Map(entries.map((entry) => [String(entry.key), entry.value]));
};

const blockLine = (block, entities) => {
  const text = block.text ?? "";
  switch (block.type) {
    case "header-one": return `## ${text}`;
    case "header-two": return `### ${text}`;
    case "header-three": return `#### ${text}`;
    case "unordered-list-item": return `- ${text}`;
    case "ordered-list-item": return `1. ${text}`;
    case "blockquote": return `> ${text}`;
    case "code-block": return `\`\`\`\n${text}\n\`\`\``;
    case "atomic": {
      const entity = entities.get(String(block.entityRanges?.[0]?.key));
      if (entity?.type === "MARKDOWN" && typeof entity.data?.markdown === "string") return entity.data.markdown;
      if (entity?.type === "DIVIDER") return "---";
      return "[media]";
    }
    default: return text;
  }
};

// fxtwitter returns a post, and for a long-form X article also its Draft.js-style block list.
export const fxtwitterToMarkdown = (json) => {
  const tweet = json?.tweet;
  if (!tweet || typeof tweet !== "object") throw new Error("fxtwitter response carries no tweet");
  const handle = tweet.author?.screen_name;
  const author = handle ? `${tweet.author.name ?? handle} (@${handle})` : "unknown";
  const published = toIso(tweet.created_at) ?? "unknown";
  const blocks = tweet.article?.content?.blocks;
  const lines = [];
  let kind = "x-post";
  let title = null;
  if (Array.isArray(blocks)) {
    kind = "x-article";
    title = tweet.article.title ?? "Untitled article";
    const entities = entityLookup(tweet.article.content.entityMap);
    lines.push(`# ${title}`, "", `source: ${tweet.url}`, "");
    for (const block of blocks) lines.push(blockLine(block, entities), "");
  } else {
    lines.push(`# Post by ${author}`, "", `source: ${tweet.url}`, "", tweet.text ?? "", "");
  }
  if (tweet.quote?.text) lines.push("## Quoted post", "", `source: ${tweet.quote.url ?? "unknown"}`, "", tweet.quote.text, "");
  return { markdown: `${lines.join("\n").trimEnd()}\n`, meta: { kind, author, published, title, url: tweet.url ?? null, id: tweet.id ?? null } };
};

const decodeEntities = (text) => text
  .replace(/&nbsp;/gu, " ")
  .replace(/&amp;/gu, "&")
  .replace(/&lt;/gu, "<")
  .replace(/&gt;/gu, ">")
  .replace(/&quot;/gu, "\"")
  .replace(/&#39;|&apos;/gu, "'")
  .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)));

export const htmlToText = (html) => decodeEntities(String(html)
  .replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/giu, " ")
  .replace(/<h([1-6])\b[^>]*>/giu, (_, level) => `\n\n${"#".repeat(Number(level))} `)
  .replace(/<li\b[^>]*>/giu, "\n- ")
  .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/pre|\/blockquote|\/tr)\b[^>]*>/giu, "\n")
  .replace(/<[^>]+>/gu, " "))
  .replace(/[ \t]+/gu, " ")
  .replace(/\n\s*\n\s*\n+/gu, "\n\n")
  .trim();

const metaContent = (html, pattern) => {
  const match = pattern.exec(html);
  return match ? decodeEntities(match[1]).trim() : null;
};

// ---------------------------------------------------------------------------------------------
// Licence table

const LICENCE_PATTERNS = [
  ["AGPL-3.0", /GNU AFFERO GENERAL PUBLIC LICENSE/iu],
  ["LGPL-3.0", /GNU LESSER GENERAL PUBLIC LICENSE[\s\S]{0,120}?Version 3/iu],
  ["LGPL-2.1", /GNU (?:LESSER|LIBRARY) GENERAL PUBLIC LICENSE/iu],
  ["GPL-3.0", /GNU GENERAL PUBLIC LICENSE[\s\S]{0,120}?Version 3/iu],
  ["GPL-2.0", /GNU GENERAL PUBLIC LICENSE[\s\S]{0,120}?Version 2/iu],
  ["MPL-2.0", /Mozilla Public License[\s\S]{0,40}?2\.0/iu],
  ["Apache-2.0", /Apache License[\s\S]{0,40}?Version 2\.0/iu],
  ["Unlicense", /free and unencumbered software released into the public domain/iu],
  ["CC0-1.0", /CC0 1\.0|Creative Commons Zero|creativecommons\.org\/publicdomain\/zero/iu],
  ["ISC", /Permission to use, copy, modify, and\/or distribute this software for any purpose/iu],
  ["MIT", /Permission is hereby granted, free of charge/iu],
];

const ccFromParts = (parts, version) => `CC-BY${parts.nc ? "-NC" : ""}${parts.sa ? "-SA" : ""}${parts.nd ? "-ND" : ""}-${version ?? "4.0"}`;

export const detectLicence = (text) => {
  const body = String(text ?? "");
  const spdxLine = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+-]+)*)/u.exec(body);
  if (spdxLine) return { spdx: spdxLine[1], evidence: spdxLine[0].trim() };
  const packageField = /"license"\s*:\s*"([^"]+)"/u.exec(body);
  if (packageField) return { spdx: packageField[1], evidence: packageField[0] };
  const ccUrl = /creativecommons\.org\/licenses\/(by(?:-nc)?(?:-sa|-nd)?)\/(\d\.\d)/iu.exec(body);
  if (ccUrl) return { spdx: `CC-${ccUrl[1].toUpperCase()}-${ccUrl[2]}`, evidence: ccUrl[0] };
  const ccName = /creative\s+commons\s+attribution((?:[-\s]+(?:non-?commercial|share-?alike|no-?derivatives|no-?derivs))*)(?:\s+(\d\.\d))?/iu.exec(body);
  if (ccName) {
    const words = ccName[1].toLowerCase();
    return {
      spdx: ccFromParts({ nc: /non-?commercial/u.test(words), sa: /share-?alike/u.test(words), nd: /no-?deriv/u.test(words) }, ccName[2]),
      evidence: ccName[0].trim(),
    };
  }
  for (const [spdx, pattern] of LICENCE_PATTERNS) {
    const match = pattern.exec(body);
    if (match) return { spdx, evidence: match[0].replace(/\s+/gu, " ").slice(0, 100) };
  }
  if (/Redistribution and use in source and binary forms/iu.test(body)) {
    return /Neither the name/iu.test(body)
      ? { spdx: "BSD-3-Clause", evidence: "BSD redistribution clause with the no-endorsement clause" }
      : { spdx: "BSD-2-Clause", evidence: "BSD redistribution clause" };
  }
  return { spdx: "NOASSERTION", evidence: "no licence text found" };
};

const PROHIBITION = /\b(?:do not|don't|may not|must not)\s+(?:copy|reproduce|adapt|redistribute|reuse|republish|repost)\b|\bno part of this (?:work|publication|book|guide|document|course)\b|\b(?:confidential|internal use only|not for (?:re)?distribution|source[- ]available|proprietary)\b/iu;
// Reuse terms count only on lines about rights. An article that tells its readers "do not copy the
// reference's layout" is giving advice about its subject, not setting terms for itself.
const RIGHTS_LINE = /copyright|©|\(c\)\s*\d{4}|licen[cs]e|all rights|permission|terms of (?:use|service)|reproduc|redistribut|republish|derivative|confidential|proprietary|source[- ]available|no part of this/iu;
const rightsLines = (text) => String(text).split("\n").filter((line) => RIGHTS_LINE.test(line)).join("\n");
const PERMISSIVE = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "Zlib", "0BSD", "Unlicense", "CC0-1.0", "BSL-1.0", "Python-2.0"]);

// Ideas, methods and procedures are not protected expression, so every class may give up mechanisms.
// The class decides only whether the target ships a credit line and how strictly the build is fenced.
export const decideLicence = (spdx, { text } = {}) => {
  const id = String(spdx ?? "NOASSERTION").trim();
  const terms = text ? rightsLines(text) : "";
  if (terms && PROHIBITION.test(terms)) {
    return { decision: "needs-review", class: "restricted-terms", reason: `the source states reuse terms ("${PROHIBITION.exec(terms)[0]}"); a person decides ideas-only or no-go` };
  }
  if (PERMISSIVE.has(id)) return { decision: "ideas-credit", class: "permissive", reason: `${id} permits reuse; take mechanisms only and ship a credit line` };
  if (/^CC-BY-(?:NC|ND)/u.test(id) || /^CC-BY-NC/u.test(id)) return { decision: "ideas-only", class: "restricted", reason: `${id} bars commercial use or sharing adaptations; take mechanisms only, never wording` };
  if (/^CC-BY-SA/u.test(id) || /^(?:A|L)?GPL|^MPL|^EPL|^EUPL|^CDDL/u.test(id)) {
    return { decision: "ideas-only", class: "copyleft", reason: `${id} is copyleft; take mechanisms only and keep the implementer away from the source` };
  }
  if (/^CC-BY-\d/u.test(id)) return { decision: "ideas-credit", class: "attribution", reason: `${id} asks for credit; take mechanisms only and ship a credit line` };
  if (id === "NOASSERTION" || id === "") return { decision: "ideas-only", class: "unlicensed", reason: "no licence grant: all rights reserved, so take mechanisms only and credit in the report" };
  return { decision: "ideas-only", class: "unrecognised", reason: `${id} is not in the table; treated as all rights reserved` };
};

// ---------------------------------------------------------------------------------------------
// Overlap gate

const WORD = /[\p{L}\p{N}]+/gu;

const wordsWithLines = (text) => {
  const body = String(text ?? "").normalize("NFKC");
  const out = [];
  let line = 1;
  let cursor = 0;
  for (const match of body.matchAll(WORD)) {
    for (let index = cursor; index < match.index; index += 1) if (body.charCodeAt(index) === 10) line += 1;
    cursor = match.index;
    out.push({ word: match[0].toLowerCase(), line });
  }
  return out;
};

export const findOverlap = ({ sources, targets, minWords = DEFAULT_MIN_WORDS }) => {
  const size = Math.max(4, Number(minWords) || DEFAULT_MIN_WORDS);
  const index = new Map();
  for (const source of sources) {
    const words = wordsWithLines(source.text).map((token) => token.word);
    for (let start = 0; start + size <= words.length; start += 1) {
      const key = words.slice(start, start + size).join(" ");
      if (!index.has(key)) index.set(key, source.id);
    }
  }
  const runs = [];
  for (const target of targets) {
    const tokens = wordsWithLines(target.text);
    const keyAt = (start) => tokens.slice(start, start + size).map((token) => token.word).join(" ");
    let start = 0;
    while (start + size <= tokens.length) {
      const source = index.get(keyAt(start));
      if (!source) {
        start += 1;
        continue;
      }
      let next = start + 1;
      while (next + size <= tokens.length && index.has(keyAt(next))) next += 1;
      const words = next - 1 - start + size;
      runs.push({
        path: target.path,
        line: tokens[start].line,
        words,
        source,
        excerpt: `${tokens.slice(start, start + 6).map((token) => token.word).join(" ")} …`,
      });
      start += words;
    }
  }
  return runs;
};

const headingSet = (text) => new Set(String(text ?? "").split("\n")
  .filter((line) => /^#{1,6}\s+\S/u.test(line))
  .map((line) => wordsWithLines(line).map((token) => token.word).join(" "))
  .filter((heading) => heading.split(" ").length >= 2));

const sharedHeadings = (sources, target) => {
  return sources
    .map((source) => ({ source: source.id, shared: [...headingSet(source.text)].filter((heading) => headingSet(target.text).has(heading)) }))
    .filter((entry) => entry.shared.length >= 3);
};

// ---------------------------------------------------------------------------------------------
// Run folder

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const nowIso = () => new Date().toISOString();
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const ledgerPath = (run) => join(run, "ledger.json");
const loadLedger = (run) => readJson(ledgerPath(run));
const fromRun = (run, path) => (isAbsolute(path) ? path : join(run, path));
const fromTarget = (ledger, path) => (isAbsolute(path) ? path : join(ledger.target?.root ?? "", path));
const filled = (value) => typeof value === "string" && value.trim().length > 0;
const takenMechanisms = (ledger) => (ledger.mechanisms ?? []).filter((mechanism) => ["take", "adapt"].includes(mechanism.port?.decision));

const isTextFile = (path) => {
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) return false;
  const stats = statSync(path);
  if (stats.size > 512 * 1024) return false;
  return !readFileSync(path).subarray(0, 4096).includes(0);
};

const walkText = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "build", "vendor", ".venv"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkText(path, out);
    else if (entry.isFile() && isTextFile(path)) out.push(path);
  }
  return out;
};

// Every captured text a run holds, so the overlap gate compares against all of it.
export const sourceTexts = (run, ledger = loadLedger(run)) => {
  const texts = [];
  for (const source of ledger.sources ?? []) {
    for (const file of source.files ?? []) {
      const path = fromRun(run, file.path);
      if (!existsSync(path)) continue;
      if (statSync(path).isDirectory()) {
        for (const inner of walkText(path)) texts.push({ id: source.id, text: readFileSync(inner, "utf8") });
      } else if (isTextFile(path) && !/raw\.(?:json|html)$/u.test(path)) {
        texts.push({ id: source.id, text: readFileSync(path, "utf8") });
      }
    }
  }
  return texts;
};

const lineCount = (text) => {
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.length - 1 : lines.length;
};

// A gap claim cites the target as it was before the port, so a ref resolves against the base
// revision when the target is a git checkout and against the working tree otherwise.
const baseText = (ledger, path) => {
  const root = ledger.target?.root;
  const base = ledger.target?.base_ref;
  if (root && base && /^[0-9a-f]{7,40}$/iu.test(base)) {
    const shown = spawnSync("git", ["-C", root, "show", `${base}:${path}`], { encoding: "utf8" });
    if (shown.status === 0) return shown.stdout;
  }
  const full = fromTarget(ledger, path);
  return existsSync(full) && statSync(full).isFile() ? readFileSync(full, "utf8") : null;
};

const sourceMentions = (ledger) => [
  /(?:^|[\s(`'"/])sources\/S\d+/u,
  ...(ledger.sources ?? []).map((source) => source.url).filter(filled).map((url) => url.replace(/[?#].*$/u, "")),
];

const namesSources = (ledger, text) => sourceMentions(ledger).find((mention) => (
  mention instanceof RegExp ? mention.test(text) : text.includes(mention)
));

const overlapIssues = (run, ledger, files, minWords) => {
  const sources = sourceTexts(run, ledger);
  const targets = files.map(({ label, path }) => ({ path: label, text: readFileSync(path, "utf8") }));
  const issues = findOverlap({ sources, targets, minWords }).map((hit) => `${hit.path}:${hit.line} copies ${hit.words} words from ${hit.source} ("${hit.excerpt}"); rewrite it in your own words`);
  const warnings = targets.flatMap((target) => sharedHeadings(sources, target).map((entry) => `${target.path} shares ${entry.shared.length} headings with ${entry.source}; check that the structure is your own`));
  return { issues, warnings };
};

const checkPhase = {
  frame(run, ledger, issues) {
    if (ledger.schema !== LEDGER_SCHEMA) issues.push(`ledger.json schema is not ${LEDGER_SCHEMA}`);
    if (!["existing", "new"].includes(ledger.target?.kind)) issues.push("target.kind must be existing or new");
    if (!filled(ledger.target?.root) || !existsSync(ledger.target.root)) issues.push("target.root is missing or does not exist");
    if (ledger.target?.kind === "existing" && !filled(ledger.target?.base_ref)) issues.push("target.base_ref is missing: record the revision the gap analysis reads");
  },
  capture(run, ledger, issues) {
    const sources = ledger.sources ?? [];
    if (sources.length === 0) issues.push("no source captured");
    const ids = new Set();
    for (const source of sources) {
      const id = source.id ?? "?";
      if (!/^S\d+$/u.test(id) || ids.has(id)) issues.push(`${id}: id must be S<n> and unique`);
      ids.add(id);
      if (!KINDS.has(source.kind)) issues.push(`${id}: kind ${source.kind} is not one of ${[...KINDS].join(", ")}`);
      if (!filled(source.url) && !filled(source.path)) issues.push(`${id}: url or path missing`);
      for (const field of ["author", "published", "retrieved_at"]) if (!filled(source[field])) issues.push(`${id}: ${field} missing`);
      if (!filled(source.licence?.spdx)) issues.push(`${id}: licence.spdx missing (use NOASSERTION when none is stated)`);
      if (!Array.isArray(source.files) || source.files.length === 0) issues.push(`${id}: no captured file`);
      for (const file of source.files ?? []) {
        const path = fromRun(run, file.path ?? "");
        if (!file.path || !existsSync(path)) {
          issues.push(`${id}: ${file.path} is missing`);
        } else if (file.commit) {
          const head = spawnSync("git", ["-C", path, "rev-parse", "HEAD"], { encoding: "utf8" });
          if (head.status !== 0 || head.stdout.trim() !== file.commit) issues.push(`${id}: ${file.path} is not at the captured commit ${file.commit}`);
        } else if (statSync(path).isFile() && sha256(readFileSync(path)) !== file.sha256) {
          issues.push(`${id}: ${file.path} sha256 mismatch; the capture changed after it was recorded`);
        }
      }
    }
  },
  licence(run, ledger, issues) {
    for (const source of ledger.sources ?? []) {
      const decision = source.licence?.decision;
      if (decision === "needs-review") issues.push(`${source.id}: licence needs a person's decision (${source.licence.reason ?? "reuse terms found"}); record it with hijack.mjs licence --set`);
      else if (!DECISIONS.has(decision)) issues.push(`${source.id}: licence.decision must be one of ${[...DECISIONS].join(", ")}`);
    }
  },
  distil(run, ledger, issues) {
    const mechanisms = ledger.mechanisms ?? [];
    if (mechanisms.length === 0) issues.push("no mechanism distilled");
    const sourceIds = new Set((ledger.sources ?? []).map((source) => source.id));
    const ids = new Set();
    for (const mechanism of mechanisms) {
      const id = mechanism.id ?? "?";
      if (!/^M\d+$/u.test(id) || ids.has(id)) issues.push(`${id}: id must be M<n> and unique`);
      ids.add(id);
      for (const field of ["title", "locator", "what", "why"]) if (!filled(mechanism[field])) issues.push(`${id}: ${field} missing`);
      if (!EVIDENCE.has(mechanism.evidence)) issues.push(`${id}: evidence must be evidenced, anecdotal or opinion`);
      if (!Array.isArray(mechanism.sources) || mechanism.sources.length === 0) issues.push(`${id}: names no source`);
      for (const source of mechanism.sources ?? []) if (!sourceIds.has(source)) issues.push(`${id}: source ${source} is not in the ledger`);
    }
  },
  gap(run, ledger, issues) {
    const decisions = new Map((ledger.sources ?? []).map((source) => [source.id, source.licence?.decision]));
    for (const mechanism of ledger.mechanisms ?? []) {
      const id = mechanism.id;
      const gap = mechanism.gap ?? {};
      if (!GAP_STATUS.has(gap.status)) issues.push(`${id}: gap.status must be has, weak or lacks`);
      const refs = Array.isArray(gap.refs) ? gap.refs : [];
      if (ledger.target?.kind === "existing" && ["has", "weak"].includes(gap.status) && refs.length === 0) issues.push(`${id}: gap ${gap.status} needs at least one path:line ref`);
      if (ledger.target?.kind === "existing" && gap.status === "lacks" && refs.length === 0 && !filled(gap.searched)) issues.push(`${id}: gap lacks needs gap.searched (what was searched and where)`);
      for (const ref of refs) {
        const match = /^(.+?):(\d+)(?:-(\d+))?$/u.exec(String(ref));
        const text = match ? baseText(ledger, match[1]) : null;
        const last = match ? Number(match[3] ?? match[2]) : 0;
        if (!match || text === null || last < 1 || last > lineCount(text)) {
          issues.push(`${id}: gap ref ${ref} does not resolve${text === null ? "" : ` (file has ${lineCount(text)} lines)`}`);
        }
      }
      const port = mechanism.port ?? {};
      if (!PORT.has(port.decision)) issues.push(`${id}: port.decision must be take, adapt or leave`);
      if (!filled(port.reason)) issues.push(`${id}: port.reason missing`);
      if (["take", "adapt"].includes(port.decision)) {
        const usable = (mechanism.sources ?? []).filter((source) => decisions.get(source) !== "no-go");
        if (usable.length === 0) issues.push(`${id}: taken (${port.decision}) but every source it rests on is no-go`);
        if (port.decision === "take" && gap.status === "has") issues.push(`${id}: the target already has it; use adapt or leave`);
      }
    }
  },
  spec(run, ledger, issues, warnings) {
    const taken = takenMechanisms(ledger);
    if (taken.length === 0) {
      warnings.push("no mechanism is taken; spec, build and parity have nothing to check");
      return;
    }
    const specPath = join(run, "SPEC.md");
    if (!existsSync(specPath)) {
      issues.push("SPEC.md is missing");
      return;
    }
    const spec = readFileSync(specPath, "utf8");
    for (const mechanism of taken) {
      if (!new RegExp(`^#{2,3} .*\\b${mechanism.id}\\b`, "mu").test(spec)) issues.push(`SPEC.md has no section for ${mechanism.id}`);
    }
    const named = namesSources(ledger, spec);
    if (named) issues.push(`SPEC.md names the captured sources (${named instanceof RegExp ? "sources/S<n>" : named}); the implementer must never be pointed at them`);
    const overlap = overlapIssues(run, ledger, [{ label: "SPEC.md", path: specPath }], ledger.min_words);
    issues.push(...overlap.issues);
    warnings.push(...overlap.warnings);
  },
  build(run, ledger, issues, warnings) {
    if (takenMechanisms(ledger).length === 0) return;
    const build = ledger.build ?? {};
    if (!filled(build.plan)) issues.push("build.plan is missing: record the plan lit-plan wrote from SPEC.md");
    else {
      const planPath = fromTarget(ledger, build.plan);
      if (!existsSync(planPath)) issues.push(`build.plan ${build.plan} does not exist`);
      else {
        const plan = readFileSync(planPath, "utf8");
        if (namesSources(ledger, plan)) issues.push(`build.plan ${build.plan} names the captured sources; plan rows cite SPEC sections only`);
        if (!/^- \[[ xX]\] (?:\d+|F\d+)\. \S/mu.test(plan)) issues.push(`build.plan ${build.plan} has no column-zero task row (- [ ] 1. <title>); write it in lit-plan's row grammar`);
        for (const mechanism of takenMechanisms(ledger)) {
          if (!new RegExp(`\\b${mechanism.id}\\b`, "u").test(plan)) issues.push(`build.plan ${build.plan} never cites ${mechanism.id}`);
        }
      }
    }
    const changed = Array.isArray(build.changed) ? build.changed : [];
    if (changed.length === 0) issues.push("build.changed lists no file");
    const files = [];
    for (const path of changed) {
      const full = fromTarget(ledger, path);
      if (!existsSync(full) || !statSync(full).isFile()) issues.push(`build.changed ${path} does not exist`);
      else if (path !== ledger.attribution?.path) files.push({ label: path, path: full });
    }
    const overlap = overlapIssues(run, ledger, files, ledger.min_words);
    issues.push(...overlap.issues);
    warnings.push(...overlap.warnings);
  },
  parity(run, ledger, issues) {
    const taken = takenMechanisms(ledger);
    if (taken.length === 0) return;
    for (const mechanism of taken) {
      const parity = mechanism.parity ?? {};
      for (const field of ["criterion", "red", "green", "surface", "artifact"]) if (!filled(parity[field])) issues.push(`${mechanism.id}: parity.${field} missing`);
      if (filled(parity.artifact) && !existsSync(fromRun(run, parity.artifact))) issues.push(`${mechanism.id}: parity artifact ${parity.artifact} does not exist`);
    }
    const parity = ledger.parity ?? {};
    const markers = Array.isArray(parity.markers) ? parity.markers.filter(filled) : [];
    const read = (list, label) => (Array.isArray(list) ? list : []).flatMap((path) => {
      const full = fromRun(run, path);
      if (!existsSync(full)) {
        issues.push(`${label} output ${path} does not exist`);
        return [];
      }
      return [{ path, text: readFileSync(full, "utf8").toLowerCase() }];
    });
    const baseline = read(parity.baseline_outputs, "baseline");
    const treatment = read(parity.treatment_outputs, "treatment");
    if (markers.length === 0) issues.push("parity.markers is empty: name what the new behaviour leaves in its output");
    if (baseline.length === 0) issues.push("parity.baseline_outputs is empty: run the old target on the same prompt");
    if (treatment.length === 0) issues.push("parity.treatment_outputs is empty: run the new target on the same prompt");
    for (const marker of markers) {
      const needle = marker.toLowerCase();
      const shown = treatment.filter((output) => output.text.includes(needle)).length;
      if (treatment.length > 0 && shown === 0) issues.push(`marker "${marker}" never appears in a treatment output; the port did not change behaviour`);
      else if (shown < treatment.length) issues.push(`marker "${marker}" appears in only ${shown} of ${treatment.length} treatment outputs; the behaviour is not reliable yet`);
      for (const output of baseline) if (output.text.includes(needle)) issues.push(`baseline output ${output.path} shows marker "${marker}"; the baseline saw the new work or the gap was not real`);
    }
  },
  report(run, ledger, issues) {
    const reportPath = join(run, "REPORT.md");
    if (!existsSync(reportPath)) {
      issues.push("REPORT.md is missing");
      return;
    }
    const report = readFileSync(reportPath, "utf8");
    for (const heading of ["## Taken", "## Left", "## Provenance"]) if (!report.includes(heading)) issues.push(`REPORT.md has no "${heading}" section`);
    for (const mechanism of ledger.mechanisms ?? []) if (!new RegExp(`\\b${mechanism.id}\\b`, "u").test(report)) issues.push(`REPORT.md does not account for ${mechanism.id}`);
    for (const source of ledger.sources ?? []) {
      const handle = source.url ?? source.path;
      if (filled(handle) && !report.includes(handle)) issues.push(`REPORT.md provenance does not list ${source.id} (${handle})`);
    }
    const takenSources = new Set(takenMechanisms(ledger).flatMap((mechanism) => mechanism.sources ?? []));
    for (const source of ledger.sources ?? []) {
      if (source.licence?.decision !== "ideas-credit" || !takenSources.has(source.id)) continue;
      const notice = ledger.attribution?.path ? fromTarget(ledger, ledger.attribution.path) : null;
      if (!notice || !existsSync(notice)) issues.push(`${source.id} needs credit: no attribution notice recorded (ledger.attribution.path)`);
      else if (!readFileSync(notice, "utf8").includes(source.url ?? source.path ?? "")) issues.push(`${source.id} needs credit: ${ledger.attribution.path} does not name ${source.url ?? source.path}`);
    }
  },
};

export const checkRun = (run, { phase = "report" } = {}) => {
  const issues = [];
  const warnings = [];
  if (!PHASES.includes(phase)) return { ok: false, phase, issues: [`unknown phase ${phase}; use one of ${PHASES.join(", ")}`], warnings };
  if (!existsSync(ledgerPath(run))) return { ok: false, phase, issues: [`${ledgerPath(run)} does not exist; start with hijack.mjs init`], warnings };
  const ledger = loadLedger(run);
  for (const name of PHASES.slice(0, PHASES.indexOf(phase) + 1)) checkPhase[name](run, ledger, issues, warnings);
  return { ok: issues.length === 0, phase, issues, warnings };
};

// The implementer sees the spec and the target, never the run folder, the sources or their URLs.
export const buildImplementerBrief = (run) => {
  const gate = checkRun(run, { phase: "spec" });
  if (!gate.ok) throw new Error(`the spec is not ready for an implementer:\n- ${gate.issues.join("\n- ")}`);
  const ledger = loadLedger(run);
  const spec = readFileSync(join(run, "SPEC.md"), "utf8").trim();
  const taken = takenMechanisms(ledger).map((mechanism) => mechanism.id).join(", ");
  return [
    `TASK: Implement the specification below in the target at ${ledger.target.root}. You are the implementer of a clean-room port: work only from this specification and the target's own files. Sections to build: ${taken}.`,
    "DELIVERABLE: the change each SPEC section asks for, written in the target's own naming, idiom, tests and manifest; the tests each section names; and the list of changed files as paths relative to the target root.",
    "SCOPE: write only inside the target. Do not open any .litgravity/hijack/ folder, do not search for or fetch the original material the spec came from, and do not reconstruct it from memory. If a section is ambiguous, stop and return the question instead of guessing.",
    "VERIFY: run the checks each section names and report their results. Return the changed file list so the run's build gate can compare it against the captured sources.",
    "",
    "--- SPEC ---",
    spec,
  ].join("\n");
};

// ---------------------------------------------------------------------------------------------
// Capture

// A capture follows redirects by hand: every hop must be https and name a public host, so a public
// page cannot bounce the fetch into loopback, the cloud metadata address or the local network. The
// connection goes to the address the check approved, so a name that answers again with a private
// address (DNS rebinding) cannot move it; TLS still checks the certificate for the name. The body is
// counted as it streams and dropped past the cap, whatever length the server declared.
const FETCH_HOPS = 5;
const privateV4 = (ip) => {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
};
const isPrivateAddress = (address) => {
  const ip = String(address).replace(/^\[|\]$/gu, "").toLowerCase();
  if (isIPv4(ip)) return privateV4(ip);
  if (!isIPv6(ip)) return false;
  const mapped = /^(?:0*:)*:?ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/u.exec(ip);
  if (mapped) {
    if (mapped[1]) return privateV4(mapped[1]);
    const [high, low] = [mapped[2], mapped[3]].map((part) => Number.parseInt(part, 16));
    return privateV4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return ip === "::" || ip === "::1" || /^f[cd]/u.test(ip) || /^fe[89ab]/u.test(ip) || /^ff/u.test(ip);
};
const checkHop = async (href, lookup) => {
  const url = new URL(href);
  if (url.protocol !== "https:") throw new Error(`refusing ${url.protocol} ${href}: captures fetch https only`);
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateAddress(host)) throw new Error(`refusing ${href}: a loopback, link-local or private host`);
  if (isIP(host)) return { href: url.href, address: host, family: isIP(host) };
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error(`refusing ${href}: ${host} does not resolve`);
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error(`refusing ${href}: ${host} resolves to a private address`);
  return { href: url.href, address: addresses[0].address, family: addresses[0].family };
};
// node:https with a lookup that answers only with the approved address, read back as a Response.
const pinnedFetch = (request) => (href, { headers, signal }, { address, family }) => new Promise((resolveResponse, reject) => {
  const pin = (_host, options, callback) => (options?.all ? callback(null, [{ address, family }]) : callback(null, address, family));
  const req = request(href, { headers, signal, lookup: pin }, (res) => {
    const answer = new Headers();
    for (const [name, value] of Object.entries(res.headers)) for (const item of [value].flat()) if (item !== undefined) answer.append(name, String(item));
    const empty = [204, 205, 304].includes(res.statusCode);
    if (empty) res.resume();
    try {
      resolveResponse(new Response(empty ? null : Readable.toWeb(res), { status: res.statusCode, headers: answer }));
    } catch (error) {
      res.destroy();
      reject(error);
    }
  });
  req.on("error", reject);
  req.end();
});
const readCapped = async (response, url, limit) => {
  const declared = Number(response.headers.get("content-length"));
  const tooLarge = () => new Error(`${url} is larger than ${limit} bytes`);
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel?.();
    throw tooLarge();
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks, total);
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
};

/** Fetches a public https URL over a connection pinned to the checked address; `request` and `lookup` are injectable for tests. */
export const fetchBytes = async (url, { request = httpsRequest, lookup = dnsLookup, limit = FETCH_LIMIT } = {}) => {
  const send = pinnedFetch(request);
  let hop = await checkHop(url, lookup);
  const signal = AbortSignal.timeout(30_000);
  for (let count = 0; count <= FETCH_HOPS; count += 1) {
    const current = hop.href;
    const response = await send(current, { headers: { "user-agent": "litgravity-lit-hijack/1 (+capture)" }, signal }, hop);
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (location) {
      await response.body?.cancel?.();
      hop = await checkHop(new URL(location, current).href, lookup);
      continue;
    }
    if (!response.ok) throw new Error(`${current} answered HTTP ${response.status}`);
    const buffer = await readCapped(response, current, limit);
    return { buffer, type: response.headers.get("content-type") ?? "", finalUrl: current };
  }
  throw new Error(`${url} redirected more than ${FETCH_HOPS} times`);
};

const guessKind = (input) => {
  if (parseXStatusUrl(input)) return "x";
  if (/^https?:\/\/gist\.github\.com\//iu.test(input)) return "gist";
  if (/^https?:\/\/github\.com\/[^/]+\/[^/]+/iu.test(input)) return "github-repo";
  if (/\.pdf(?:[?#].*)?$/iu.test(input)) return "pdf";
  if (/^https?:\/\//iu.test(input)) return "web";
  return "file";
};

const git = (args, cwd) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
};

const shallowClone = (url, dest, ref) => {
  git(["-c", "core.hooksPath=/dev/null", "clone", "--depth", "1", "--no-tags", "--single-branch", ...(ref ? ["--branch", ref] : []), url, dest]);
  return git(["rev-parse", "HEAD"], dest);
};

const repoLicence = (dir) => {
  const candidates = readdirSync(dir).filter((name) => /^(?:licen[cs]e|copying|unlicense)(?:\.[a-z]+)?$|^package\.json$/iu.test(name));
  const packageLast = (name) => Number(/package\.json/u.test(name));
  for (const name of candidates.sort((left, right) => packageLast(left) - packageLast(right))) {
    const found = detectLicence(readFileSync(join(dir, name), "utf8"));
    if (found.spdx !== "NOASSERTION") return { ...found, evidence: `${name}: ${found.evidence}` };
  }
  return { spdx: "NOASSERTION", evidence: "no LICENSE, COPYING or package.json licence at the repository root" };
};

const fileEntry = (run, path) => {
  const buffer = readFileSync(path);
  return { path: relative(run, path), sha256: sha256(buffer), bytes: buffer.length };
};

// The folder a `tree/<branch>/<subpath>` URL names, inside the clone. The subpath comes from the URL,
// so a `..` segment or anything that resolves outside the clone is refused before a file is read.
export const repoSubpath = (repoDir, raw) => {
  if (!raw) return null;
  const segments = raw.split("/").filter(Boolean);
  if (segments.some((s) => s === ".." || s === ".")) throw new Error(`the subpath ${JSON.stringify(raw)} has a . or .. segment`);
  const folder = resolve(repoDir, ...segments);
  const rel = relative(resolve(repoDir), folder);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`the subpath ${JSON.stringify(raw)} points outside the repository`);
  return folder;
};

export const captureSource = async (run, input, options = {}) => {
  const ledger = loadLedger(run);
  ledger.sources ??= [];
  const id = `S${ledger.sources.length + 1}`;
  const dir = join(run, "sources", id);
  mkdirSync(dir, { recursive: true });
  const kind = options.kind ?? guessKind(input);
  const entry = { id, kind, url: options.url ?? (/^https?:\/\//iu.test(input) ? input : null), path: null, author: null, published: null, title: options.title ?? null, retrieved_at: nowIso(), files: [], licence: null, inert: true };
  let licence = { spdx: "NOASSERTION", evidence: "no licence stated" };

  if (kind === "x" || kind === "x-post" || kind === "x-article") {
    const statusId = parseXStatusUrl(input);
    if (!statusId) throw new Error(`${input} is not an x.com or twitter.com status URL`);
    const { buffer } = await fetchBytes(`https://api.fxtwitter.com/status/${statusId}`);
    const json = JSON.parse(buffer.toString("utf8"));
    if (json.code !== 200) throw new Error(`fxtwitter answered code ${json.code} (${json.message ?? "no message"}) for ${input}`);
    const { markdown, meta } = fxtwitterToMarkdown(json);
    writeFileSync(join(dir, "raw.json"), buffer);
    writeFileSync(join(dir, "content.md"), markdown);
    Object.assign(entry, { kind: meta.kind, url: meta.url ?? input, author: meta.author, published: meta.published, title: entry.title ?? meta.title });
    licence = { spdx: "NOASSERTION", evidence: "X post: the author keeps the rights; the platform's licence runs to the platform, not to readers" };
    entry.files.push(fileEntry(run, join(dir, "content.md")), fileEntry(run, join(dir, "raw.json")));
  } else if (kind === "github-repo" || kind === "gist") {
    const match = /^https?:\/\/(?:gist\.)?github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/]+)((?:\/[^#?]+)?))?/iu.exec(input);
    if (!match) throw new Error(`${input} is not a github.com repository or gist URL`);
    const cloneUrl = kind === "gist" ? `https://gist.github.com/${match[2].replace(/\.git$/u, "")}.git` : `https://github.com/${match[1]}/${match[2].replace(/\.git$/u, "")}.git`;
    const repoDir = join(dir, "repo");
    const folder = repoSubpath(repoDir, match[4]);
    const commit = shallowClone(cloneUrl, repoDir, kind === "gist" ? null : match[3]);
    Object.assign(entry, { author: match[1], published: git(["log", "-1", "--format=%cI"], repoDir), title: entry.title ?? `${match[1]}/${match[2]}` });
    const folderLicence = folder && existsSync(folder) && statSync(folder).isDirectory() ? repoLicence(folder) : null;
    licence = kind === "gist"
      ? { spdx: "NOASSERTION", evidence: "gists carry no licence unless their files state one" }
      : folderLicence && folderLicence.spdx !== "NOASSERTION" ? { ...folderLicence, evidence: `${match[4].slice(1)}/${folderLicence.evidence}` } : repoLicence(repoDir);
    if (match[4]) entry.subpath = match[4].slice(1);
    entry.files.push({ path: relative(run, repoDir), commit });
  } else if (kind === "web") {
    const { buffer, type, finalUrl } = await fetchBytes(input);
    if (/pdf/iu.test(type) || buffer.subarray(0, 5).toString("latin1") === "%PDF-") return captureSource(run, input, { ...options, kind: "pdf" });
    const html = buffer.toString("utf8");
    writeFileSync(join(dir, "raw.html"), buffer);
    const title = metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/iu);
    writeFileSync(join(dir, "content.md"), `# ${title ?? input}\n\nsource: ${finalUrl || input}\n\n${htmlToText(html)}\n`);
    Object.assign(entry, {
      url: finalUrl || input,
      author: metaContent(html, /<meta[^>]+(?:name|property)=["'](?:author|article:author)["'][^>]+content=["']([^"']+)/iu),
      published: metaContent(html, /<meta[^>]+(?:property|name)=["'](?:article:published_time|date|dc\.date)["'][^>]+content=["']([^"']+)/iu),
      title: entry.title ?? title,
    });
    const licenceLink = /<a[^>]+rel=["']license["'][^>]+href=["']([^"']+)/iu.exec(html) ?? /<link[^>]+rel=["']license["'][^>]+href=["']([^"']+)/iu.exec(html);
    if (licenceLink) licence = { ...detectLicence(licenceLink[1]), evidence: `rel=license ${licenceLink[1]}` };
    entry.files.push(fileEntry(run, join(dir, "content.md")), fileEntry(run, join(dir, "raw.html")));
  } else if (kind === "pdf") {
    const buffer = /^https?:\/\//iu.test(input) ? (await fetchBytes(input)).buffer : readFileSync(input);
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${input} is not a PDF: its bytes do not start with %PDF-`);
    const pdfPath = join(dir, "source.pdf");
    writeFileSync(pdfPath, buffer);
    entry.files.push(fileEntry(run, pdfPath));
    const text = spawnSync("pdftotext", ["-layout", pdfPath, join(dir, "content.md")], { encoding: "utf8" });
    if (text.status === 0 && existsSync(join(dir, "content.md"))) {
      entry.files.push(fileEntry(run, join(dir, "content.md")));
      licence = detectLicence(readFileSync(join(dir, "content.md"), "utf8"));
    } else {
      entry.text_status = "pdftotext unavailable or failed; read source.pdf directly and record the mechanisms by page";
    }
    if (!/^https?:\/\//iu.test(input)) entry.path = resolve(input);
  } else if (kind === "video") {
    if (!options.transcript) throw new Error("a video capture needs --transcript <file>; save the captions first");
    if (!entry.url) throw new Error("a video capture needs the video URL as input or --url");
    copyFileSync(options.transcript, join(dir, "content.md"));
    entry.files.push(fileEntry(run, join(dir, "content.md")));
  } else if (kind === "file") {
    const target = join(dir, `content${extname(input) || ".md"}`);
    copyFileSync(input, target);
    entry.path = resolve(input);
    entry.files.push(fileEntry(run, target));
    licence = detectLicence(readFileSync(target, "utf8"));
  } else {
    throw new Error(`unknown kind ${kind}`);
  }

  entry.author = options.author ?? entry.author ?? "unknown";
  entry.published = options.date ?? entry.published ?? "unknown";
  entry.licence = options.licence
    ? { spdx: options.licence, evidence: options.licenceEvidence ?? "stated by the user at capture", decision: null }
    : { ...licence, decision: null };
  ledger.sources.push(entry);
  writeJson(ledgerPath(run), ledger);
  return entry;
};

export const applyLicenceTable = (run, overrides = {}) => {
  const ledger = loadLedger(run);
  for (const source of ledger.sources ?? []) {
    const override = overrides[source.id];
    if (override) {
      source.licence = { ...source.licence, decision: override.decision, decided_by: "user", reason: override.reason ?? "decided by the user" };
      continue;
    }
    if (source.licence?.decided_by === "user") continue;
    const text = sourceTexts(run, { sources: [source] }).map((entry) => entry.text).join("\n").slice(0, 200_000);
    const verdict = decideLicence(source.licence?.spdx, { text });
    source.licence = { ...source.licence, ...verdict, decided_by: "rule" };
  }
  writeJson(ledgerPath(run), ledger);
  return ledger.sources ?? [];
};

export const initRun = (run, { target, kind = "existing", baseRef, title } = {}) => {
  if (!target) throw new Error("init needs --target <project root>");
  const root = resolve(target);
  if (!existsSync(root)) throw new Error(`target ${root} does not exist`);
  if (existsSync(ledgerPath(run))) throw new Error(`${ledgerPath(run)} already exists; resume that run instead`);
  let base = baseRef ?? null;
  if (!base && kind === "existing") {
    const head = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" });
    base = head.status === 0 ? head.stdout.trim() : null;
  }
  mkdirSync(join(run, "sources"), { recursive: true });
  mkdirSync(join(run, "parity"), { recursive: true });
  const ledger = {
    schema: LEDGER_SCHEMA,
    title: title ?? null,
    created_at: nowIso(),
    target: { kind, root, base_ref: base },
    min_words: DEFAULT_MIN_WORDS,
    sources: [],
    mechanisms: [],
    build: {},
    parity: {},
  };
  writeJson(ledgerPath(run), ledger);
  return ledger;
};

// ---------------------------------------------------------------------------------------------
// CLI

const USAGE = `Usage: hijack.mjs <command> <run-dir> [options]
  init <run> --target <root> [--new] [--base-ref <rev>] [--title <text>]
  capture <run> <url|file> [--kind x|github-repo|gist|web|pdf|video|file] [--url <u>] [--author <a>] [--date <d>] [--title <t>] [--licence <SPDX>] [--transcript <file>]
  licence <run> [--set S1=ideas-only|ideas-credit|no-go --reason <text>]
  overlap <run> [paths...] [--min-words <n>] [--json]
  brief <run>
  check <run> [--phase ${PHASES.join("|")}] [--json]`;

const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (["new", "json"].includes(name)) flags[name] = true;
    else if (name === "set") (flags.set ??= []).push(argv[++index]);
    else flags[name] = argv[++index];
  }
  return { positional, flags };
};

const main = async (argv) => {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  const run = positional[0] ? resolve(positional[0]) : null;
  if (!command || !run) {
    console.error(USAGE);
    return 64;
  }
  if (command === "init") {
    const ledger = initRun(run, { target: flags.target, kind: flags.new ? "new" : "existing", baseRef: flags["base-ref"], title: flags.title });
    console.log(`run ${run}\ntarget ${ledger.target.root} (${ledger.target.kind}, base ${ledger.target.base_ref ?? "none: snapshot the target before the build"})`);
    return 0;
  }
  if (command === "capture") {
    if (!positional[1]) {
      console.error("capture needs a URL or a file");
      return 64;
    }
    const entry = await captureSource(run, positional[1], {
      kind: flags.kind, url: flags.url, author: flags.author, date: flags.date, title: flags.title,
      licence: flags.licence, licenceEvidence: flags["licence-evidence"], transcript: flags.transcript,
    });
    console.log(`${entry.id} ${entry.kind} ${entry.url ?? entry.path}\n  author ${entry.author} · published ${entry.published} · licence ${entry.licence.spdx}\n  files ${entry.files.map((file) => file.path).join(", ")}${entry.text_status ? `\n  note ${entry.text_status}` : ""}`);
    return 0;
  }
  if (command === "licence") {
    const overrides = {};
    for (const pair of flags.set ?? []) {
      const [id, decision] = String(pair).split("=");
      if (!DECISIONS.has(decision)) throw new Error(`--set ${pair}: decision must be one of ${[...DECISIONS].join(", ")}`);
      overrides[id] = { decision, reason: flags.reason };
    }
    for (const source of applyLicenceTable(run, overrides)) {
      console.log(`${source.id} ${source.licence.spdx} -> ${source.licence.decision} (${source.licence.decided_by}): ${source.licence.reason}`);
    }
    return 0;
  }
  if (command === "overlap") {
    const ledger = loadLedger(run);
    const paths = positional.slice(1);
    const files = paths.length > 0
      ? paths.map((path) => ({ label: path, path: resolve(path) }))
      : [
          ...(existsSync(join(run, "SPEC.md")) ? [{ label: "SPEC.md", path: join(run, "SPEC.md") }] : []),
          ...(ledger.build?.changed ?? []).map((path) => ({ label: path, path: fromTarget(ledger, path) })).filter((file) => existsSync(file.path)),
        ];
    const minWords = Number(flags["min-words"] ?? ledger.min_words ?? DEFAULT_MIN_WORDS);
    const { issues, warnings } = overlapIssues(run, ledger, files, minWords);
    if (flags.json) console.log(JSON.stringify({ ok: issues.length === 0, minWords, checked: files.map((file) => file.label), issues, warnings }, null, 2));
    else {
      console.log(`${issues.length === 0 ? "PASS" : "FAIL"} overlap (${files.length} file(s), runs of ${minWords}+ words)`);
      for (const issue of issues) console.log(`  - ${issue}`);
      for (const warning of warnings) console.log(`  ~ ${warning}`);
    }
    return issues.length === 0 ? 0 : 1;
  }
  if (command === "brief") {
    try {
      console.log(buildImplementerBrief(run));
      return 0;
    } catch (error) {
      console.error(error.message);
      return 2;
    }
  }
  if (command === "check") {
    const result = checkRun(run, { phase: flags.phase ?? "report" });
    if (flags.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${result.ok ? "PASS" : "FAIL"} check through ${result.phase}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
      for (const warning of result.warnings) console.log(`  ~ ${warning}`);
    }
    return result.ok ? 0 : 1;
  }
  console.error(USAGE);
  return 64;
};

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

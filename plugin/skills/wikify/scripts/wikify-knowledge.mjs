#!/usr/bin/env node
// wikify-knowledge.mjs: dependency-free reviewed-knowledge store for the LitGravity wikify skill.
//
//   node wikify-knowledge.mjs capture --event-json '<json>' [--base DIR] [--json]
//   node wikify-knowledge.mjs save    --id wk-... [--base DIR] [--json]
//   node wikify-knowledge.mjs review  --id wk-... --state accepted|rejected|stale [--base DIR] [--json]
//   node wikify-knowledge.mjs query   --text '<words>' [--budget 256..4096] [--base DIR]
//   node wikify-knowledge.mjs list    [--state review-needed|accepted|rejected|stale] [--base DIR] [--json]
//   node wikify-knowledge.mjs verify  [--base DIR] [--json]
//   node wikify-knowledge.mjs config  --capture on|off [--base DIR] [--json]
//
// The store is an append-only JSON Lines ledger at <base>/wiki/.knowledge/claims.jsonl. The base is --base DIR, else
// $LITGRAVITY_WIKI_BASE, else <cwd>/.litgravity. Every line is a complete claim revision; the latest line per id is the
// current state. New claims start as `review-needed`; only `save` or `review` can set `accepted`. Query returns
// accepted records only. Standard library only. No network, daemon, index file or external service.
//
// In the first LitGravity release there is no MCP server: capture, review and query run as these subcommands, called
// by the agent through run_command. Exit codes: 0 ok; 1 rejected input, integrity finding, unknown id or busy lock
// (the JSON error carries the exact reason); 2 usage (unknown command or option, missing or malformed argument).

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readSync, renameSync, rmSync, rmdirSync, writeFileSync, statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import process, { argv, cwd, exit, kill, pid, stderr, stdout } from "node:process";

const SCHEMA = "litgravity.wikify-claim.v1";
const PRODUCT = "litgravity";
const MAX_LEDGER_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_BYTES = 512;
const MAX_REF_BYTES = 256;
const NORMAL_BUDGET = 2048;
const HARD_BUDGET = 4096;
const MIN_BUDGET = 256;
const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 60000;

const KINDS = new Set(["fact", "decision", "failure", "risk", "rule", "checkpoint"]);
const STATES = new Set(["review-needed", "accepted", "rejected", "stale"]);
const REVIEW_STATES = new Set(["accepted", "rejected", "stale"]);
const ID_RE = /^wk-[a-f0-9]{24}$/u;
const CLAIM_KEYS = ["schema", "id", "kind", "text", "provenance", "evidence", "state", "timestamp"];

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/u,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{20,}/iu,
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{6,}/iu,
];
const URI_USERINFO = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/iu;
const INSTRUCTION_PATTERNS = [
  /\b(?:ignore|disregard)\s+(?:(?:all|any|every|the)\s+)?(?:previous|prior)\s+instructions?\b/iu,
  /(?:^|\s)(?:#{1,6}\s*)?(?:system|assistant|developer)\s*:/iu,
  /<\|(?:system|assistant|developer)\|>/iu,
  /\b(?:jailbreak|execute (?:this|the following) command|publish all credentials)\b/iu,
];

class KnowledgeError extends Error {
  constructor(message, status = 64) {
    super(message);
    this.name = "KnowledgeError";
    this.status = status;
  }
}

const bytes = (value) => Buffer.byteLength(value, "utf8");
const normalize = (value) => (typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "");
const containsSecret = (value) => SECRET_PATTERNS.some((p) => p.test(value));
const containsInstructions = (value) => INSTRUCTION_PATTERNS.some((p) => p.test(value));

const boundedText = (value, label, max) => {
  if (typeof value === "string" && /[\p{Cc}\p{Cf}]/u.test(value)) throw new KnowledgeError(`${label} contains control characters`);
  const text = normalize(value);
  if (!text) throw new KnowledgeError(`${label} is required`);
  if (bytes(text) > max) throw new KnowledgeError(`${label} exceeds ${max} bytes`);
  return text;
};

const localRef = (value) => {
  const norm = value.replaceAll("\\", "/");
  const pathPart = norm.split("#", 1)[0];
  if (norm.startsWith("/") || norm.startsWith("~") || /^[A-Za-z]:\//u.test(norm)
    || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(norm) || pathPart.split("/").some((part) => part === "..")) {
    throw new KnowledgeError("evidence ref must be a local relative reference", 65);
  }
  return value;
};

// Strict JSON: duplicate object keys and trailing garbage are errors.
const parseStrict = (text) => {
  let i = 0;
  const fail = () => { throw new Error("invalid json"); };
  const ws = () => { while (i < text.length && " \t\r\n".includes(text[i])) i += 1; };
  const value = () => {
    ws();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const out = Object.create(null);
      ws();
      if (text[i] === "}") { i += 1; return out; }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        const key = str();
        if (Object.prototype.hasOwnProperty.call(out, key)) fail();
        ws();
        if (text[i] !== ":") fail();
        i += 1;
        out[key] = value();
        ws();
        if (text[i] === ",") { i += 1; continue; }
        if (text[i] === "}") { i += 1; return out; }
        fail();
      }
    }
    if (c === "[") {
      i += 1;
      const out = [];
      ws();
      if (text[i] === "]") { i += 1; return out; }
      for (;;) {
        out.push(value());
        ws();
        if (text[i] === ",") { i += 1; continue; }
        if (text[i] === "]") { i += 1; return out; }
        fail();
      }
    }
    if (c === '"') return str();
    const m = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(text.slice(i));
    if (!m) fail();
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  const str = () => {
    const start = i;
    i += 1;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (text[i] !== '"') fail();
    i += 1;
    return JSON.parse(text.slice(start, i));
  };
  const result = value();
  ws();
  if (i !== text.length) fail();
  return result;
};

const exactKeys = (obj, keys) => obj !== null && typeof obj === "object" && !Array.isArray(obj)
  && Object.keys(obj).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
const isIso = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const makeId = (kind, text, prov, evidence) => `wk-${createHash("sha256")
  .update(JSON.stringify([kind, text, prov.product, prov.ref, evidence.ref])).digest("hex").slice(0, 24)}`;

// ---- state directory -------------------------------------------------------------------------------------

const baseDir = (flag) => {
  const env = process.env.LITGRAVITY_WIKI_BASE;
  return resolve(flag ?? (env && env.trim() ? env : join(cwd(), ".litgravity")));
};

const requireRegularDir = (path) => {
  const d = lstatSync(path);
  if (d.isSymbolicLink() || !d.isDirectory()) throw new KnowledgeError("knowledge state path is not a regular directory", 65);
};

const ensureDir = (path) => {
  if (existsSync(path)) { requireRegularDir(path); return; }
  mkdirSync(path, { mode: 0o700 });
};

const storeDir = (base, create) => {
  const wiki = join(base, "wiki");
  const dir = join(wiki, ".knowledge");
  if (create) {
    if (!existsSync(base)) mkdirSync(base, { recursive: true, mode: 0o700 });
    for (const p of [base, wiki, dir]) ensureDir(p);
  } else {
    for (const p of [base, wiki, dir]) if (existsSync(p)) requireRegularDir(p);
  }
  return dir;
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const withLock = (dir, op) => {
  const lock = join(dir, ".claims-lock");
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(lock, { mode: 0o700 });
      writeFileSync(join(lock, "owner"), `${pid} ${Date.now()}\n`);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw new KnowledgeError("knowledge lock failed", 65);
      let stale = false;
      try {
        const [ownerPid, ts] = readFileSync(join(lock, "owner"), "utf8").trim().split(" ").map(Number);
        let alive = true;
        try { kill(ownerPid, 0); } catch (e) { alive = e?.code === "EPERM"; }
        stale = !alive || Date.now() - ts > LOCK_STALE_MS;
      } catch { stale = Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS; }
      if (stale) { rmSync(lock, { recursive: true, force: true }); continue; }
      if (Date.now() - started > LOCK_WAIT_MS) throw new KnowledgeError("knowledge lock is busy; retry", 75);
      sleep(50);
    }
  }
  try { return op(); } finally { try { rmSync(join(lock, "owner"), { force: true }); rmdirSync(lock); } catch { /* best effort */ } }
};

// ---- ledger ----------------------------------------------------------------------------------------------

const readLedger = (path) => {
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (!info) return "";
  if (info.isSymbolicLink() || !info.isFile()) throw new KnowledgeError("knowledge ledger is not a regular file", 65);
  if (info.nlink !== 1) throw new KnowledgeError("knowledge ledger has an unsafe link count", 65);
  if (info.size > MAX_LEDGER_BYTES) throw new KnowledgeError(`knowledge ledger exceeds ${MAX_LEDGER_BYTES} bytes`, 65);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const buf = Buffer.alloc(fstatSync(fd).size);
    let off = 0;
    while (off < buf.length) { const n = readSync(fd, buf, off, buf.length - off, off); if (!n) break; off += n; }
    return new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, off));
  } catch { throw new KnowledgeError("knowledge ledger read failed", 65); } finally { closeSync(fd); }
};

const validateRow = (row) => {
  if (!exactKeys(row, CLAIM_KEYS) || row.schema !== SCHEMA || !ID_RE.test(row.id) || !KINDS.has(row.kind)
    || !STATES.has(row.state) || !exactKeys(row.provenance, ["product", "surface", "ref"])
    || row.provenance.product !== PRODUCT || !exactKeys(row.evidence, ["ref"]) || !isIso(row.timestamp)) throw new Error("shape");
  boundedText(row.text, "text", MAX_TEXT_BYTES);
  boundedText(row.provenance.surface, "surface", MAX_REF_BYTES);
  boundedText(row.provenance.ref, "ref", MAX_REF_BYTES);
  localRef(boundedText(row.evidence.ref, "evidence", MAX_REF_BYTES));
  if (row.id !== makeId(row.kind, row.text, row.provenance, row.evidence)) throw new Error("forged id");
  const all = `${row.text}\n${row.provenance.surface}\n${row.provenance.ref}\n${row.evidence.ref}`;
  if (URI_USERINFO.test(all) || containsSecret(all) || containsInstructions(all)) throw new Error("unsafe");
};

const parseRows = (content) => content.split("\n").filter(Boolean).map((line) => {
  try { const row = parseStrict(line); validateRow(row); return row; } catch {
    throw new KnowledgeError("knowledge ledger contains a malformed authoritative record", 65);
  }
});

const atomicWrite = (path, content) => {
  if (bytes(content) > MAX_LEDGER_BYTES) throw new KnowledgeError("knowledge ledger would exceed its size limit", 65);
  const tmp = join(dirname(path), `.${pid}.${randomUUID()}.tmp`);
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, content, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, path);
  const dfd = openSync(dirname(path), constants.O_RDONLY);
  try { fsyncSync(dfd); } finally { closeSync(dfd); }
};

// Returns validated rows; when `repair` is set an interrupted (unparseable, unterminated) final line is removed.
const loadRows = (path, repair) => {
  let content = readLedger(path);
  if (content && !content.endsWith("\n")) {
    const cut = content.lastIndexOf("\n") + 1;
    let complete = true;
    try { parseStrict(content.slice(cut)); } catch { complete = false; }
    if (!complete) {
      if (repair) atomicWrite(path, content.slice(0, cut));
      content = content.slice(0, cut);
    } else {
      content += "\n";
      if (repair) atomicWrite(path, content);
    }
  }
  return parseRows(content);
};

const current = (rows) => { const m = new Map(); for (const r of rows) m.set(r.id, r); return m; };

const append = (base, build) => {
  const dir = storeDir(base, true);
  return withLock(dir, () => {
    const path = join(dir, "claims.jsonl");
    const rows = loadRows(path, true);
    const out = build(current(rows));
    if (!out.record) return out.receipt;
    atomicWrite(path, `${readLedger(path)}${JSON.stringify(out.record)}\n`);
    const back = current(loadRows(path, false)).get(out.record.id);
    if (back?.state !== out.record.state || back?.timestamp !== out.record.timestamp) throw new KnowledgeError("knowledge persistence failed", 65);
    return out.receipt;
  });
};

// ---- operations ------------------------------------------------------------------------------------------

const readSettings = (base) => {
  const path = join(storeDir(base, false), "settings.json");
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (!info) return { capture: true };
  if (info.isSymbolicLink() || !info.isFile()) throw new KnowledgeError("knowledge settings are not a regular file", 65);
  try {
    const s = parseStrict(readFileSync(path, "utf8"));
    if (typeof s.capture !== "boolean") throw new Error("shape");
    return { capture: s.capture };
  } catch { throw new KnowledgeError("knowledge settings are malformed", 65); }
};

const capture = (base, event, surface) => {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new KnowledgeError("structured event must be an object");
  for (const [obj, allowed, label] of [[event, ["kind", "text", "provenance", "evidence"], "event"],
    [event.provenance, ["ref"], "event provenance"], [event.evidence, ["ref"], "event evidence"]]) {
    if (obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).some((k) => !allowed.includes(k))) {
      throw new KnowledgeError(`${label} contains an unknown input key`);
    }
  }
  if (!KINDS.has(event.kind)) throw new KnowledgeError("unsupported kind (fact, decision, failure, risk, rule, checkpoint)");
  const text = boundedText(event.text, "text", MAX_TEXT_BYTES);
  const prov = { product: PRODUCT, surface: boundedText(surface, "surface", MAX_REF_BYTES), ref: boundedText(event.provenance?.ref, "provenance ref", MAX_REF_BYTES) };
  const evidence = { ref: localRef(boundedText(event.evidence?.ref, "evidence ref", MAX_REF_BYTES)) };
  const all = `${text}\n${prov.surface}\n${prov.ref}\n${evidence.ref}`;
  if (URI_USERINFO.test(all)) throw new KnowledgeError("credential-bearing URI rejected", 65);
  if (containsSecret(all)) throw new KnowledgeError("secret-bearing event rejected", 65);
  if (containsInstructions(all)) throw new KnowledgeError("instruction-shaped event rejected", 65);
  if (!readSettings(base).capture) return { ok: true, status: "disabled", written: false };
  const id = makeId(event.kind, text, prov, evidence);
  return append(base, (records) => {
    if (records.has(id)) return { receipt: { ok: true, status: "duplicate", written: false, id } };
    const record = { schema: SCHEMA, id, kind: event.kind, text, provenance: prov, evidence, state: "review-needed", timestamp: new Date().toISOString() };
    return { record, receipt: { ok: true, status: "review-needed", written: true, id } };
  });
};

const review = (base, id, state, surface) => {
  if (!ID_RE.test(id ?? "")) throw new KnowledgeError("invalid knowledge id");
  if (!REVIEW_STATES.has(state)) throw new KnowledgeError("review state must be accepted, rejected, or stale");
  const surf = boundedText(surface, "surface", MAX_REF_BYTES);
  return append(base, (records) => {
    const cur = records.get(id);
    if (!cur) throw new KnowledgeError("knowledge id not found", 66);
    if (cur.state === state) return { receipt: { ok: true, status: "duplicate", written: false, id, state } };
    const record = { ...cur, state, timestamp: new Date().toISOString(), provenance: { ...cur.provenance, surface: surf } };
    return { record, receipt: { ok: true, status: "reviewed", written: true, id, state } };
  });
};

const tokens = (v) => new Set(normalize(v).toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{2,}/gu) ?? []);
const escapeForPrompt = (v) => JSON.stringify(v).replace(/[<>&]/gu, (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[c]);

const query = (base, text, budget = NORMAL_BUDGET) => {
  const q = tokens(boundedText(text, "query text", MAX_TEXT_BYTES));
  if (!Number.isInteger(budget) || budget < MIN_BUDGET || budget > HARD_BUDGET) throw new KnowledgeError("budget must be between 256 and 4096 bytes");
  const dir = storeDir(base, false);
  const path = join(dir, "claims.jsonl");
  if (!existsSync(path)) return "";
  const hits = [...current(loadRows(path, false)).values()].filter((r) => r.state === "accepted")
    .map((record) => {
      const have = tokens(`${record.kind} ${record.text} ${record.provenance.ref} ${record.evidence.ref}`);
      let score = 0; for (const t of q) if (have.has(t)) score += 1;
      return { record, score };
    }).filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
  const open = "<litgravity-knowledge>\n";
  const close = "</litgravity-knowledge>\n";
  let out = open;
  for (const { record } of hits) {
    const line = `${escapeForPrompt({ id: record.id, kind: record.kind, text: record.text, timestamp: record.timestamp, provenance: record.provenance, evidence: record.evidence })}\n`;
    if (bytes(out + line + close) > budget) break;
    out += line;
  }
  return out === open ? "" : `${out}${close}`;
};

const list = (base, state) => {
  if (state && !STATES.has(state)) throw new KnowledgeError("state must be review-needed, accepted, rejected, or stale");
  const path = join(storeDir(base, false), "claims.jsonl");
  if (!existsSync(path)) return [];
  return [...current(loadRows(path, false)).values()].filter((r) => !state || r.state === state)
    .map((r) => ({ id: r.id, kind: r.kind, state: r.state, text: r.text, evidence: r.evidence.ref, timestamp: r.timestamp }));
};

const verify = (base) => {
  const path = join(storeDir(base, false), "claims.jsonl");
  if (!existsSync(path)) return { ok: true, status: "empty", revisions: 0, claims: 0 };
  const content = readLedger(path);
  const interrupted = content !== "" && !content.endsWith("\n");
  const rows = loadRows(path, false);
  const counts = { "review-needed": 0, accepted: 0, rejected: 0, stale: 0 };
  for (const r of current(rows).values()) counts[r.state] += 1;
  return { ok: true, status: interrupted ? "interrupted-final-line (repaired on next write)" : "healthy", revisions: rows.length, claims: Object.values(counts).reduce((a, b) => a + b, 0), states: counts };
};

const configure = (base, on) => withLock(storeDir(base, true), () => {
  atomicWrite(join(storeDir(base, true), "settings.json"), `${JSON.stringify({ capture: on }, null, 2)}\n`);
  return { ok: true, status: "configured", capture: on };
});

// ---- cli -------------------------------------------------------------------------------------------------

const HELP = `Usage: node wikify-knowledge.mjs <command> [options]

Commands:
  capture  --event-json '{"kind","text","provenance":{"ref"},"evidence":{"ref"}}'   add one review-needed claim
  save     --id wk-...                                                              promote one claim to accepted
  review   --id wk-... --state accepted|rejected|stale                              set the review state
  query    --text '<words>' [--budget 256..4096]                                    accepted-only bounded block
  list     [--state review-needed|accepted|rejected|stale]                          current claims
  verify                                                                            ledger health check
  config   --capture on|off                                                         default-on capture switch

Options: --base DIR (default $LITGRAVITY_WIKI_BASE, else <cwd>/.litgravity; store at DIR/wiki/.knowledge/), --json
Exit: 0 ok; 1 rejected, integrity finding, unknown id or busy lock; 2 usage.
Kinds: fact, decision, failure, risk, rule, checkpoint. Evidence refs are local relative paths.
The same uid is not a tamper-proof or confidential boundary; writers cooperate through a lock directory.
`;

// Internal error classes; main() maps them to the public exit codes (usage 2, everything else 1).
const REASONS = { 64: "usage", 65: "rejected-or-integrity", 66: "not-found", 75: "lock-busy" };

const ALLOWED = {
  capture: ["--event-json", "--base", "--json"], save: ["--id", "--base", "--json"],
  review: ["--id", "--state", "--base", "--json"], query: ["--text", "--budget", "--base"],
  list: ["--state", "--base", "--json"], verify: ["--base", "--json"], config: ["--capture", "--base", "--json"],
};

const main = () => {
  const [command, ...args] = argv.slice(2);
  if (!command || command === "--help" || command === "-h") { stdout.write(HELP); return command ? 0 : 2; }
  const asJson = args.includes("--json");
  try {
    if (!ALLOWED[command]) throw new KnowledgeError(`unknown command: ${command}`);
    const opts = {};
    for (let i = 0; i < args.length; i += 1) {
      const flag = args[i];
      if (!ALLOWED[command].includes(flag)) throw new KnowledgeError(`unknown option: ${flag}`);
      if (flag === "--json") { opts.json = true; continue; }
      const val = args[i + 1];
      if (val === undefined || val.startsWith("--")) throw new KnowledgeError(`${flag} requires a value`);
      opts[flag.slice(2)] = val; i += 1;
    }
    const need = (k) => opts[k] ?? (() => { throw new KnowledgeError(`missing --${k}`); })();
    const base = baseDir(opts.base);
    let result;
    switch (command) {
      case "capture": {
        let event;
        try { event = parseStrict(need("event-json")); } catch { throw new KnowledgeError("invalid event JSON"); }
        result = capture(base, event, "cli"); break;
      }
      case "save": result = review(base, need("id"), "accepted", "save"); break;
      case "review": result = review(base, need("id"), need("state"), "review"); break;
      case "query": {
        if (opts.budget !== undefined && !/^\d+$/u.test(opts.budget)) throw new KnowledgeError("budget must be an integer");
        result = query(base, need("text"), opts.budget === undefined ? undefined : Number.parseInt(opts.budget, 10)); break;
      }
      case "list": result = list(base, opts.state); break;
      case "verify": result = verify(base); break;
      case "config": {
        const v = need("capture");
        if (v !== "on" && v !== "off") throw new KnowledgeError("capture must be on or off");
        result = configure(base, v === "on"); break;
      }
      default: throw new KnowledgeError(`unknown command: ${command}`);
    }
    if (typeof result === "string") stdout.write(result);
    else stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof KnowledgeError;
    const reason = known ? (REASONS[error.status] ?? "error") : "runtime";
    const status = reason === "usage" ? 2 : 1;
    const message = known ? error.message : "wikify knowledge runtime error";
    if (asJson) stdout.write(`${JSON.stringify({ ok: false, status: "error", command: command ?? null, error: { message, reason, exitCode: status } }, null, 2)}\n`);
    else stderr.write(`${message}\n`);
    return status;
  }
};

exit(main());

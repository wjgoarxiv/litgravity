// Byte-level and canonical-form primitives for litfamily.design-contract/v1alpha1.
//
// Everything in this module runs before any semantic rule. A failure here means the input
// bytes cannot be trusted at all, so callers must surface it as an untrusted-input error
// rather than as a contract issue.
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { UiuxContractError } from "./errors.mjs";

// A contract is a finite decision record, not a document store. One mebibyte, measured in
// UTF-8 bytes before parsing, is the same boundary the evidence lane applies when it reads a
// contract back.
const CONTRACT_MAX_BYTES = 1024 * 1024;

// Nesting is bounded so a hostile file cannot exhaust the stack during the raw scan.
const CONTRACT_MAX_DEPTH = 24;

// Typed identifier grammar. The prefix names the declared kind; the tail is a stable slug.
const STABLE_ID = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._/-]*$/u;

// Lowercase hexadecimal only. An uppercase digest is a different string and would produce a
// different canonical form, so it is rejected instead of folded.
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/u;

// Every identifier in the contract carries the prefix of the group that declares it.
export const ID_PREFIXES = Object.freeze({
  contract: "contract:",
  route: "route:",
  region: "region:",
  component: "component:",
  interaction: "interaction:",
  state: "state:",
  viewport: "viewport:",
  reference: "reference:",
});

const SIMPLE_ESCAPES = Object.freeze({
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
});

function untrusted(code, message, details = {}) {
  throw new UiuxContractError(code, message, details);
}

export function isStableId(value) {
  return typeof value === "string" && STABLE_ID.test(value);
}

export function isPrefixedId(value, prefix) {
  return isStableId(value) && value.startsWith(prefix);
}

export function isLowercaseSha256(value) {
  return typeof value === "string" && LOWERCASE_SHA256.test(value);
}

// Strict ISO-8601 UTC. The round trip is the whole check: it accepts exactly the shape
// Date#toISOString emits, which rejects numeric offsets, microsecond precision, a lowercase
// `z`, and any calendar value that silently normalises (for example 2026-02-30).
export function isUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Canonical form: object keys sorted recursively, array order preserved, and a single
// trailing newline. The newline is part of the canonical bytes -- every hash taken over a
// contract in this system is taken over the form produced here, so dropping it would
// silently invalidate every recorded digest.
export function canonicalDesignContract(value) {
  return `${canonicalValue(value)}\n`;
}

// Raw structural scan performed before the runtime parser sees the text.
//
// JSON.parse keeps the last value of a repeated key and reports nothing, so a contract could
// carry a second `accessibility` block that no reviewer ever reads. This walker rebuilds the
// object structure from the raw characters and keeps a fresh key set for every object at
// every depth, which is what makes sibling objects legal and repeats inside one object fatal.
// It also rejects raw control characters inside strings and any trailing data.
function scanTrustedJson(text) {
  let index = 0;

  const fail = (code, message) => untrusted(code, `${message} at offset ${index}`, { offset: index });

  const skipBlank = () => {
    while (index < text.length && (
      text[index] === " " || text[index] === "\t" || text[index] === "\n" || text[index] === "\r"
    )) index += 1;
  };

  const readString = () => {
    index += 1;
    let value = "";
    while (index < text.length) {
      const char = text[index];
      if (char === '"') {
        index += 1;
        return value;
      }
      if (char === "\\") {
        const escape = text[index + 1];
        if (escape === "u") {
          const hex = text.slice(index + 2, index + 6);
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "invalid unicode escape");
          value += String.fromCharCode(Number.parseInt(hex, 16));
          index += 6;
          continue;
        }
        if (escape === undefined || !Object.hasOwn(SIMPLE_ESCAPES, escape)) {
          fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "invalid string escape");
        }
        value += SIMPLE_ESCAPES[escape];
        index += 2;
        continue;
      }
      if (char < " ") fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "raw control character inside a string");
      value += char;
      index += 1;
    }
    return fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "unterminated string");
  };

  const readValue = (depth) => {
    if (depth > CONTRACT_MAX_DEPTH) fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "nesting exceeds the bounded depth");
    skipBlank();
    const char = text[index];
    if (char === undefined) fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "unexpected end of input");
    if (char === '"') {
      readString();
      return;
    }
    if (char === "{") {
      readObject(depth);
      return;
    }
    if (char === "[") {
      readArray(depth);
      return;
    }
    const start = index;
    while (index < text.length && !',}] \t\n\r'.includes(text[index])) index += 1;
    if (index === start) fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "unexpected character");
  };

  const readObject = (depth) => {
    index += 1;
    // One key set per object per depth: siblings never share it, so only a repeat inside
    // this exact object is a duplicate.
    const keys = new Set();
    skipBlank();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    for (;;) {
      skipBlank();
      if (text[index] !== '"') fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "expected an object key string");
      const keyOffset = index;
      const key = readString();
      if (keys.has(key)) {
        index = keyOffset;
        fail("DESIGN_CONTRACT_DUPLICATE_JSON_KEY", `duplicate object key ${JSON.stringify(key)}`);
      }
      keys.add(key);
      skipBlank();
      if (text[index] !== ":") fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "expected a colon");
      index += 1;
      readValue(depth + 1);
      skipBlank();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "}") {
        index += 1;
        return;
      }
      fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "expected a comma or a closing brace");
    }
  };

  const readArray = (depth) => {
    index += 1;
    skipBlank();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    for (;;) {
      readValue(depth + 1);
      skipBlank();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "]") {
        index += 1;
        return;
      }
      fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "expected a comma or a closing bracket");
    }
  };

  readValue(0);
  skipBlank();
  if (index !== text.length) fail("DESIGN_CONTRACT_UNTRUSTED_JSON", "trailing data after the top-level value");
}

// Bounded read. Size is checked from the directory entry first so an oversize file is never
// pulled into memory, and lstat is used directly so a symlink is not a regular file here.
function readContractText(path, maxBytes) {
  const absolutePath = resolve(path);
  let stat;
  try {
    stat = lstatSync(absolutePath);
  } catch {
    untrusted("DESIGN_CONTRACT_UNREADABLE", `cannot stat ${absolutePath}`);
  }
  if (!stat.isFile()) {
    untrusted("DESIGN_CONTRACT_UNREADABLE", `expected a regular file: ${absolutePath}`);
  }
  if (stat.size > maxBytes) {
    untrusted("DESIGN_CONTRACT_OVERSIZE", `input exceeds ${maxBytes} bytes`, {
      actual_bytes: stat.size,
      max_bytes: maxBytes,
    });
  }
  let bytes;
  try {
    bytes = readFileSync(absolutePath);
  } catch {
    untrusted("DESIGN_CONTRACT_UNREADABLE", `cannot read ${absolutePath}`);
  }
  if (bytes.length > maxBytes) {
    untrusted("DESIGN_CONTRACT_OVERSIZE", `input exceeds ${maxBytes} bytes`, {
      actual_bytes: bytes.length,
      max_bytes: maxBytes,
    });
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    untrusted("DESIGN_CONTRACT_NOT_UTF8", `input is not valid UTF-8: ${absolutePath}`);
  }
  if (text.charCodeAt(0) === 0xfeff) {
    untrusted("DESIGN_CONTRACT_NOT_UTF8", "a UTF-8 byte order mark is not part of a contract");
  }
  if (text.includes("\0")) {
    untrusted("DESIGN_CONTRACT_NOT_UTF8", "NUL bytes are not permitted");
  }
  return { absolutePath, bytes, text };
}

// Read, scan, then parse. The scan is what makes the parse safe to trust.
export function readDesignContract(path) {
  const source = readContractText(path, CONTRACT_MAX_BYTES);
  scanTrustedJson(source.text);
  let value;
  try {
    value = JSON.parse(source.text);
  } catch (error) {
    untrusted("DESIGN_CONTRACT_UNTRUSTED_JSON", `invalid JSON: ${error.message}`);
  }
  return { ...source, value };
}

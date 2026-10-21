import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { UiuxContractError } from "./errors.mjs";
import {
  decodeStrictUtf8,
  parseStrictJson,
  StrictJsonError,
} from "./strict-json.mjs";

export function readBoundedJson(path, { maxBytes, invalidCode, allowSymlink = false }) {
  const absolutePath = resolve(path);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() && !stat.isSymbolicLink()) {
    throw new UiuxContractError(invalidCode, `expected a regular JSON file: ${absolutePath}`);
  }
  if (stat.isSymbolicLink() && !allowSymlink) {
    throw new UiuxContractError(invalidCode, `symlink input requires explicit opt-in: ${absolutePath}`);
  }
  const resolvedPath = realpathSync(absolutePath);
  const bytes = readFileSync(resolvedPath);
  if (bytes.length > maxBytes) {
    throw new UiuxContractError(invalidCode, `JSON input exceeds ${maxBytes} bytes`, {
      actual_bytes: bytes.length,
      max_bytes: maxBytes,
    });
  }
  let text;
  let value;
  try {
    text = decodeStrictUtf8(bytes);
    value = parseStrictJson(text);
  } catch (error) {
    if (error instanceof StrictJsonError) {
      const code = error.code === "JSON_SYNTAX_INVALID" ? invalidCode : error.code;
      throw new UiuxContractError(code, error.message, error.details);
    }
    throw new UiuxContractError(invalidCode, `invalid JSON: ${error.message}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UiuxContractError(invalidCode, "top-level JSON value must be an object");
  }
  return { absolutePath, bytes, text, value };
}

export function requireFields(value, fields, code, label) {
  const missing = fields.filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) {
    throw new UiuxContractError(code, `${label} is missing required fields: ${missing.join(", ")}`, {
      missing,
    });
  }
}

export function rejectUnknownFields(value, allowed, code, label) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((field) => !allowedSet.has(field));
  if (unknown.length > 0) {
    throw new UiuxContractError(code, `${label} contains unknown fields: ${unknown.join(", ")}`, {
      unknown,
    });
  }
}

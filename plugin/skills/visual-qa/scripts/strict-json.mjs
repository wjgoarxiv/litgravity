export class StrictJsonError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "StrictJsonError";
    this.code = code;
    this.details = details;
  }
}

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function fail(code, message, offset) {
  throw new StrictJsonError(code, `${message} at byte ${offset}`, { offset });
}

export function decodeStrictUtf8(bytes) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) fail("JSON_INVALID_UTF8", "UTF-8 BOM is not permitted", 0);
    if (text.includes("\0")) fail("JSON_INVALID_UTF8", "NUL is not permitted", text.indexOf("\0"));
    return text;
  } catch (error) {
    if (error instanceof StrictJsonError) throw error;
    throw new StrictJsonError("JSON_INVALID_UTF8", "input is not valid UTF-8");
  }
}

export function parseStrictJson(text) {
  let index = 0;
  const whitespace = () => {
    while (index < text.length && /[\u0009\u000a\u000d\u0020]/u.test(text[index])) index += 1;
  };
  const string = () => {
    const start = index;
    if (text[index++] !== "\"") fail("JSON_SYNTAX_INVALID", "expected string", index);
    while (index < text.length) {
      const character = text[index++];
      if (character === "\"") {
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          fail("JSON_SYNTAX_INVALID", "invalid string escape", start);
        }
      }
      if (character < "\u0020") fail("JSON_SYNTAX_INVALID", "control character in string", index - 1);
      if (character === "\\") {
        const escape = text[index++];
        if (escape === "u") {
          const hex = text.slice(index, index + 4);
          if (!/^[0-9a-f]{4}$/iu.test(hex)) fail("JSON_SYNTAX_INVALID", "invalid unicode escape", index);
          index += 4;
        } else if (!"\"\\/bfnrt".includes(escape ?? "")) {
          fail("JSON_SYNTAX_INVALID", "invalid string escape", index - 1);
        }
      }
    }
    fail("JSON_SYNTAX_INVALID", "unterminated string", start);
  };
  const number = () => {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) fail("JSON_SYNTAX_INVALID", "invalid number", index);
    index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("JSON_SYNTAX_INVALID", "non-finite number", index);
    return value;
  };
  const value = () => {
    whitespace();
    if (text[index] === "\"") return string();
    if (text[index] === "{") return object();
    if (text[index] === "[") return array();
    for (const [literal, parsed] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return parsed;
      }
    }
    return number();
  };
  const array = () => {
    index += 1;
    const result = [];
    whitespace();
    if (text[index] === "]") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(value());
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return result;
      }
      if (text[index++] !== ",") fail("JSON_SYNTAX_INVALID", "expected comma", index - 1);
      whitespace();
    }
    fail("JSON_SYNTAX_INVALID", "unterminated array", index);
  };
  const object = () => {
    index += 1;
    const result = {};
    const keys = new Set();
    whitespace();
    if (text[index] === "}") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      whitespace();
      const keyOffset = index;
      const key = string();
      if (RESERVED_KEYS.has(key)) {
        fail("JSON_RESERVED_KEY", `reserved object key ${JSON.stringify(key)}`, keyOffset);
      }
      if (keys.has(key)) fail("JSON_DUPLICATE_KEY", `duplicate object key ${JSON.stringify(key)}`, keyOffset);
      keys.add(key);
      whitespace();
      if (text[index++] !== ":") fail("JSON_SYNTAX_INVALID", "expected colon", index - 1);
      result[key] = value();
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return result;
      }
      if (text[index++] !== ",") fail("JSON_SYNTAX_INVALID", "expected comma", index - 1);
    }
    fail("JSON_SYNTAX_INVALID", "unterminated object", index);
  };
  const parsed = value();
  whitespace();
  if (index !== text.length) fail("JSON_SYNTAX_INVALID", "unexpected trailing data", index);
  return parsed;
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

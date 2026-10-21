// Static fallback for the interface probe: reads source files when no browser can render the page.
// It reports only rules whose signal already lives in source text. A finding is a literal source
// match (tier measured, viewport "static", selector file:line); a judgment rule's match is only a
// candidate for the reviewer. Every rendered rule is listed as not verified, so a static run can
// never read as a pass.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { RULES } from "./interface-probe-rules.mjs";

const SOURCE_EXTENSIONS = new Set([".html", ".htm", ".css", ".scss", ".sass", ".less", ".js", ".mjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro"]);
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".next", ".nuxt", ".svelte-kit", "coverage", ".litgravity", "dist", "build", "out"]);
const MAX_FILES = 400;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function listSourceFiles(target) {
  if (statSync(target).isFile()) return [target];
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (files.length >= MAX_FILES) return;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase()) && statSync(path).size <= MAX_FILE_BYTES) {
        files.push(path);
      }
    }
  };
  walk(target);
  return files.sort();
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const every = (pattern, text, value = (match) => match[0]) => [...text.matchAll(pattern)].map((match) => ({ index: match.index, value: value(match).replace(/\s+/gu, " ").slice(0, 60) }));
// CSS rule blocks (selector + body) without nested at-rule bodies; enough for co-occurrence checks.
const blocks = (text) => [...text.matchAll(/([^{}]*)\{([^{}]*)\}/gu)].map((match) => ({ index: match.index, selector: match[1].trim(), body: match[2] }));
const hueOfHex = (hex) => {
  const value = hex.length <= 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  if (max === min) return { h: 0, spread: 0 };
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, spread: d };
};
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
// Visible text between tags, outside <title>, <script>, <style>, <code>, <pre> and <textarea>.
const copyOf = (text) => text.replace(/<(title|script|style|code|pre|kbd|textarea)\b[^>]*>[\s\S]*?<\/\1>/giu, (match) => match.replace(/[^\n]/gu, " "));

// Each detector returns [{ index, value }] for one file's text; thresholds come from RULES.
export const DETECTORS = Object.freeze({
  "SLOP-058": (text) => every(/\bhref\s*=\s*(?:\{\s*)?(["'`])\s*(#|javascript:[^"'`]*)\s*\1/giu, text, (m) => m[2]),
  "SLOP-057": (text) => every(/<img\b[^>]*>/giu, text).filter(({ value }) => /\b(?:src|srcset)\s*=\s*(["'])\s*(#|undefined|)\s*\1/iu.test(value) && !/\bdata-(?:src|srcset|lazy)/iu.test(value)),
  "SLOP-009": (text) => blocks(text).filter(({ body }) => /background-clip\s*:\s*text/iu.test(body) && /gradient\(/iu.test(body)).map(({ index, selector }) => ({ index, value: `${selector} clips a gradient to text` }))
    .concat(every(/\bbg-clip-text\b[^"'`]*\bbg-gradient-to-\w+|\bbg-gradient-to-\w+[^"'`]*\bbg-clip-text\b/gu, text)),
  "SLOP-008": (text) => {
    const { hueMin, hueMax, minChannelSpread } = RULES["SLOP-008"].threshold;
    return every(/(?:linear|radial|conic)-gradient\([^;{}]*\)/giu, text).filter(({ value }) => {
      const hues = (value.match(/#[0-9a-f]{3,6}\b/giu) ?? []).map(hueOfHex);
      return hues.some(({ h, spread }) => spread >= minChannelSpread && h >= hueMin && h <= hueMax);
    }).concat(every(/\bfrom-(?:violet|purple|fuchsia)-\d+[^"'`]*\bto-\w+-\d+/gu, text));
  },
  "SLOP-016": (text) => every(/font-family\s*:\s*["']?([A-Za-z ]+?)["']?\s*[,;}]/giu, text, (m) => m[1].trim())
    .filter(({ value }) => RULES["SLOP-016"].threshold.families.includes(value.toLowerCase()))
    .concat(every(/fonts\.googleapis\.com\/css2?\?family=([A-Za-z+]+)/gu, text, (m) => m[1].replaceAll("+", " ")).filter(({ value }) => RULES["SLOP-016"].threshold.families.includes(value.toLowerCase()))),
  "CF-503": (text) => {
    const min = RULES["CF-503"].threshold.minScale;
    const hits = [];
    for (const block of text.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/gu)) {
      const first = /(?:^|\})\s*(?:from|0%)\s*\{([^{}]*)\}/u.exec(block[2]);
      const scale = first && /scale(?:3d|X|Y)?\(\s*([\d.]+)|(?:^|[;\s])scale\s*:\s*([\d.]+)/u.exec(first[1]);
      const start = scale ? Number(scale[1] ?? scale[2]) : null;
      if (start !== null && start < min) hits.push({ index: block.index, value: `@keyframes ${block[1]} starts at scale ${start}` });
    }
    return hits.concat(every(/\binitial\s*(?:=\s*\{|:)\s*\{[^{}]*\bscale\s*:\s*0(?:\.\d+)?(?![\d])/gu, text).filter(({ value }) => Number(/scale\s*:\s*([\d.]+)/u.exec(value)[1]) < min));
  },
  "CF-505": (text) => {
    const { minControl, maxControl, nameTokens } = RULES["CF-505"].threshold;
    const out = (value) => value < minControl || value > maxControl;
    const bezier = every(/cubic-bezier\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/gu, text, (m) => m[0])
      .filter(({ value }) => /,\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)/u.exec(value).slice(1).map(Number).some(out));
    const linear = every(/linear\(([^()]*,[^()]*)\)/gu, text, (m) => m[0]).filter(({ value }) => value.slice(7, -1).split(",").map((stop) => parseFloat(stop)).some((v) => Number.isFinite(v) && out(v)));
    const names = every(new RegExp(`animation(?:-name)?\\s*:[^;{}]*?(?<![\\w-])(?:[\\w-]*[-_])?(${nameTokens.join("|")})(?:[-_][\\w-]*)?(?![\\w])`, "giu"), text);
    return bezier.concat(linear, names, every(/\banimate-bounce\b/gu, text));
  },
  "CF-508": (text) => every(/transition(?:-property)?\s*:\s*([^;{}]+)/giu, text, (m) => m[1]).filter(({ value }) => RULES["CF-508"].threshold.properties.some((name) => new RegExp(`(^|[\\s,])${name}(?![\\w-])`, "u").test(value))),
  "CF-507": (text) => every(/will-change\s*:\s*([^;{}"']+)/giu, text, (m) => m[1].trim()).filter(({ value }) => value.split(",").some((part) => !RULES["CF-507"].threshold.allowed.includes(part.trim()))),
  "CF-406": (text) => blocks(text).filter(({ selector, body }) => /backdrop-filter\s*:\s*blur/iu.test(body) && /(overlay|scrim|backdrop|modal)/iu.test(selector)).map(({ index, selector }) => ({ index, value: `${selector} blurs its backdrop` })),
  "SLOP-060": (text) => every(/lorem ipsum|dolor sit amet|\[placeholder\]|placeholder text/giu, text),
  "SLOP-061": (text) => every(/<marquee\b/giu, text),
  "SLOP-040": (text) => every(/>[^<>{}]*(?:—|(\S)\s+–\s+(\S))[^<>{}]*</gu, copyOf(text), (m) => m[0].slice(1, -1).trim())
    .filter(({ value }) => value.includes("—") || [...value.matchAll(/(\S)\s+–\s+(\S)/gu)].some((m) => !(/\d/u.test(m[1]) && /\d/u.test(m[2])))),
  "SLOP-036": (text) => every(new RegExp(`>[^<>{}]*?(?<![\\p{L}\\p{N}])(${RULES["SLOP-036"].threshold.phrases.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])[^<>{}]*<`, "giu"), copyOf(text), (m) => m[1]),
});

export const STATIC_RULES = Object.freeze(Object.keys(DETECTORS));

export function staticProbe(target) {
  const files = listSourceFiles(target);
  const root = statSync(target).isFile() ? dirname(target) : target;
  const findings = [];
  const candidates = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const id of STATIC_RULES) {
      for (const hit of DETECTORS[id](text)) {
        const selector = `${relative(root, file) || file}:${lineOf(text, hit.index)}`;
        if (RULES[id].judgment) {
          candidates.push({ rule: id, viewport: "static", reason: `judgment: ${hit.value} at ${selector} (${RULES[id].judgment})` });
          continue;
        }
        findings.push({
          rule: id,
          severity: RULES[id].severity,
          tier: "measured",
          viewport: "static",
          selector,
          value: hit.value,
          threshold: RULES[id].threshold ?? null,
          note: "static source match; not rendered",
        });
      }
    }
  }
  const notVerified = Object.keys(RULES).filter((id) => !STATIC_RULES.includes(id))
    .map((rule) => ({ rule, reason: "static fallback: needs a rendered DOM" }))
    .concat(candidates);
  return { files: files.length, findings, notVerified };
}

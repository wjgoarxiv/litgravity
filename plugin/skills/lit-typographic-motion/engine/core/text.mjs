// Text rules shared by the timeline builder, the type kit and the gate: typographic punctuation
// (MO-A-34), script runs (MO-FT-04), eojeol breaking (MO-A-13, MO-FT-05) and the one reading-floor
// function (MO-C-07/08). Pure functions only.
import { READING } from "./constants.mjs";

/** Typewriter punctuation to typographic: ... -> ellipsis, straight quotes -> curly, leading elisions. */
export function smart(text) {
  return text
    .replace(/\.\.\./gu, "…")
    .replace(/(^|[\s([{—–-])'(?=(?:cause|til|em|round|n|tis|twas|\d0s)\b)/giu, "$1’")
    .replace(/(^|[\s([{—–-])'/gu, "$1‘")
    .replace(/'/gu, "’")
    .replace(/(^|[\s([{—–-])"/gu, "$1“")
    .replace(/"/gu, "”");
}

/** Typographic punctuation back to typewriter, for the machine voice showing typed input. */
export const plain = (text) => text.replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"').replace(/…/gu, "...");

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/u;
const LETTER = /\p{L}/u;

/** 'hangul' | 'latin' | null (null = neutral: digit, punctuation, space, symbol). */
export function charScript(ch) {
  if (HANGUL.test(ch)) return "hangul";
  if (LETTER.test(ch)) return "latin";
  return null;
}

/**
 * Split a string into script runs. Neutral characters (digits, punctuation, spaces) attach to the
 * run beside them; between two different runs they attach to the run on the left, and before the
 * first letter they attach to the run on the right. A string with no letters is one latin run.
 * "2026년" is one hangul run; "LIT팀" is "LIT" + "팀".
 */
export function scriptRuns(text) {
  const chars = Array.from(text);
  const scripts = chars.map(charScript);
  const first = scripts.find((s) => s !== null) ?? "latin";
  let current = first;
  const resolved = scripts.map((s) => {
    if (s !== null) current = s;
    return current;
  });
  const runs = [];
  for (let i = 0; i < chars.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.script === resolved[i]) last.text += chars[i];
    else runs.push({ script: resolved[i], text: chars[i], start: i });
  }
  return runs;
}

export function textScript(text) {
  const kinds = new Set(Array.from(text).map(charScript).filter(Boolean));
  if (kinds.size === 0) return "latin";
  if (kinds.size === 2) return "mixed";
  return [...kinds][0];
}

/** Eojeol units: whitespace-separated words. A break or reveal step never splits one. */
export const eojeol = (text) => text.trim().split(/\s+/u).filter(Boolean);

/** Counts for the reading floor: Hangul syllables, Latin words, Latin-run characters incl. spaces. */
export function readingCounts(text) {
  const H = (text.match(/[가-힣]/gu) ?? []).length;
  const W = (text.match(/[\p{Script=Latin}\d'’-]+/gu) ?? []).length;
  const C = scriptRuns(text).filter((run) => run.script === "latin").reduce((sum, run) => sum + Array.from(run.text).length, 0);
  return { H, W, C };
}

/**
 * The one reading floor (MO-C-07/08). `kind` is line | scene | word | reveal. A scene unit with no
 * text has no reading floor (0); its minimum hold comes from the beat rule instead.
 */
export function readingFloor(text, kind) {
  if (kind === "reveal") return READING.revealFloor;
  const { H, W } = readingCounts(text ?? "");
  const rate = READING.secondsPerHangulSyllable * H + W / READING.wordsPerSecond;
  if (kind === "word") return Math.max(READING.wordFloor, rate);
  if (!text || !text.trim()) return 0;
  return Math.max(H > 0 ? READING.lineFloorHangul : READING.lineFloorLatin, rate);
}

/** Wrap text to lines no wider than `maxWidth`, breaking only at whitespace (eojeol boundaries). */
export function wrapByWidth(text, maxWidth, measure) {
  const words = eojeol(text);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || measure(candidate) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

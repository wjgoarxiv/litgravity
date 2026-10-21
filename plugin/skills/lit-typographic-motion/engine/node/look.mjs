// Look rounds: the record of which rendered frames the model actually opened and what it saw.
// `look.json` in the output directory is appended only by the `look` subcommand, so a gate re-run
// can never reset how many frames were viewed (RC8c). Each round is stamped with the SHA-256 of the
// stills index it looked at and of every frame it lists, so the done-check can tell a look at the
// final render from a look at an earlier one.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COVER, EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { readStills } from "./stills.mjs";

export const LOOK_FILE = "look.json";
export const QUESTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
// Cover mode asks its own eight (references/cover.md): motion in every half second, the seam, the
// motion surviving the encoder, the brand word, the three speed layers, slide-likeness, damage, and
// what a motion designer would change.
export const COVER_QUESTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
// A "no" on these, a "yes" on the next, or a named last question (film 7, cover 8) needs another round.
const REVISE = Object.freeze({
  film: { no: new Set([1, 2, 3, 5, 6]), yes: new Set([4, 8, 9]), named: 7 },
  cover: { no: new Set([1, 2, 3, 4, 5]), yes: new Set([6, 7]), named: 8 },
});
const PLACEHOLDER = /<[^<>\n]{1,80}>/u;
const BARE = /^\s*(?:yes|no|y|n|ok|none|named|네|아니요|아니오|예|없음|있음)[.!]?\s*$/iu;

export function readLook(out) {
  const file = path.join(out, LOOK_FILE);
  if (!existsSync(file)) return { rounds: [] };
  const doc = JSON.parse(readFileSync(file, "utf8"));
  return { ...doc, rounds: Array.isArray(doc.rounds) ? doc.rounds : [] };
}

/** Frames viewed in the latest look round (0 when no round was recorded or the file is unreadable). */
export function viewedCount(out) {
  try {
    const { rounds } = readLook(out);
    const last = rounds[rounds.length - 1];
    return Array.isArray(last?.viewed) ? last.viewed.length : 0;
  } catch {
    return 0;
  }
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const refuse = (message) => {
  throw new BlockedError(EXIT.USAGE, `LOOK_REFUSED: ${message}`);
};

/** An observation names something visible: one real sentence, not a verdict word. */
export function isObservation(text) {
  if (typeof text !== "string" || BARE.test(text) || PLACEHOLDER.test(text)) return false;
  const t = text.trim();
  const hangul = (t.match(/[가-힣]/gu) ?? []).length;
  const words = t.split(/\s+/u).filter(Boolean).length;
  return hangul >= 8 ? t.length >= 12 : t.length >= 20 && words >= 4;
}

/** Which answers ask for another round. */
export function reviseTriggers(answers, mode = "film") {
  const r = REVISE[mode];
  return answers.filter((a) => (r.no.has(a.q) && a.verdict === "no") || (r.yes.has(a.q) && a.verdict === "yes") || (a.q === r.named && a.verdict === "named")).map((a) => a.q);
}

/** Validate an answers document against the current stills set; returns the round record. */
export function checkAnswers(doc, { round, stills, out }) {
  if (!doc || typeof doc !== "object") refuse("the answers file must be a JSON object");
  const cover = stills.index.mode === "cover";
  const questions = cover ? COVER_QUESTIONS : QUESTIONS;
  const namedQ = cover ? REVISE.cover.named : REVISE.film.named;
  if (!cover && doc.defects !== undefined) refuse("defects are a cover-mode record; a film round names its weakest beat instead");
  const listed = new Set(stills.index.files.map((f) => f.file));
  const inSet = (file) => listed.has(file) && existsSync(path.join(out, file));
  if (!Array.isArray(doc.viewed) || !doc.viewed.length) refuse("viewed must list every stills file you opened with read_file this round");
  for (const file of doc.viewed) if (!inSet(file)) refuse(`viewed file ${JSON.stringify(file)} is not in the latest stills set (${path.join(out, "stills", "index.json")})`);
  if (!Array.isArray(doc.answers)) refuse(`answers must be an array of the ${cover ? "eight cover" : "nine"} questions`);
  const answers = [];
  const seen = new Set();
  for (const a of doc.answers) {
    if (!questions.includes(a?.q)) refuse(`unknown question ${JSON.stringify(a?.q)}`);
    if (seen.has(a.q)) refuse(`question ${a.q} is answered twice`);
    seen.add(a.q);
    const verdicts = a.q === namedQ ? ["none", "named"] : ["yes", "no"];
    if (!verdicts.includes(a.verdict)) refuse(`question ${a.q}: verdict must be ${verdicts.join(" or ")}`);
    if (!inSet(a.frame)) refuse(`question ${a.q}: frame ${JSON.stringify(a.frame)} is not in the latest stills set`);
    if (!isObservation(a.observed)) refuse(`question ${a.q}: observed must be at least one sentence naming a concrete visible detail in ${a.frame}, not a bare verdict`);
    if (a.q === 1 && !cover) {
      if (!["blind", "self"].includes(a.by)) refuse("question 1: by must be blind (a fresh subagent that saw only the sheet and the beat stills) or self");
      if (typeof a.sentence !== "string" || !a.sentence.trim() || PLACEHOLDER.test(a.sentence)) refuse("question 1: sentence must be the stranger's sentence, verbatim");
    }
    answers.push({ q: a.q, verdict: a.verdict, frame: a.frame, observed: a.observed.trim(), ...(a.q === 1 && !cover ? { by: a.by, sentence: a.sentence.trim() } : {}) });
  }
  const missing = questions.filter((q) => !seen.has(q));
  if (missing.length) refuse(`questions ${missing.join(", ")} are not answered`);
  const observed = answers.map((a) => a.observed.toLowerCase());
  if (new Set(observed).size !== observed.length) refuse("each answer needs its own observation; the same sentence is used twice");
  if (round === 1) {
    if (!cover && !Number.isInteger(doc.weakestBeat)) refuse("round 1 must name the weakest beat (weakestBeat: its index)");
    if (typeof doc.change !== "string" || doc.change.trim().length < 12 || PLACEHOLDER.test(doc.change)) refuse("round 1 must say the change made (change)");
  }
  answers.sort((a, b) => a.q - b.q);
  const defects = checkDefects(doc.defects, { cover, stills, inSet });
  return { answers, viewed: [...new Set(doc.viewed)], weakestBeat: doc.weakestBeat ?? null, change: doc.change ?? null, aids: Array.isArray(doc.aids) ? doc.aids.map(String) : [], ...(cover ? { defects } : {}) };
}

/**
 * Cover defects: at most three per round, each { t, region, frame, observed, cause, fix }. `t` is the
 * loop time in seconds where the defect shows, `region` the [x, y, w, h] it covers in cover pixels,
 * `frame` a file of the current stills set that shows it. A window re-render around `t` is how the
 * fix is checked before the next full render.
 */
function checkDefects(list, { cover, stills, inSet }) {
  if (list === undefined || !cover) return [];
  if (!Array.isArray(list)) refuse("defects must be an array");
  if (list.length > COVER.maxDefects) refuse(`at most ${COVER.maxDefects} defects per round; fix the worst first`);
  const { width, height, durationSec } = stills.index;
  return list.map((d, i) => {
    const f = `defect ${i + 1}`;
    if (!d || typeof d !== "object") refuse(`${f} must be an object`);
    if (typeof d.t !== "number" || !(d.t >= 0) || (durationSec && d.t >= durationSec)) refuse(`${f}: t must be the loop time in seconds${durationSec ? ` (0 to ${durationSec})` : ""} where the defect shows`);
    const r = d.region;
    if (!Array.isArray(r) || r.length !== 4 || !r.every(Number.isInteger) || r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0 || r[0] + r[2] > width || r[1] + r[3] > height) refuse(`${f}: region must be [x, y, w, h] inside the ${width}x${height} cover`);
    if (!inSet(d.frame)) refuse(`${f}: frame ${JSON.stringify(d.frame)} is not in the latest stills set`);
    if (!isObservation(d.observed)) refuse(`${f}: observed must be at least one sentence naming what is visible there`);
    if (![d.cause, d.fix].every((x) => typeof x === "string" && x.trim().length >= 8 && !PLACEHOLDER.test(x))) refuse(`${f}: cause and fix must each say something concrete`);
    return { t: d.t, region: r, frame: d.frame, observed: d.observed.trim(), cause: d.cause.trim(), fix: d.fix.trim() };
  });
}

/** `look --round N --answers <file>` (or `--blocked no-vision-tool`): append one round to look.json. */
export function lookCommand({ out, round, answersFile = null, blocked = null, now = new Date() }) {
  if (!(Number.isInteger(round) && round >= 1 && round <= 3)) refuse("--round must be 1, 2 or 3");
  const stills = readStills(out);
  if (!stills) refuse(`no stills set in ${out}; render first (with --stills-only for round 1)`);
  if (stills.index.round !== round) refuse(`the latest stills set is from round ${stills.index.round}; rounds share one counter with the renders, so look --round ${stills.index.round}, or render round ${round} first`);
  if (round === 1 && !stills.index.stillsOnly && stills.index.mode !== "cover") refuse("round 1 is always a stills round: render with --round 1 --stills-only, then look");
  const look = readLook(out);
  const last = look.rounds[look.rounds.length - 1];
  if (last && last.round > round) refuse(`round ${last.round} is already recorded; rounds only move forward`);
  const base = { round, at: now.toISOString(), stillsSha256: stills.sha256, stillsOnly: stills.index.stillsOnly, path: stills.index.path, ...(stills.index.mode === "cover" ? { mode: "cover" } : {}) };
  let record;
  if (blocked) {
    if (blocked !== "no-vision-tool") refuse("--blocked takes no-vision-tool");
    record = { ...base, blocked, viewed: [], answers: [], revise: [] };
  } else {
    if (!answersFile) refuse("look needs --answers <file> (or --blocked no-vision-tool)");
    let doc;
    try {
      doc = JSON.parse(readFileSync(answersFile, "utf8"));
    } catch (error) {
      refuse(`cannot read the answers file: ${error.message}`);
    }
    const checked = checkAnswers(doc, { round, stills, out });
    const frames = [...new Set([...checked.viewed, ...checked.answers.map((a) => a.frame)])].map((file) => ({ file, sha256: sha256(readFileSync(path.join(out, file))) }));
    record = { ...base, ...checked, frames, revise: reviseTriggers(checked.answers, stills.index.mode === "cover" ? "cover" : "film") };
  }
  writeFileSync(path.join(out, LOOK_FILE), `${JSON.stringify({ schema: "litgravity.motion-look/v1", rounds: [...look.rounds, record] }, null, 2)}\n`);
  const message = blocked
    ? `LOOK round ${round}: recorded blocked (${blocked}); the film can only end as DONE_UNVIEWED, and the reply must say nobody viewed the frames`
    : record.revise.length
      ? `LOOK round ${round}: recorded ${record.viewed.length} frames viewed; questions ${record.revise.join(", ")} ask for another round${round === 3 ? " (round 3: deliver with these open items stated plainly)" : ""}`
      : `LOOK round ${round}: recorded ${record.viewed.length} frames viewed; no answer asks for another round`;
  return { code: EXIT.OK, message, record };
}

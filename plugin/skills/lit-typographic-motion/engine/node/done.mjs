// The done-check (director brief section 9), shared by the Stop hook. A film is done only with a
// valid treatment, gate PASS on the final full render, at least two look rounds (the first a stills
// round with a change, the last stamped with the final render's stills manifest), and the last
// round's viewed list covering the poster, the sheet, every beat still and every strip, each opened
// with the host's image tool when the host exposes its tool events. It also compares the final
// treatment with the first valid one and records any downgrade. A cover (treatment mode: cover) is
// done on its own terms: the decoded cover reached every TARGET gate, and the last look round viewed
// the contact sheet, the poster and the seam pair of that render. A generated asset in assets.json
// becomes a label the reply has to carry.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { generatedLabels } from "./cover-assets.mjs";
import { validateCoverTreatment } from "./cover-treatment.mjs";
import { readLook } from "./look.mjs";
import { readStills } from "./stills.mjs";
import { validateTreatment } from "./treatment.mjs";

const SILENCE_ASKED = /무음|소리\s?없|음악\s?없|\bsilent\b|\bsilence\b|\bno\s+(?:sound|music|audio)\b|\bwithout\s+(?:sound|music|audio)\b|\bmuted?\b/iu;

export const treatmentSha = (out) => createHash("sha256").update(readFileSync(path.join(out, "treatment.json"))).digest("hex");

/** Beats covered by the subject devices (the count the downgrade rule compares). */
const subjectBeats = (t) => new Set((t.visualDevices ?? []).filter((d) => d.role === "subject").flatMap((d) => d.beats ?? [])).size;

/** Downgrades from the first valid treatment to the final one. */
export function downgrades(first, final) {
  if (!first) return [];
  const items = [];
  if (final.durationSec < first.durationSec * 0.8) items.push(`the film was shortened from ${first.durationSec} s to ${final.durationSec} s`);
  if (subjectBeats(final) < subjectBeats(first)) items.push(`the subject is on screen in fewer beats (${subjectBeats(first)} -> ${subjectBeats(final)})`);
  if (final.sound?.mode === "none" && first.sound?.mode !== "none" && !SILENCE_ASKED.test(final.request)) items.push("the sound was switched to none without a user request");
  if (first.path === "stage" && final.path === "type") items.push("the path moved from stage to type");
  return items;
}

/**
 * Evaluate done for an output directory. `viewedFiles` is a Set of absolute paths the host's image
 * tool opened (null when the host exposes no tool events). Returns
 * { status: "DONE" | "DONE_UNVIEWED" | "NOT_DONE", reasons, downgraded, openItems }.
 */
export function evaluateDone({ out, viewedFiles = null }) {
  const reasons = [];
  const notDone = (reason) => ({ status: "NOT_DONE", reasons: [reason], downgraded: [], openItems: [] });
  if (!out) return notDone("the render's output directory is unknown");
  const tFile = path.join(out, "treatment.json");
  if (!existsSync(tFile)) return notDone(`treatment.json is missing in ${out}`);
  let treatment;
  try {
    const raw = JSON.parse(readFileSync(tFile, "utf8"));
    if (raw?.mode === "cover") return evaluateCoverDone({ out, raw, viewedFiles });
    treatment = validateTreatment(raw);
  } catch (error) {
    return notDone(`treatment.json is not valid: ${error.message}`);
  }
  const manifestFile = path.join(out, "manifest.json");
  const reportFile = path.join(out, "gate-report.txt");
  if (!existsSync(manifestFile) || !existsSync(reportFile)) return notDone("no full render has finished (manifest.json or gate-report.txt is missing)");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch {
    return notDone("manifest.json is unreadable");
  }
  if (manifest.treatmentSha256 && manifest.treatmentSha256 !== treatmentSha(out)) reasons.push("treatment.json changed after the last full render; render again");
  if (!/^QA gate: PASS$/mu.test(readFileSync(reportFile, "utf8"))) reasons.push("the gate did not pass on the last full render (gate-report.txt)");
  const stills = readStills(out);
  if (!stills) reasons.push("the stills set is missing");
  else if (stills.index.stillsOnly) reasons.push("the latest stills set is from a stills-only render; the final full render has not run since");
  let look;
  try {
    look = readLook(out);
  } catch {
    return notDone("look.json is unreadable");
  }
  const rounds = look.rounds;
  if (!existsSync(path.join(out, "look.json"))) reasons.push("look.json is missing: no look round was recorded");
  const openItems = [];
  let unviewed = false;
  if (rounds.length) {
    const first = rounds[0];
    const last = rounds[rounds.length - 1];
    if (rounds.length < 2) reasons.push("only one look round is recorded; look at the final render and record the last round");
    if (!first.blocked && (first.round !== 1 || !first.stillsOnly || !first.change)) reasons.push("round 1 must be a stills round that names the change made");
    if (stills && last.stillsSha256 !== stills.sha256) reasons.push("the last look round was recorded before the final render (its stills manifest differs); look again and record it");
    if (last.blocked === "no-vision-tool") unviewed = true;
    else if (stills) {
      const required = stills.index.files.filter((f) => ["poster", "sheet", "beat", "strip"].includes(f.kind)).map((f) => f.file);
      const missing = required.filter((f) => !last.viewed?.includes(f));
      if (missing.length) reasons.push(`the last look round did not view ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? ` (+${missing.length - 4})` : ""}`);
      if (viewedFiles) {
        const unopened = (last.viewed ?? []).filter((f) => !viewedFiles.has(path.resolve(out, f)));
        if (unopened.length) reasons.push(`these frames are listed as viewed but were never opened with read_file: ${unopened.slice(0, 4).join(", ")}${unopened.length > 4 ? ` (+${unopened.length - 4})` : ""}`);
      }
      if (last.revise?.length) {
        if (last.round >= 3) openItems.push(...last.revise.map((q) => `look question ${q}`));
        else reasons.push(`look questions ${last.revise.join(", ")} ask for another round`);
      }
    }
  }
  let first = null;
  try {
    const firstFile = path.join(out, ".run", "treatment.first.json");
    if (existsSync(firstFile)) first = JSON.parse(readFileSync(firstFile, "utf8"));
  } catch {
    first = null;
  }
  const downgraded = downgrades(first, treatment);
  if (reasons.length) return { status: "NOT_DONE", reasons, downgraded, openItems };
  return { status: unviewed ? "DONE_UNVIEWED" : "DONE", reasons: [], downgraded, openItems };
}

/** The cover branch of the done-check (references/cover.md, Done). */
export function evaluateCoverDone({ out, raw, viewedFiles = null }) {
  const notDone = (reason) => ({ status: "NOT_DONE", reasons: [reason], downgraded: [], openItems: [], mode: "cover" });
  try {
    validateCoverTreatment(raw);
  } catch (error) {
    return notDone(`treatment.json is not valid: ${error.message}`);
  }
  const manifestFile = path.join(out, "manifest.json");
  const reportFile = path.join(out, "gate-report.txt");
  if (!existsSync(manifestFile) || !existsSync(reportFile)) return notDone("no cover render has finished (manifest.json or gate-report.txt is missing)");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch {
    return notDone("manifest.json is unreadable");
  }
  const reasons = [];
  if (manifest.mode !== "cover") reasons.push("the last render was not a cover render; run motion.mjs cover");
  if (manifest.treatmentSha256 !== treatmentSha(out)) reasons.push("treatment.json changed after the last cover render; render again");
  if (!/^COVER gate --strict: PASS\+TARGET$/mu.test(readFileSync(reportFile, "utf8"))) reasons.push("the decoded cover did not reach every TARGET gate on the last render (gate-report.txt)");
  const stills = readStills(out);
  if (!stills || stills.index.mode !== "cover") reasons.push("the cover stills set is missing");
  let look;
  try {
    look = readLook(out);
  } catch {
    return notDone("look.json is unreadable");
  }
  const rounds = look.rounds;
  const openItems = [];
  let unviewed = false;
  if (!rounds.length) reasons.push("look.json has no round: open the sheet, the poster and the seam pair with read_file and record a look round");
  else {
    const first = rounds[0];
    const last = rounds[rounds.length - 1];
    if (rounds.length < 2) reasons.push("only one look round is recorded; make the change it named, render again, look again");
    if (!first.blocked && !first.change) reasons.push("round 1 must name the change made after it");
    if (stills && last.stillsSha256 !== stills.sha256) reasons.push("the last look round was recorded before the final cover render; look again and record it");
    if (last.blocked === "no-vision-tool") unviewed = true;
    else if (stills) {
      const required = stills.index.files.filter((f) => ["sheet", "poster", "seam"].includes(f.kind)).map((f) => f.file);
      const missing = required.filter((f) => !last.viewed?.includes(f));
      if (missing.length) reasons.push(`the last look round did not view ${missing.join(", ")}`);
      if (viewedFiles) {
        const unopened = (last.viewed ?? []).filter((f) => !viewedFiles.has(path.resolve(out, f)));
        if (unopened.length) reasons.push(`these files are listed as viewed but were never opened with read_file: ${unopened.slice(0, 4).join(", ")}${unopened.length > 4 ? ` (+${unopened.length - 4})` : ""}`);
      }
      if (last.revise?.length) {
        if (last.round >= 3) openItems.push(...last.revise.map((q) => `cover look question ${q}`));
        else reasons.push(`cover look questions ${last.revise.join(", ")} ask for another round`);
      }
    }
  }
  const labels = generatedLabels(out);
  if (reasons.length) return { status: "NOT_DONE", reasons, downgraded: [], openItems, labels, mode: "cover" };
  return { status: unviewed ? "DONE_UNVIEWED" : "DONE", reasons: [], downgraded: [], openItems, labels, mode: "cover" };
}

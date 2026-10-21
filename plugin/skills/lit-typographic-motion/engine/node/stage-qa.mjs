// The stage path's DOM text QA (director brief 6g). A separate Chrome replays the clock from 0; the
// master capture is never touched. At 10 fps it reads every text run (DOM text, ::before/::after,
// registered canvas text) with its rects and opacity; at the QA samples (each beat midpoint plus two
// settled frames per beat) it captures A, switches the ink rule on, captures B, and measures the ink
// mask A != B inside each run's rects. From those it judges copy found, contrast, title-safe, the
// reading floor, decor limits, meta labels, fonts, unmeasured canvas text and non-text presence.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXIT, GATE } from "../core/constants.mjs";
import { measureContrast } from "../core/contrast.mjs";
import { readingFloor } from "../core/text.mjs";
import { STAGE_FAMILIES } from "./stage-serve.mjs";
import { normalizeText, stripQuoted } from "./treatment.mjs";

const QA_FILE = fileURLToPath(new URL("../stage/qa.js", import.meta.url));

export const TEXT_QA = Object.freeze({
  sampleFps: 10, visibleOpacity: 0.6, settledOpacity: 0.95, settledMovePx: 2, minInkPx: 12, inkDelta: 2,
  titleSafeInset: 0.05, largeShare: 0.03, decorAreaShare: 0.25, readingToleranceSec: 0.1, presenceStd: 8 / 255,
  settledAt: [0.75, 0.9], internalTerms: /\b(?:path|preset|gate|beat|treatment)\b/iu,
  fileName: /\b[\w-]+\.(?:html?|m?js|css|png|jpe?g|webp|gif|svg|json|wav|mp4)\b/iu,
});

// The family names Chrome reports for the product's own faces (CSS.getPlatformFontsForNode).
const PLATFORM_FAMILIES = new Set([...STAGE_FAMILIES, "Pretendard Regular", "Pretendard Bold", "Archivo SemiCondensed", "Archivo Condensed", "Archivo Expanded", "Archivo SemiExpanded", "Archivo Black", "MesloLGS NF Regular", "Silkscreen Bold"]);
export const isProductFont = (font) => font.isCustomFont && [...PLATFORM_FAMILIES].some((f) => font.familyName === f || font.familyName.startsWith(`${f} `));

const r = (id, status, detail, extra = {}) => ({ id, status, detail, ...extra });
const union = (rects) => (rects.length ? [Math.min(...rects.map((x) => x[0])), Math.min(...rects.map((x) => x[1])), Math.max(...rects.map((x) => x[2])), Math.max(...rects.map((x) => x[3]))] : null);

/** Classify a run against the treatment's copy: "copy" | "decor" | "other". */
export function runClass(run, copyNorm) {
  if (run.decor) return "decor";
  const n = normalizeText(run.text);
  if (!n) return "other";
  return copyNorm.some((line) => line.includes(n) || n.includes(line)) ? "copy" : "other";
}

/** The QA sample frames: each beat midpoint plus two settled frames late in the beat. */
export function qaSamples({ beats, fps, frameCount }) {
  const clamp = (f) => Math.max(0, Math.min(frameCount - 1, f));
  const rows = [];
  beats.forEach((b, i) => {
    rows.push({ frame: clamp(Math.round(((b.t0 + b.t1) / 2) * fps)), beat: i, mid: true });
    for (const k of TEXT_QA.settledAt) rows.push({ frame: clamp(Math.round((b.t0 + k * (b.t1 - b.t0)) * fps)), beat: i, mid: false });
  });
  const seen = new Map();
  for (const row of rows) if (!seen.has(row.frame) || row.mid) seen.set(row.frame, row);
  return [...seen.values()].sort((a, b) => a.frame - b.frame);
}

/** Ink mask where A and B differ by more than 2 levels in any channel; returns { mask, count }. */
export function inkMask(a, b, width, height) {
  const mask = Buffer.alloc(width * height);
  for (let i = 0, p = 0; p < mask.length; i += 4, p++) {
    if (Math.abs(a[i] - b[i]) > TEXT_QA.inkDelta || Math.abs(a[i + 1] - b[i + 1]) > TEXT_QA.inkDelta || Math.abs(a[i + 2] - b[i + 2]) > TEXT_QA.inkDelta) mask[p] = 255;
  }
  return mask;
}

const countIn = (mask, width, rect) => {
  let n = 0;
  const [x0, y0, x1, y1] = rect.map((v) => Math.round(v));
  for (let y = Math.max(0, y0); y < Math.min(mask.length / width, y1); y++) for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) if (mask[y * width + x]) n++;
  return n;
};

/** Pixels of the mask outside every run rect grown by 2 px (state moved between A and B). */
export function strayInk(mask, width, height, rects) {
  const grown = rects.map(([x0, y0, x1, y1]) => [x0 - 2, y0 - 2, x1 + 2, y1 + 2]);
  let stray = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (!grown.some((g) => x >= g[0] && x < g[2] && y >= g[1] && y < g[3])) stray++;
    }
  }
  return stray;
}

/** Luminance standard deviation of B outside the text boxes (non-text presence). */
export function groundStd(rgba, width, height, rects) {
  let n = 0;
  let sum = 0;
  let sq = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (rects.some((g) => x >= g[0] && x < g[2] && y >= g[1] && y < g[3])) continue;
      const i = (y * width + x) * 4;
      const l = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
      n++;
      sum += l;
      sq += l * l;
    }
  }
  return n ? Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) : 0;
}

/**
 * Judge the collected samples. `timeline` is [{ frame, t, runs }] at 10 fps; `samples` is
 * [{ frame, beat, mid, runs, mask, rgbaA, rgbaB, stray, fonts }]. Pure, so the tests can drive it.
 */
export function judgeText({ treatment, width, height, timeline, samples, canvasUnmeasured = [], stageFiles = [] }) {
  const rules = [];
  const copy = treatment.copy.lines;
  const copyNorm = copy.map(normalizeText);
  const shortSide = Math.min(width, height);
  const safe = [width * TEXT_QA.titleSafeInset, height * TEXT_QA.titleSafeInset, width * (1 - TEXT_QA.titleSafeInset), height * (1 - TEXT_QA.titleSafeInset)];
  const allRuns = [...timeline.flatMap((s) => s.runs), ...samples.flatMap((s) => s.runs)];

  // Copy found: every line appears, normalized, in some run or registered canvas text.
  const shown = (run) => run.opacity >= TEXT_QA.visibleOpacity && run.rects.length > 0;
  const missing = copy.filter((line, i) => !allRuns.some((run) => shown(run) && normalizeText(run.text).includes(copyNorm[i])));
  const exit = missing.length ? { exit: EXIT.STAGE_CONTRACT_ERROR, message: `STAGE_CONTRACT_ERROR: copy line not on screen: "${missing[0]}"; every copy.lines entry must appear in one text run (mark its element with LitStage.text)` } : null;
  rules.push(missing.length ? r("TEXT-COPY-FOUND", "FAIL", `not on screen: ${missing.map((m) => `"${m}"`).join(", ")}`) : r("TEXT-COPY-FOUND", "PASS", `all ${copy.length} copy lines found on screen`));

  const usable = samples.filter((s) => !s.discarded);
  const moved = samples.filter((s) => s.discarded);
  if (moved.length) rules.push(r("TEXT-SAMPLES", "WARN", `${moved.length} QA sample(s) discarded: state moved between the A and B captures (frames ${moved.map((s) => s.frame).join(", ")})`));

  // Settled: the run's box moved < 2 px since the neighbouring 10 fps samples, opacity >= 0.95.
  const boxAt = (frame, id) => {
    const row = timeline.find((s) => s.frame === frame);
    return row ? union(row.runs.find((x) => x.id === id)?.rects ?? []) : null;
  };
  const step = timeline.length > 1 ? timeline[1].frame - timeline[0].frame : 6;
  const settled = (frame, run) => {
    if (run.opacity < TEXT_QA.settledOpacity) return false;
    const here = union(run.rects);
    if (!here) return false;
    const near = [Math.floor(frame / step) * step, Math.ceil(frame / step) * step, Math.floor(frame / step) * step - step].filter((f) => f !== frame && f >= 0);
    return near.every((f) => {
      const b = boxAt(f, run.id);
      return !b || Math.max(...b.map((v, i) => Math.abs(v - here[i]))) < TEXT_QA.settledMovePx;
    });
  };

  const contrastFails = [];
  const contrastWarns = [];
  const safeFails = [];
  const decorCopy = new Set();
  const decorShare = [];
  let measured = 0;
  for (const s of usable) {
    let decorArea = 0;
    let textArea = 0;
    for (const run of s.runs) {
      const cls = runClass(run, copyNorm);
      const box = union(run.rects);
      if (!box || run.opacity < TEXT_QA.visibleOpacity) continue;
      const ink = run.kind === "canvas" ? null : countIn(s.mask, width, box);
      if (ink !== null && ink < TEXT_QA.minInkPx) continue;
      const area = (box[2] - box[0]) * (box[3] - box[1]);
      textArea += area;
      if (run.decor) decorArea += area;
      if (cls === "copy" && (box[0] < safe[0] - 0.5 || box[1] < safe[1] - 0.5 || box[2] > safe[2] + 0.5 || box[3] > safe[3] + 0.5)) safeFails.push(`"${run.text.slice(0, 40)}"@${s.frame}`);
      if (run.kind === "canvas" || !settled(s.frame, run)) continue;
      const c = measureContrast({ rgba: s.rgbaA, mask: s.mask, width, height, bbox: box, capHeightPx: run.capHeightPx, gradient: run.gradient, scale: 1 });
      if (!c) continue;
      measured++;
      const large = run.fontSizePx >= TEXT_QA.largeShare * shortSide;
      const floor = large ? GATE.contrastLarge : GATE.contrastBody;
      if (c.ratio < floor) (cls === "copy" ? contrastFails : contrastWarns).push(`"${run.text.slice(0, 40)}"@${s.frame}: ${c.ratio.toFixed(2)}:1 < ${floor}:1`);
    }
    if (textArea > 0) decorShare.push({ frame: s.frame, share: decorArea / textArea });
  }
  for (const run of allRuns) if (run.decor && shown(run) && copyNorm.some((line) => normalizeText(run.text).includes(line))) decorCopy.add(run.text);
  if (!usable.length) rules.push(r("TEXT-CONTRAST", "WARN", "no usable QA sample: contrast was not measured; the look must answer it"));
  else rules.push(contrastFails.length ? r("TEXT-CONTRAST", "FAIL", contrastFails.slice(0, 4).join(", "))
    : measured === 0 ? r("TEXT-CONTRAST", "WARN", "no settled text sample could be measured; the look must answer legibility")
      : r("TEXT-CONTRAST", contrastWarns.length ? "WARN" : "PASS", contrastWarns.length ? `copy passes; non-copy text: ${contrastWarns.slice(0, 3).join(", ")}` : `${measured} settled text measurements at or above 4.5:1 (3:1 at >= 3 % of the short side)`));
  rules.push(safeFails.length ? r("TEXT-TITLE-SAFE", "FAIL", `copy outside the central 90 %: ${safeFails.slice(0, 4).join(", ")}`) : r("TEXT-TITLE-SAFE", "PASS", "every copy run inside the central 90 % of the frame at the QA samples"));
  const heavy = decorShare.filter((d) => d.share > TEXT_QA.decorAreaShare);
  rules.push(decorCopy.size || heavy.length
    ? r("TEXT-DECOR", "FAIL", [decorCopy.size ? `decor text carries copy: ${[...decorCopy].map((t) => `"${t.slice(0, 40)}"`).join(", ")}` : null, heavy.length ? `decor text over 25 % of the visible text area at frame ${heavy[0].frame} (${(heavy[0].share * 100).toFixed(0)} %)` : null].filter(Boolean).join("; "))
    : r("TEXT-DECOR", "PASS", "decor text carries no copy and stays within 25 % of the text area"));

  // Reading floor at 10 fps: the longest continuous visible span of each copy line.
  const reading = [];
  for (const [i, line] of copy.entries()) {
    const floor = readingFloor(line, "line");
    let best = 0;
    let run = 0;
    for (const row of timeline) {
      const sample = usable.find((s) => s.frame === row.frame);
      const visible = row.runs.some((x) => {
        if (!normalizeText(x.text).includes(copyNorm[i]) || x.opacity < TEXT_QA.visibleOpacity || !x.rects.length) return false;
        if (!sample || x.kind === "canvas") return true;
        const box = union(sample.runs.find((y) => y.id === x.id)?.rects ?? []);
        return !box || countIn(sample.mask, width, box) >= TEXT_QA.minInkPx;
      });
      run = visible ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const shown = best / TEXT_QA.sampleFps;
    reading.push({ line, shown, floor, ok: shown >= floor - TEXT_QA.readingToleranceSec });
  }
  const short = reading.filter((x) => !x.ok);
  rules.push(short.length ? r("TEXT-READING", "FAIL", short.map((x) => `"${x.line.slice(0, 40)}" readable ${x.shown.toFixed(1)} s < ${x.floor.toFixed(2)} s`).join(", "))
    : r("TEXT-READING", "PASS", reading.length ? `tightest: "${[...reading].sort((a, b) => a.shown - a.floor - (b.shown - b.floor))[0].line.slice(0, 40)}"` : "no copy"));

  // Meta labels: request text, the idea, a file name or an internal term on screen (the look answers it).
  const request = normalizeText(stripQuoted(treatment.request));
  const idea = normalizeText(treatment.idea);
  const names = stageFiles.map((f) => f.toLowerCase());
  const labels = new Set();
  for (const run of allRuns) {
    const n = normalizeText(run.text);
    if (!n) continue;
    if ((request.length >= 4 && n.includes(request)) || (n.length >= 6 && request.includes(n) && !copyNorm.some((l) => l.includes(n))) || (idea && n.includes(idea)) || TEXT_QA.fileName.test(run.text) || names.some((f) => run.text.toLowerCase().includes(f)) || TEXT_QA.internalTerms.test(run.text)) labels.add(run.text.slice(0, 60));
  }
  rules.push(labels.size ? r("TEXT-META-LABEL", "WARN", `answer look question 4 about: ${[...labels].slice(0, 4).map((t) => `"${t}"`).join(", ")}`) : r("TEXT-META-LABEL", "PASS", "no request text, file name or internal term on screen"));

  // Fonts at the beat midpoints: only the product's faces.
  const foreign = [];
  for (const s of usable.filter((x) => x.mid)) {
    for (const [id, fonts] of Object.entries(s.fonts ?? {})) {
      const bad = fonts.filter((f) => !isProductFont(f));
      if (!bad.length) continue;
      const run = s.runs.find((x) => String(x.id) === id);
      foreign.push({ copy: run ? runClass(run, copyNorm) === "copy" : false, text: run?.text ?? id, family: bad[0].familyName });
    }
  }
  rules.push(foreign.some((f) => f.copy) ? r("TEXT-FONTS", "FAIL", `copy set in a face outside the product's set: ${foreign.filter((f) => f.copy).slice(0, 3).map((f) => `"${f.text.slice(0, 30)}" in ${f.family}`).join(", ")}`)
    : foreign.length ? r("TEXT-FONTS", "WARN", `non-copy text outside the product's faces: ${foreign.slice(0, 3).map((f) => `"${f.text.slice(0, 30)}" in ${f.family}`).join(", ")}`)
      : r("TEXT-FONTS", "PASS", "every run at the beat midpoints uses the product's faces"));

  rules.push(canvasUnmeasured.length ? r("TEXT-CANVAS", "WARN", `canvas text not measured at frames ${canvasUnmeasured.slice(0, 6).join(", ")}: register it with LitStage.text({content, x, y, w, h}); the look must answer it`) : r("TEXT-CANVAS", "PASS", "no unregistered canvas text"));

  const mids = usable.filter((s) => s.mid);
  const present = mids.filter((s) => s.groundStd > TEXT_QA.presenceStd).length;
  rules.push(mids.length && present * 2 >= mids.length ? r("TEXT-PRESENCE", "PASS", `${present} of ${mids.length} beat midpoints show drawn content outside the text`) : r("TEXT-PRESENCE", "WARN", `only ${present} of ${mids.length} beat midpoints show drawn content outside the text; the film may only name its subject`));
  return { rules, ...(exit ?? {}) };
}

/**
 * The QA replay, as the stage renderer's `qa` hook: opens its own Chrome, steps the clock from 0,
 * collects the timeline and the A/B samples, and returns { rules, exit?, message? }.
 */
export function textQaReplay({ pool, stageFiles = [] }) {
  return async ({ ctx, fps, frameCount, openBrowser, stepChecked }) => {
    const { width, height, treatment } = ctx;
    const browser = await openBrowser("q");
    const every = Math.max(1, Math.round(fps / TEXT_QA.sampleFps));
    const samples = qaSamples({ beats: treatment.beats, fps, frameCount });
    const byFrame = new Map(samples.map((s) => [s.frame, s]));
    const timeline = [];
    const collected = [];
    const canvasUnmeasured = [];
    try {
      await browser.evaluate(readFileSync(QA_FILE, "utf8"));
      await browser.send("DOM.enable");
      await browser.send("CSS.enable");
      for (let f = 0; f < frameCount; f++) {
        const sample = byFrame.get(f);
        const s = await stepChecked(browser, f, fps, { paint: Boolean(sample) });
        if (s.canvasTextCalls > 0 && s.texts === 0 && f % every === 0) canvasUnmeasured.push(f);
        if (f % every !== 0 && !sample) continue;
        const runs = await browser.evaluate("window.__litQa.runs()");
        if (f % every === 0) timeline.push({ frame: f, t: f / fps, runs });
        if (!sample) continue;
        const a = await pool.analyze(await browser.capture(), width, height);
        await browser.evaluate("window.__litQa.ink(true)");
        const b = await pool.analyze(await browser.capture(), width, height);
        await browser.evaluate("window.__litQa.ink(false)");
        const mask = inkMask(a.rgba, b.rgba, width, height);
        const rects = runs.flatMap((x) => x.rects);
        const stray = strayInk(mask, width, height, rects);
        let fonts = {};
        if (sample.mid) fonts = await platformFonts(browser, runs);
        collected.push({ ...sample, runs, mask, rgbaA: a.rgba, discarded: stray > 0, stray, fonts, groundStd: groundStd(b.rgba, width, height, rects) });
      }
    } finally {
      await browser.close();
    }
    return judgeText({ treatment, width, height, timeline, samples: collected, canvasUnmeasured, stageFiles });
  };
}

async function platformFonts(browser, runs) {
  const out = {};
  const { root } = await browser.send("DOM.getDocument", { depth: 0 });
  for (const run of runs) {
    if (run.kind === "canvas" || !run.rects.length) continue;
    try {
      const { nodeId } = await browser.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-lit-run="${run.id}"]` });
      if (!nodeId) continue;
      const { fonts } = await browser.send("CSS.getPlatformFontsForNode", { nodeId });
      out[run.id] = fonts;
    } catch {
      // A node that left the DOM between the read and the query has no fonts to judge.
    }
  }
  return out;
}

// The numeric QA gate (MO-C-01..29, MO-D-02..04, and every MO-A / MO-SH rule a render log can
// prove). Pure: `evaluateGate(data)` takes already-collected data (manifest, frame log, preview
// audit, exports, determinism, perf, contrast samples) and returns one verdict per rule, so every
// rule has a small failing fixture without a browser. node/gate.mjs collects the data from a
// render's output directory.
import { GATE, SHADER, READING, SOFTWARE_RENDERERS, POST_FIELDS, PASS_IDS, FLASH_EVENT_THRESHOLD, PROVISIONAL_RULES } from "./constants.mjs";
import { readingFloor, readingCounts } from "./text.mjs";
import { auditRecords } from "./flash.mjs";
import { hexToRgb, hsl, hueDistance } from "./util.mjs";

const r = (id, status, detail, extra = {}) => ({ id, status, detail, provisional: PROVISIONAL_RULES.includes(id), ...extra });
const PASS = "PASS";
const FAIL = "FAIL";
const WARN = "WARN";
const NA = "N/A";

export const isSoftware = (renderer) => SOFTWARE_RENDERERS.some((s) => String(renderer ?? "").toLowerCase().includes(s));
const inside = (b, [x0, y0, x1, y1]) => b[0] >= x0 - 1e-6 && b[1] >= y0 - 1e-6 && b[2] <= x1 + 1e-6 && b[3] <= y1 + 1e-6;
const overrun = (b, [x0, y0, x1, y1]) => Math.max(x0 - b[0], y0 - b[1], b[2] - x1, b[3] - y1, 0);

function frameIndexOfTime(t, fps) {
  return Math.round(t * fps);
}

/** MO-C-01 + MO-SH-00a/00b: interval-union coverage and per-range continuity from the log. */
function glslPresence({ manifest, passLines, frameCount }) {
  const covered = new Uint8Array(frameCount);
  const seen = new Map();
  for (const line of passLines) {
    if (!PASS_IDS.includes(line.pass)) continue;
    if (!seen.has(line.pass)) seen.set(line.pass, new Set());
    seen.get(line.pass).add(line.frame);
    if (line.draws >= 1 && line.frame >= 0 && line.frame < frameCount) covered[line.frame] = 1;
  }
  const gaps = [];
  for (let f = 0; f < frameCount; f++) if (!covered[f]) gaps.push(f);
  const broken = [];
  for (const range of manifest.passRanges ?? []) {
    const frames = seen.get(range.pass) ?? new Set();
    for (let f = range.frameStart; f <= range.frameEnd; f++) {
      if (!frames.has(f)) {
        broken.push(`${range.pass}@${range.sceneId}#${range.shotIndex} frame ${f}`);
        break;
      }
    }
  }
  if (!(manifest.passRanges ?? []).length) return r("MO-C-01", FAIL, "manifest lists no look-library pass");
  if (gaps.length) return r("MO-C-01", FAIL, `${gaps.length} frame(s) with no pass that drew (first: ${gaps[0]})`);
  if (broken.length) return r("MO-C-01", FAIL, `manifest range with no log line (MO-SH-00a): ${broken.slice(0, 3).join(", ")}`);
  return r("MO-C-01", PASS, `every one of ${frameCount} frames covered by a pass with draws >= 1`);
}

function webgl2Tier({ manifest, reportNotice }) {
  if (!manifest.renderer) return r("MO-C-02", FAIL, "no WebGL2 renderer recorded");
  const software = isSoftware(manifest.renderer);
  if (software && !manifest.softwareRenderer) return r("MO-C-02", FAIL, `software renderer "${manifest.renderer}" is not labelled softwareRenderer`);
  if (software && reportNotice === false) return r("MO-C-02", FAIL, "software renderer without the 'software-rendered, --samples lowered' notice");
  return r("MO-C-02", PASS, `${software ? "software" : "hardware"} — ${manifest.renderer}`);
}

function softwareDowngrade({ manifest }) {
  if (!manifest.softwareRenderer) return r("MO-SH-09", NA, "hardware renderer; no downgrade needed");
  const problems = [];
  if (manifest.samples !== 1) problems.push(`samples ${manifest.samples} (must be 1)`);
  for (const p of manifest.passRanges ?? []) {
    if (["tidal-gradient", "crt"].includes(p.pass) && !p.downgraded) problems.push(`${p.pass}@${p.sceneId}#${p.shotIndex} not marked downgraded`);
    if (p.pass === "crt" && p.params?.persistenceEnabled) problems.push("crt persistence left on");
  }
  return problems.length ? r("MO-SH-09", FAIL, problems.join("; ")) : r("MO-SH-09", PASS, "software GL: samples 1, octaves and persistence downgraded, marked downgraded:true");
}

function flashAudit({ masterFlash, previewFlash, manifest }) {
  const master = auditRecords(masterFlash, manifest.fps, { loop: false });
  const preview = previewFlash ? auditRecords(previewFlash.records, previewFlash.fps, { loop: true }) : null;
  const worst = Math.max(master.general.flashes, preview?.general.flashes ?? 0);
  const worstRed = Math.max(master.red.flashes, preview?.red.flashes ?? 0);
  const detail = `master worst window ${master.general.flashes} general / ${master.red.flashes} red (at ${master.general.startSec}s)`
    + (preview ? `; preview (looping) ${preview.general.flashes} / ${preview.red.flashes}` : "; preview not audited")
    + " (limit 3 / 3)";
  const ok = master.pass && (preview ? preview.pass : true);
  return r("MO-C-03", ok ? PASS : FAIL, detail, { worst, worstRed, master, preview, previewMissing: !preview });
}

function fullFrameStep({ masterFlash }) {
  const bad = masterFlash.map((rec, i) => ({ i, a: rec.stepArea })).filter((x) => x.a > SHADER.fullFrameStepArea);
  return bad.length ? r("MO-SH-04a", FAIL, `full-frame luminance step at frame ${bad[0].i} (${(bad[0].a * 100).toFixed(1)}% of cells moved >= 0.1)`) : r("MO-SH-04a", PASS, "no frame pair steps more than 25% of the frame");
}

function safeAreas({ frames }) {
  const title = [];
  const action = [];
  for (const fr of frames) {
    for (const b of fr.textBoxes ?? []) if (!inside(b.bbox, GATE.titleSafe)) title.push(`"${b.text}"@${fr.frame}:${overrun(b.bbox, GATE.titleSafe).toFixed(1)}px`);
    for (const e of fr.elements ?? []) if (!inside(e.bbox, GATE.actionSafe)) action.push(`${e.elementId}@${fr.frame}:${overrun(e.bbox, GATE.actionSafe).toFixed(1)}px`);
  }
  return [
    title.length ? r("MO-C-04", FAIL, `violations: ${title.slice(0, 4).join(", ")}${title.length > 4 ? ` (+${title.length - 4})` : ""}`) : r("MO-C-04", PASS, "every glyph bbox inside [96, 54]-[1824, 1026]"),
    action.length ? r("MO-C-05", FAIL, `violations: ${action.slice(0, 4).join(", ")}`) : r("MO-C-05", PASS, "every non-glyph element inside [48, 27]-[1872, 1053]"),
  ];
}

export const isLargeType = (box) => box.fontSizePx >= GATE.largeFontPx || (box.fontSizePx >= GATE.largeBoldFontPx && box.weight >= GATE.largeBoldWeight);

function contrast({ contrastSamples }) {
  if (!contrastSamples.length) return r("MO-C-06", FAIL, "no contrast samples were recorded");
  let worst = null;
  const failures = [];
  for (const s of contrastSamples) {
    const floor = isLargeType(s) ? GATE.contrastLarge : GATE.contrastBody;
    const margin = s.ratio / floor;
    if (!worst || margin < worst.margin) worst = { ...s, floor, margin };
    if (s.ratio < floor) failures.push(`"${s.text}"@${s.frame}: ${s.ratio.toFixed(2)}:1 < ${floor}:1`);
  }
  const detail = `min ratio ${worst.ratio.toFixed(2)}:1 at frame ${worst.frame} ("${worst.text}", floor ${worst.floor}:1)`;
  return failures.length ? r("MO-C-06", FAIL, `${detail}; ${failures.slice(0, 3).join(", ")}`) : r("MO-C-06", PASS, detail);
}

function readingTime({ manifest }) {
  let tightest = null;
  const failures = [];
  const eps = 1 / manifest.fps;
  for (const u of manifest.timeline ?? []) {
    const floor = readingFloor(u.text, u.kind);
    if (floor <= 0) continue;
    const slack = u.holdSec - floor;
    if (!tightest || slack < tightest.slack) tightest = { u, floor, slack };
    if (u.holdSec < floor - eps) failures.push(`"${u.text}" (${u.kind}) hold ${u.holdSec.toFixed(3)}s < ${floor.toFixed(3)}s`);
    if ((u.kind === "line" || u.kind === "scene") && u.holdSec > 0) {
      const { C } = readingCounts(u.text);
      if (C / u.holdSec > READING.maxCharsPerSecond + 1e-9) failures.push(`"${u.text}" ${(C / u.holdSec).toFixed(1)} cps > 17`);
    }
  }
  const detail = tightest ? `tightest unit "${tightest.u.text}" (${tightest.u.kind}) hold ${tightest.u.holdSec.toFixed(3)}s vs floor ${tightest.floor.toFixed(3)}s` : "no text units";
  return failures.length ? r("MO-C-07/08", FAIL, `${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1})` : ""}`) : r("MO-C-07/08", PASS, detail);
}

function beatRules({ manifest }) {
  const fps = manifest.fps;
  const grid = manifest.beatGrid ?? null;
  const beatAt = (t) => {
    if (grid) {
      let best = grid[0];
      for (const b of grid) if (Math.abs(b - t) < Math.abs(best - t)) best = b;
      return best;
    }
    const step = 60 / manifest.bpm;
    return Math.round(t / step) * step;
  };
  const beatLen = (t) => {
    if (!grid) return 60 / manifest.bpm;
    for (let i = 1; i < grid.length; i++) if (grid[i] > t) return grid[i] - grid[i - 1];
    return grid.length > 1 ? grid[grid.length - 1] - grid[grid.length - 2] : 0.6;
  };
  const shots = (manifest.timeline ?? []).filter((u) => u.kind === "line" || u.kind === "scene");
  const offBeat = [];
  const short = [];
  for (const s of shots) {
    if (s.start > 0 && Math.abs(s.start - beatAt(s.start)) > (1 + 1e-6) / fps) offBeat.push(`${s.id} cut at ${s.start.toFixed(3)}s is ${((s.start - beatAt(s.start)) * 1000).toFixed(1)} ms off the beat`);
    if (s.holdSec < 2 * beatLen(s.start) - 1 / fps) short.push(`${s.id} holds ${s.holdSec.toFixed(3)}s < 2 beats (${(2 * beatLen(s.start)).toFixed(3)}s)`);
  }
  return [
    offBeat.length ? r("MO-A-15", FAIL, offBeat[0]) : r("MO-A-15", PASS, "every cut within 1 frame of a beat"),
    short.length ? r("MO-A-16", FAIL, short[0]) : r("MO-A-16", PASS, "every shot holds at least 2 beats"),
  ];
}

function eojeolReveals({ manifest }) {
  const bad = [];
  for (const u of manifest.timeline ?? []) {
    if (u.kind !== "reveal") continue;
    const parent = (manifest.timeline ?? []).find((p) => p.sceneId === u.sceneId && p.shotIndex === u.shotIndex && (p.kind === "line" || p.kind === "scene"));
    if (!parent) continue;
    const tokens = parent.text.split(/\s+/u);
    const revealTokens = u.text.split(/\s+/u);
    const ok = tokens.some((_, i) => revealTokens.every((t, j) => tokens[i + j] === t));
    if (!ok) bad.push(`"${u.text}" is not a whole eojeol run of "${parent.text}"`);
  }
  return bad.length ? r("MO-A-13", FAIL, bad[0]) : r("MO-A-13", PASS, "every reveal step is a whole eojeol (or whole item)");
}

function determinism({ determinism }) {
  if (!determinism) return [r("MO-C-09", FAIL, "determinism re-render was not run"), r("MO-A-25", FAIL, "seeked-vs-sequential check was not run")];
  const list = determinism.frames.map((f) => f.frame).join(", ");
  if (determinism.status === "PASS") {
    return [
      r("MO-C-09", PASS, `rgbaSha256 match Y (frames re-rendered in a second process: ${list})`),
      r("MO-A-25", PASS, `seeked stills equal the sequential video frame lines at samples ${determinism.samples}, shutter ${determinism.shutter}`),
    ];
  }
  if (determinism.status === "WARN") {
    return [r("MO-C-09", WARN, `hardware-nondeterminism: hardware pair differed, SwiftShader pair matched (frames ${list})`), r("MO-A-25", WARN, "hardware pair differed; SwiftShader seeked pair matched")];
  }
  const bad = determinism.frames.find((f) => !f.match);
  const detail = bad ? `frame ${bad.frame}: ${bad.sequential} vs ${bad.seeked}` : "mismatch";
  return [r("MO-C-09", FAIL, `rgbaSha256 match N — ${detail}`), r("MO-A-25", FAIL, `seeked render differs from the sequential one — ${detail}`)];
}

function encodeFloors({ manifest, probe }) {
  if (!probe) return r("MO-C-10/11/12", FAIL, "no MP4 master to probe (ffprobe missing or file absent)");
  const problems = [];
  if (probe.width < GATE.minResolution[0] || probe.height < GATE.minResolution[1]) problems.push(`resolution ${probe.width}x${probe.height}`);
  if (probe.fps < GATE.minFps) problems.push(`fps ${probe.fps}`);
  if (probe.duration < GATE.minDurationSec) problems.push(`duration ${probe.duration.toFixed(2)}s < 3s`);
  if (probe.pixFmt !== "yuv420p") problems.push(`pix_fmt ${probe.pixFmt}`);
  if (probe.colorSpace !== "bt709") problems.push(`color_space ${probe.colorSpace}`);
  if (probe.colorRange !== "tv") problems.push(`color_range ${probe.colorRange}`);
  if (probe.colorTransfer !== "bt709") problems.push(`color_transfer ${probe.colorTransfer}`);
  if (probe.colorPrimaries !== "bt709") problems.push(`color_primaries ${probe.colorPrimaries}`);
  const tags = problems.length === 0 ? "Y" : "N";
  const detail = `${probe.duration.toFixed(2)} s @ ${probe.fps} fps, ${probe.width}x${probe.height} (ffprobe yuv420p/bt709/tv ${tags})`;
  if (problems.length) return r("MO-C-10/11/12", FAIL, `${detail}: ${problems.join(", ")}`);
  if (probe.duration > GATE.warnDurationSec) return r("MO-C-10/11/12", WARN, `${detail}; longer than 90 s`);
  return r("MO-C-10/11/12", PASS, detail);
}

function fileSizes({ exports, probe }) {
  const problems = [];
  const warn = [];
  if (!exports.preview) problems.push("no preview");
  else if (exports.preview.bytes > GATE.previewCapBytes) problems.push(`preview ${exports.preview.bytes} B > 3 MB`);
  if (!exports.poster) problems.push("no poster");
  else if (exports.poster.bytes > GATE.posterCapBytes) problems.push(`poster ${exports.poster.bytes} B > 1 MB`);
  if (probe && probe.duration > 0 && probe.bytes > (GATE.mp4WarnBytesPer10s * probe.duration) / 10) warn.push("mp4 above 100 MB per 10 s");
  const detail = `mp4 ${probe?.bytes ?? "?"}, ${exports.preview?.kind ?? "preview"} ${exports.preview?.bytes ?? "?"} (cap 3 MB), poster ${exports.poster?.bytes ?? "?"} (cap 1 MB)`;
  if (problems.length) return r("MO-C-13", FAIL, `${detail}: ${problems.join(", ")}`);
  return r("MO-C-13", warn.length ? WARN : PASS, warn.length ? `${detail}; ${warn.join(", ")}` : detail);
}

function reducedMotion({ exports, still, manifest, frames }) {
  if (!exports.reducedMotion) return r("MO-C-14", FAIL, "reduced-motion still missing");
  const textual = (manifest.timeline ?? []).filter((u) => (u.kind === "line" || u.kind === "scene") && u.text);
  const last = textual[textual.length - 1];
  if (!last) return r("MO-C-14", PASS, "present; no text-bearing entry to compare");
  const refFrame = Math.round(last.end * manifest.fps) - 1;
  const ref = frames.find((f) => f.frame === refFrame);
  if (!ref || !still) return r("MO-C-14", FAIL, `present, but ink data for the still or reference frame ${refFrame} is missing`);
  const ratio = ref.inkPx > 0 ? still.inkPx / ref.inkPx : 1;
  const detail = `present Y, ink ${still.inkPx} vs reference frame ${refFrame} ${ref.inkPx} (${ratio.toFixed(3)}x, floor 0.9x)`;
  return ratio < GATE.stillInkRatio ? r("MO-C-14", FAIL, detail) : r("MO-C-14", PASS, detail);
}

function tracking({ frames }) {
  const display = [];
  const machine = [];
  const hangul = [];
  const widthMotion = new Map();
  for (const fr of frames) {
    for (const b of fr.textBoxes ?? []) {
      if (b.voice === "display" && b.trackingEm < GATE.displayTrackingFloorEm - 1e-9) display.push(`${b.text}@${fr.frame} ${b.trackingEm}em`);
      if ((b.voice === "machine" || b.voice === "chrome") && b.trackingEm < 0) machine.push(`${b.text}@${fr.frame} ${b.trackingEm}em`);
      if (b.script === "hangul" && (b.trackingEm !== 0 || b.widthPct !== 100)) hangul.push(`${b.text}@${fr.frame} tracking ${b.trackingEm} width ${b.widthPct}`);
      if (b.script === "hangul") {
        const k = `${b.elementId}`;
        if (!widthMotion.has(k)) widthMotion.set(k, new Set());
        widthMotion.get(k).add(`${b.trackingEm}/${b.widthPct}`);
      }
    }
  }
  for (const [k, set] of widthMotion) if (set.size > 1) hangul.push(`${k} animates tracking/width`);
  return [
    display.length || machine.length
      ? r("MO-C-25", FAIL, [...display.map((d) => `display past -0.04em: ${d}`), ...machine.map((m) => `negative tracking on the machine voice: ${m}`)].slice(0, 3).join("; "))
      : r("MO-C-25", PASS, "display tracking >= -0.04em; machine voice never negative"),
    hangul.length ? r("MO-FT-04", FAIL, hangul[0]) : r("MO-FT-04", PASS, "no tracking or width motion on any Hangul run"),
  ];
}

function lineHeight({ frames }) {
  const bad = [];
  const seen = new Set();
  for (const fr of frames) {
    for (const b of fr.textBoxes ?? []) {
      if (!b.blockId || !(b.lineCount >= 2) || seen.has(`${b.blockId}@${b.lineHeight}`)) continue;
      seen.add(`${b.blockId}@${b.lineHeight}`);
      const floor = b.cjk ? GATE.lineHeightCjk : GATE.lineHeightLatin;
      if (b.lineHeight < floor - 1e-9) bad.push(`${b.blockId}: ${b.lineCount} lines at ${b.lineHeight} < ${floor}`);
    }
  }
  return bad.length ? r("MO-C-26", FAIL, bad[0]) : r("MO-C-26", PASS, "multi-line blocks at >= 1.5 (Latin) / >= 1.6 (CJK)");
}

function measure({ frames }) {
  const bad = [];
  const advisory = [];
  for (const fr of frames) {
    for (const b of fr.textBoxes ?? []) {
      if (!b.paragraph) continue;
      if (b.cjk) {
        if (b.measureCh < GATE.measureCjkAdvisory[0] || b.measureCh > GATE.measureCjkAdvisory[1]) advisory.push(`${b.blockId} ${b.measureCh}ch`);
      } else if (b.measureCh < GATE.measureLatin[0] || b.measureCh > GATE.measureLatin[1]) bad.push(`${b.blockId}: ${b.measureCh}ch outside 60-75`);
    }
  }
  if (bad.length) return r("MO-C-27", FAIL, bad[0]);
  return r("MO-C-27", PASS, advisory.length ? `Latin cards within 60-75ch; CJK advisory: ${advisory[0]} outside 30-45ch` : "no paragraph card outside its measure");
}

function accentClusters({ frames, manifest, preset }) {
  const clusters = [];
  const frameCount = frames.length;
  const accentHex = preset?.accentRole ? preset.palette[preset.accentRole] : null;
  const accentHue = accentHex ? hsl(...hexToRgb(accentHex)).h : null;
  const clusterOf = (h) => clusters.find((c) => hueDistance(c.hue, h) <= GATE.clusterHueTolerance);
  for (const fr of frames) {
    const fills = [
      ...(fr.textBoxes ?? []).filter((b) => /^#[0-9a-f]{6}$/iu.test(b.fill)).map((b) => ({ color: b.fill, bbox: b.bbox })),
      ...(fr.fills ?? []),
    ];
    for (const fill of fills) {
      const [x0, y0, x1, y1] = fill.bbox;
      if (x1 - x0 < GATE.clusterMinFillPx || y1 - y0 < GATE.clusterMinFillPx) continue;
      const { h, s } = hsl(...hexToRgb(fill.color));
      if (s < GATE.clusterSaturation) continue;
      let c = clusterOf(h);
      if (!c) {
        c = { hue: h, colors: new Set(), frames: new Set(), shots: new Set() };
        clusters.push(c);
      }
      c.colors.add(fill.color.toLowerCase());
      c.frames.add(fr.frame);
      if (fr.shot) c.shots.add(fr.shot.id);
    }
  }
  if (clusters.length > 2) return r("MO-C-29", FAIL, `${clusters.length} saturated clusters: ${clusters.map((c) => [...c.colors].join("/")).join(", ")}`);
  let accent = accentHue !== null ? clusters.find((c) => hueDistance(c.hue, accentHue) <= GATE.clusterHueTolerance) : null;
  if (!accent && clusters.length === 2) accent = clusters.reduce((a, b) => (a.frames.size <= b.frames.size ? a : b));
  if (accent) {
    const share = accent.frames.size / Math.max(1, frameCount);
    if (accent.shots.size > GATE.accentMaxEntries) return r("MO-C-29", FAIL, `accent ${[...accent.colors].join("/")} appears in ${accent.shots.size} timeline entries (${[...accent.shots].join(", ")})`);
    if (share > GATE.accentMaxFrameShare) return r("MO-C-29", FAIL, `accent ${[...accent.colors].join("/")} on ${(share * 100).toFixed(1)}% of frames (> 10%)`);
    return r("MO-C-29", PASS, `${clusters.length} saturated cluster(s); accent ${[...accent.colors].join("/")} in 1 entry, ${(share * 100).toFixed(1)}% of frames`);
  }
  return r("MO-C-29", PASS, `${clusters.length} saturated cluster(s), no accent`);
}

function perf({ perf, manifest }) {
  if (!perf) return r("MO-D-02", FAIL, "perf run missing");
  const ceiling = manifest.softwareRenderer ? GATE.perfP95SoftwareMs : GATE.perfP95HardwareMs;
  const detail = `p95 ${perf.p95.toFixed(1)} ms over ${perf.frames} frames at --samples 1 (ceiling ${ceiling} ms, ${manifest.softwareRenderer ? "software" : "hardware"})`;
  if (perf.frames < GATE.perfMinFrames) return r("MO-D-02", FAIL, `${detail}: fewer than 120 frames`);
  return perf.p95 > ceiling ? r("MO-D-02", FAIL, `${detail}; lower --samples or the tidal octaves`) : r("MO-D-02", PASS, detail);
}

function nearBlack({ frames, manifest }) {
  const fps = manifest.fps;
  const total = frames.length;
  const beat = manifest.beatGrid ? 0.6 : 60 / manifest.bpm;
  const empty = frames.map((f) => (f.inkPx ?? 0) === 0 && (f.luminanceP995 ?? 1) < GATE.nearBlackLuminance);
  const limit = GATE.nearBlackHoldFactor * 2 * beat * fps;
  const allowance = GATE.nearBlackEdgeAllowanceSec * fps;
  let worst = null;
  for (const s of (manifest.timeline ?? []).filter((u) => u.kind === "line" || u.kind === "scene")) {
    const a = frameIndexOfTime(s.start, fps);
    const b = Math.min(total, frameIndexOfTime(s.end, fps));
    let runStart = -1;
    for (let f = a; f <= b; f++) {
      if (f < b && empty[f]) {
        if (runStart < 0) runStart = f;
        continue;
      }
      if (runStart >= 0) {
        const length = f - runStart;
        const edge = runStart === 0 || f === total ? allowance : 0;
        if (length > limit + edge && (!worst || length > worst.length)) worst = { length, shot: s.id, from: runStart };
        runStart = -1;
      }
    }
  }
  return worst ? r("MO-D-03", FAIL, `${worst.length} empty near-black frames in ${worst.shot} from frame ${worst.from}`) : r("MO-D-03", PASS, "no empty near-black run longer than 2x the minimum hold");
}

function eventCeiling({ manifest, shotEvents, frames }) {
  const byShot = new Map((shotEvents ?? []).map((s) => [s.shotId, [...s.events]]));
  let prevInvert = null;
  let lastInvertChange = null;
  const invertProblems = [];
  const cuts = new Set((manifest.timeline ?? []).filter((u) => u.kind === "line" || u.kind === "scene").map((u) => Math.round(u.start * manifest.fps)));
  let prevFlash = 0;
  for (const fr of frames) {
    const shotId = fr.shot?.id;
    const flash = fr.post?.flash ?? 0;
    if (flash > FLASH_EVENT_THRESHOLD && prevFlash <= FLASH_EVENT_THRESHOLD && shotId) {
      if (!byShot.has(shotId)) byShot.set(shotId, []);
      byShot.get(shotId).push({ t: fr.frame / manifest.fps, source: "flash" });
    }
    prevFlash = flash;
    const inv = fr.post?.invert === true;
    if (prevInvert !== null && inv !== prevInvert) {
      if (!byShot.has(shotId)) byShot.set(shotId, []);
      byShot.get(shotId).push({ t: fr.frame / manifest.fps, source: "invert" });
      if (!cuts.has(fr.frame)) invertProblems.push(`invert changed off a cut at frame ${fr.frame}`);
      if (lastInvertChange !== null && fr.frame - lastInvertChange < 2 * (60 / manifest.bpm) * manifest.fps - 1) invertProblems.push(`invert held ${fr.frame - lastInvertChange} frames < 2 beats`);
      lastInvertChange = fr.frame;
    }
    prevInvert = inv;
  }
  const dense = [];
  for (const [shotId, events] of byShot) {
    const times = events.map((e) => e.t).sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
      let n = 0;
      for (let j = i; j < times.length && times[j] < times[i] + 1; j++) n += 1;
      if (n > SHADER.eventsPerSecondPerShot) {
        dense.push(`${shotId}: ${n} events in 1 s from ${times[i].toFixed(2)}s`);
        break;
      }
    }
  }
  return [
    dense.length ? r("MO-SH-03", FAIL, dense[0]) : r("MO-SH-03", PASS, "<= 2 events in any 1 s window of every shot"),
    invertProblems.length ? r("MO-A-58", FAIL, invertProblems[0]) : r("MO-A-58", PASS, "post overrides in range; invert only on cuts, held >= 2 beats"),
  ];
}

function postRanges({ frames }) {
  const bad = [];
  for (const fr of frames) {
    for (const [field, rule] of Object.entries(POST_FIELDS)) {
      const v = fr.post?.[field];
      if (v === undefined || rule.pair || rule.boolean) continue;
      if (v < rule.min || v > rule.max || (rule.exclusiveMin && v <= 0)) bad.push(`${field}=${v} at frame ${fr.frame}`);
    }
    if (bad.length) break;
  }
  return bad;
}

function passCaps({ manifest, passLines }) {
  const out = [];
  const glitch = (manifest.passRanges ?? []).filter((p) => p.pass === "glitch");
  const gBad = glitch.find((p) => p.params.hitRatePerSecRealized > SHADER.glitchHitRateCap + 1e-9 || p.params.areaCapPct > SHADER.glitchAreaCapPct || (p.params.maxHitAreaPct ?? 0) > SHADER.glitchAreaCapPct + 1e-9);
  out.push(!glitch.length ? r("MO-SH-05", NA, "glitch not in this preset")
    : gBad ? r("MO-SH-05", FAIL, `glitch@${gBad.sceneId}#${gBad.shotIndex}: ${gBad.params.hitRatePerSecRealized} hits/s, area ${gBad.params.maxHitAreaPct}% (caps 2.0 / 20%)`)
      : r("MO-SH-05", PASS, "glitch <= 2.0 hits/s and <= 20% area in every shot"));
  const tidal = (manifest.passRanges ?? []).filter((p) => p.pass === "tidal-gradient");
  let tBad = null;
  for (const p of tidal) {
    const times = p.params.surgeTimes ?? [];
    for (let i = 0; i < times.length && !tBad; i++) if (times.filter((t) => t >= times[i] && t < times[i] + 1).length > SHADER.surgeRateCap) tBad = `${p.sceneId}#${p.shotIndex}: more than 2 surges in 1 s`;
    if (!tBad && (p.params.surgeAttackSec < SHADER.surgeAttackFloor || p.params.surgeDecaySec < SHADER.surgeDecayFloor)) tBad = `${p.sceneId}#${p.shotIndex}: surge attack ${p.params.surgeAttackSec}s / decay ${p.params.surgeDecaySec}s under 0.1 s`;
  }
  out.push(!tidal.length ? r("MO-SH-06", NA, "tidal-gradient not in this preset") : tBad ? r("MO-SH-06", FAIL, tBad) : r("MO-SH-06", PASS, "surges <= 2/s, attack and decay >= 0.1 s"));
  const crtRanges = (manifest.passRanges ?? []).filter((p) => p.pass === "crt");
  let cBad = null;
  for (const p of crtRanges) {
    const values = passLines.filter((l) => l.pass === "crt" && l.frame >= p.frameStart && l.frame <= p.frameEnd).map((l) => l.uniforms?.u_flicker).filter((v) => typeof v === "number");
    const pp = values.length ? Math.max(...values) - Math.min(...values) : 0;
    if (pp > SHADER.crtFlickerCap + 1e-6) cBad = `crt@${p.sceneId}#${p.shotIndex}: flicker ${pp.toFixed(4)} peak-to-peak > 0.06`;
    if (!cBad && p.params.persistenceEnabled && !p.params.shotStateful) cBad = `crt@${p.sceneId}#${p.shotIndex}: persistence on a non-stateful scene`;
  }
  out.push(!crtRanges.length ? r("MO-SH-07", NA, "crt not in this preset") : cBad ? r("MO-SH-07", FAIL, cBad) : r("MO-SH-07", PASS, "crt flicker <= 0.06 peak-to-peak; persistence only on stateful shots"));
  const ditherRanges = (manifest.passRanges ?? []).filter((p) => p.pass === "dither");
  let dBad = null;
  for (const p of ditherRanges) {
    const seeds = new Set(passLines.filter((l) => l.pass === "dither" && l.frame >= p.frameStart && l.frame <= p.frameEnd).map((l) => l.uniforms?.u_seed));
    if (seeds.size > 1) dBad = `dither@${p.sceneId}#${p.shotIndex} reseeded inside the shot (${seeds.size} seeds)`;
  }
  out.push(!ditherRanges.length ? r("MO-SH-08", NA, "dither not in this preset") : dBad ? r("MO-SH-08", FAIL, dBad) : r("MO-SH-08", PASS, "dither seed fixed per shot"));
  const guides = (manifest.passRanges ?? []).find((p) => p.pass === "swiss-grid" && p.params.showGuides);
  out.push(guides ? r("MO-SH-10", FAIL, `swiss-grid showGuides true in ${guides.sceneId}#${guides.shotIndex}`) : r("MO-SH-10", PASS, "swiss-grid guides off (or not used)"));
  const term = (manifest.passRanges ?? []).find((p) => p.pass === "terminal-ui" && p.params.layers > SHADER.terminalLayerCap);
  out.push(term ? r("MO-SH-11", FAIL, `terminal-ui uses ${term.params.layers} layers in ${term.sceneId}`) : r("MO-SH-11", PASS, "terminal-ui <= 2 Canvas2D layers per scene (or not used)"));
  return out;
}

function seedRule({ manifest, seedOf }) {
  const bad = (manifest.passRanges ?? []).find((p) => p.pass !== "swiss-grid" && p.seed !== seedOf(manifest.seed, p.sceneId, p.shotIndex, p.pass));
  const grid = (manifest.passRanges ?? []).find((p) => p.pass === "swiss-grid" && p.seed !== null);
  if (bad) return r("MO-SH-01", FAIL, `${bad.pass}@${bad.sceneId}#${bad.shotIndex} seed ${bad.seed} != fnv1a32(runSeed:sceneId:shotIndex:pass)`);
  if (grid) return r("MO-SH-01", FAIL, "swiss-grid carries a seed; it must be null");
  return r("MO-SH-01", PASS, "every pass seed = fnv1a32(runSeed:sceneId:shotIndex:pass); swiss-grid null");
}

function presence({ exports, manifest }) {
  const missing = [];
  if (!exports.film) missing.push("MP4 master");
  if (!exports.preview) missing.push("preview");
  if (!exports.poster) missing.push("poster");
  if (!exports.reducedMotion) missing.push("reduced-motion still");
  if (!manifest) missing.push("manifest");
  return missing.length ? r("MO-A-37..41", FAIL, `missing: ${missing.join(", ")}`) : r("MO-A-37..41", PASS, "MP4, preview, poster, reduced-motion still and manifest present");
}

function timelineSchema({ manifest }) {
  const fields = ["id", "sceneId", "shotIndex", "start", "end", "holdSec", "kind", "text", "script", "beatSec"];
  const bad = (manifest.timeline ?? []).find((u) => fields.some((f) => u[f] === undefined));
  if (!(manifest.timeline ?? []).length) return r("MO-A-41a", FAIL, "manifest has no timeline");
  return bad ? r("MO-A-41a", FAIL, `timeline entry ${bad.id ?? "?"} lacks a canonical field`) : r("MO-A-41a", PASS, `${manifest.timeline.length} canonical timeline entries`);
}

function hangulWeights({ frames, allowedHangulFonts }) {
  const bad = [];
  for (const fr of frames) for (const b of fr.textBoxes ?? []) if (b.script === "hangul" && allowedHangulFonts && !allowedHangulFonts.includes(b.fontFile)) bad.push(`${b.text}: ${b.fontFile}`);
  return bad.length ? r("MO-A-33", FAIL, `Hangul set in a non-pair font: ${bad[0]}`) : r("MO-A-33", PASS, "Hangul uses only the lit-pptx Regular/Bold pair or Galmuri");
}

/**
 * Evaluate every rule. `data` fields: manifest, frames (master frame lines), passLines, masterFlash,
 * previewFlash {records, fps}, shotEvents, exports {film, preview, poster, reducedMotion}, probe,
 * still {inkPx}, contrastSamples, determinism, perf, coverage {ok, missing}, preset, seedOf,
 * allowedHangulFonts, reportNotice.
 */
export function evaluateGate(data) {
  const frames = data.frames ?? [];
  const rules = [];
  rules.push(glslPresence({ manifest: data.manifest, passLines: data.passLines ?? [], frameCount: data.manifest.frameCount ?? frames.length }));
  rules.push(webgl2Tier(data));
  rules.push(flashAudit({ masterFlash: data.masterFlash ?? [], previewFlash: data.previewFlash, manifest: data.manifest }));
  rules.push(...safeAreas({ frames }));
  rules.push(contrast({ contrastSamples: data.contrastSamples ?? [] }));
  rules.push(readingTime(data));
  rules.push(determinism(data)[0]);
  rules.push(encodeFloors({ manifest: data.manifest, probe: data.probe }));
  rules.push(fileSizes({ exports: data.exports ?? {}, probe: data.probe }));
  rules.push(reducedMotion({ exports: data.exports ?? {}, still: data.still, manifest: data.manifest, frames }));
  const [c25, ft04] = tracking({ frames });
  rules.push(c25);
  rules.push(lineHeight({ frames }));
  rules.push(measure({ frames }));
  rules.push(accentClusters({ frames, manifest: data.manifest, preset: data.preset }));
  rules.push(perf(data));
  rules.push(nearBlack({ frames, manifest: data.manifest }));
  rules.push(data.coverage ? (data.coverage.ok ? r("MO-D-04", PASS, "every codepoint resolves in its run's font") : r("MO-D-04", FAIL, data.coverage.missing.slice(0, 3).join("; "))) : r("MO-D-04", FAIL, "glyph coverage was not checked"));
  // Rule-index order for the remaining enforced MO-A / MO-SH / MO-FT rows.
  const [a15, a16] = beatRules(data);
  const [sh03, a58] = eventCeiling({ manifest: data.manifest, shotEvents: data.shotEvents, frames });
  const postBad = postRanges({ frames });
  rules.push(eojeolReveals(data));
  rules.push(a15, a16);
  rules.push(determinism(data)[1]);
  rules.push(hangulWeights({ frames, allowedHangulFonts: data.allowedHangulFonts }));
  rules.push(presence({ exports: data.exports ?? {}, manifest: data.manifest }));
  rules.push(timelineSchema(data));
  rules.push(postBad.length ? r("MO-A-58", FAIL, `override out of range: ${postBad[0]}`) : a58);
  if (data.seedOf) rules.push(seedRule({ manifest: data.manifest, seedOf: data.seedOf }));
  rules.push(sh03);
  rules.push(fullFrameStep({ masterFlash: data.masterFlash ?? [] }));
  rules.push(...passCaps({ manifest: data.manifest, passLines: data.passLines ?? [] }));
  rules.push(softwareDowngrade(data));
  rules.push(ft04);
  const failed = rules.filter((x) => x.status === FAIL);
  return { pass: failed.length === 0, rules, failed: failed.map((x) => x.id), flashFail: failed.some((x) => x.id === "MO-C-03"), perfOnly: failed.length > 0 && failed.every((x) => x.id === "MO-D-02") };
}

/** Pre-flight: the timeline rules and glyph coverage, before any frame is rendered. */
export function evaluatePreflight({ manifest, coverage }) {
  const rules = [readingTime({ manifest }), ...beatRules({ manifest }), eojeolReveals({ manifest }),
    coverage.ok ? r("MO-D-04", PASS, "every codepoint resolves in its run's font") : r("MO-D-04", FAIL, coverage.missing.slice(0, 5).join("; "))];
  const failed = rules.filter((x) => x.status === FAIL);
  return { pass: failed.length === 0, rules, failed: failed.map((x) => x.id) };
}

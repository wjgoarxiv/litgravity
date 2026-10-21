// Every number the lit-typographic-motion engine and its QA gate use, in one place.
//
// Rule ids refer to the LitFamily motion spec (MO-A engine/runtime, MO-SH shader passes,
// MO-B presets, MO-FT fonts, MO-C gate/routing, MO-D addenda). Numbers marked PROVISIONAL
// are the spec's [NEW] defaults: the spec asked for a user nod that has not been recorded,
// so they are implemented exactly as written and reported as provisional. Do not tune them
// here to make a render pass; fix the render.

/** Ids whose numbers are [NEW] defaults awaiting sign-off. The report labels them. */
export const PROVISIONAL_RULES = Object.freeze([
  "MO-C-05", "MO-C-06", "MO-C-07", "MO-C-08", "MO-C-13", "MO-C-14", "MO-C-25", "MO-C-29",
  "MO-D-02", "MO-D-03", "MO-D-04",
]);

export const ENGINE_COMMIT = "ca251e3dddda422b364385eb484b5a3593a0990d";
export const ENGINE_CREDIT = `mexicat/pdoom-video ${ENGINE_COMMIT} (MIT)`;
export const CREDIT_LINE = "Typographic-motion engine adapted from mexicat/pdoom-video (MIT, Giacomo Magnanini), commit `ca251e3`.";

// ---- frame geometry (logical 1080p; --scale N multiplies the physical size) ----
export const FRAME = Object.freeze({ width: 1920, height: 1080, maxScale: 4 });

// ---- exit codes (MO-A-45, plus 16-20 for the treatment, the stage path and sound) ----
export const EXIT = Object.freeze({
  OK: 0,
  BLOCKED_NO_CHROME: 10,
  BLOCKED_NO_WEBGL2: 11,
  BLOCKED_NO_FFMPEG_FOR_VIDEO: 12,
  GATE_FAIL_QA: 13,
  BLOCKED_DEPS_NOT_PREWARMED: 14,
  BLOCKED_FONT_FETCH: 15,
  // Director wave (family-wide numbers; never renumbered).
  BLOCKED_TREATMENT_INVALID: 16,
  STAGE_CONTRACT_ERROR: 17,
  STAGE_NONDETERMINISTIC: 18,
  STAGE_NETWORK_REQUEST: 19,
  SOUND_INVALID: 20,
  // Cover mode.
  BLOCKED_NO_COVER_ENCODER: 21,
  BLOCKED_ASSET_MISSING: 22,
  USAGE: 2,
});
export const EXIT_NAME = Object.freeze(Object.fromEntries(Object.entries(EXIT).map(([name, code]) => [code, name])));

// ---- timeline (MO-A-09..16, MO-C-07/08) ----
export const TIMELINE = Object.freeze({
  generatorMargin: 1.25, // MO-A-09/10: Tier-1 hold = 1.25 x floor(unit)
  defaultBpm: 100, // MO-A-14
  snapToleranceFrames: 1, // MO-A-15 (<= 1 frame at 60 fps)
  minSceneBeats: 2, // MO-A-16
  defaultFps: 60,
  defaultSeed: 20260926,
});

// One reading-floor function (MO-C-07/08, MO-A-11/12, MO-FT-06). PROVISIONAL.
export const READING = Object.freeze({
  secondsPerHangulSyllable: 0.2, // MO-C-08
  wordsPerSecond: 3.3, // MO-C-07
  lineFloorLatin: 0.9, // MO-A-11
  lineFloorHangul: 1.0, // MO-A-11
  wordFloor: 0.5, // MO-FT-06
  revealFloor: 0.35, // MO-A-12
  maxCharsPerSecond: 17, // MO-C-07 cross-check, line/scene only
});

// ---- sampling (MO-A-26..28) ----
export const SAMPLING = Object.freeze({
  masterSamples: 4,
  masterShutter: 0.5,
  previewSamples: 1,
  stillSamples: 1,
});

// ---- post chain override contract (MO-A-58): range and neutral value per field ----
export const POST_FIELDS = Object.freeze({
  exposure: { min: 0, max: Infinity, neutral: 1, exclusiveMin: true },
  bloom: { min: 0, max: 1, neutral: 0 },
  bloomThreshold: { min: 0, max: 1, neutral: 0.85 },
  bloomKnee: { min: 0, max: 1, neutral: 0 },
  bloomRadius: { min: 0, max: 1, neutral: 0 },
  halation: { min: 0, max: 1, neutral: 0 },
  ca: { min: 0, max: Infinity, neutral: 0 },
  grain: { min: 0, max: 1, neutral: 0 },
  vignette: { min: 0, max: 1, neutral: 0 },
  fade: { min: 0, max: 1, neutral: 1 },
  flash: { min: 0, max: 1, neutral: 0 },
  shake: { pair: true, neutral: [0, 0] },
  zoom: { min: 0, max: Infinity, neutral: 1, exclusiveMin: true },
  invert: { boolean: true, neutral: false },
});
export const POST_ORDER = Object.freeze(["bloom+halation", "ca", "tone-shoulder", "grain", "vignette", "flash", "shake/zoom", "invert"]);
export const FLASH_EVENT_THRESHOLD = 0.1; // MO-A-58: each rise of `flash` above 0.1 is one event

// ---- shader passes (MO-SH) ----
export const PASS_IDS = Object.freeze(["glitch", "tidal-gradient", "crt", "dither", "swiss-grid", "terminal-ui"]);
export const SHADER = Object.freeze({
  eventsPerSecondPerShot: 2, // MO-SH-03: <= 2 events in any 1 s window per shot, all sources
  fullFrameStepDelta: 0.1, // MO-SH-04a
  fullFrameStepArea: 0.25,
  glitchHitRateCap: 2.0, // MO-SH-05
  glitchAreaCapPct: 20,
  surgeRateCap: 2, // MO-SH-06
  surgeAttackFloor: 0.1,
  surgeDecayFloor: 0.1,
  crtFlickerCap: 0.06, // MO-SH-07
  terminalLayerCap: 2, // MO-SH-11
  softwareOctaves: (octaves) => Math.max(3, Math.floor(octaves / 2)), // MO-SH-09
});

/** MO-SH-09: the one canonical software-rasterizer match list (case-insensitive substrings). */
export const SOFTWARE_RENDERERS = Object.freeze([
  "swiftshader", "llvmpipe", "softpipe", "lavapipe", "apple software renderer", "microsoft basic render driver",
]);
export const UNKNOWN_RENDERER = "unknown (debug-info extension unavailable)";

// ---- Chrome launch ladder (MO-A-51) ----
export const CHROME_ALWAYS = Object.freeze([
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
]);
export const CHROME_RUNGS = Object.freeze({
  darwin: [["--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"]],
  linux: [["--use-angle=gl", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"]],
  win32: [["--use-angle=d3d11", "--enable-gpu-rasterization"]],
  software: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

// ---- QA gate (MO-C, MO-D) ----
export const GATE = Object.freeze({
  // MO-C-03 flash audit (excursion method)
  flashGrid: [320, 180], // 6x6 logical px cells
  flashCellPx: 6,
  flashDelta: 0.1,
  flashDarkCeiling: 0.8,
  flashWindowCells: [107, 60], // 640x360 logical px, the 10-degree field
  flashWindowArea: 0.25, // more than 25% of the window
  flashEdgeFrames: 3, // cells transitioning in [f-2, f]
  redRatio: 0.8,
  redScale: 320,
  redDelta: 20,
  maxFlashesPerSecond: 3,
  maxRedFlashesPerSecond: 3,
  // MO-C-04 title-safe (inner 90%)
  titleSafe: [96, 54, 1824, 1026],
  // MO-C-05 action-safe (inner 95%) PROVISIONAL
  actionSafe: [48, 27, 1872, 1053],
  // MO-C-06 contrast PROVISIONAL (size translation)
  contrastBody: 4.5,
  contrastLarge: 3.0,
  largeFontPx: 32,
  largeBoldFontPx: 25,
  largeBoldWeight: 700,
  // MO-C-10..12 floors
  minResolution: [1920, 1080],
  minFps: 30,
  minDurationSec: 3,
  warnDurationSec: 90,
  // MO-C-13 caps PROVISIONAL
  previewCapBytes: 3 * 1000 * 1000,
  posterCapBytes: 1 * 1000 * 1000,
  mp4WarnBytesPer10s: 100 * 1000 * 1000,
  // MO-C-14 reduced-motion ink floor PROVISIONAL
  stillInkRatio: 0.9,
  // MO-C-25 tracking PROVISIONAL
  displayTrackingFloorEm: -0.04,
  // MO-C-26 line height
  lineHeightLatin: 1.5,
  lineHeightCjk: 1.6,
  lineHeightThreePlus: 1.4,
  // MO-C-27 measure
  measureLatin: [60, 75],
  measureCjkAdvisory: [30, 45],
  // MO-C-29 accent PROVISIONAL (saturation floor + accent limits)
  clusterHueTolerance: 15,
  clusterSaturation: 0.5,
  clusterMinFillPx: 24,
  accentMaxFrameShare: 0.1,
  accentMaxEntries: 1,
  // MO-D-02 perf PROVISIONAL
  perfMinFrames: 120,
  perfP95HardwareMs: 40,
  perfP95SoftwareMs: 250,
  // MO-D-03 near-black runs PROVISIONAL
  nearBlackLuminance: 0.05,
  nearBlackPercentile: 0.995,
  nearBlackHoldFactor: 2,
  nearBlackEdgeAllowanceSec: 1,
});

// ---- preview ladder (MO-A-38) ----
export const PREVIEW = Object.freeze({
  rungs: [
    { width: 960, fps: 30 },
    { width: 720, fps: 24 },
    { width: 540, fps: 20 },
  ],
  minWidth: 540,
  minGlyphPx: 10,
  webpQuality: 60,
});

// ---- encode (MO-A-03) ----
export const ENCODE_ARGS = Object.freeze([
  // setparams tags the frames themselves: without it libx264 writes the matrix but leaves the
  // primaries and transfer unspecified, whatever -color_primaries / -color_trc say.
  "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "grain", "-x264-params", "aq-mode=3",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-movflags", "+faststart",
]);

// ---- fonts (MO-A-46) ----
export const FONT_BUDGET = Object.freeze({ perFileBytes: 1_000_000, totalBytes: 4_000_000 });

// ---- craft loop (MO-C-15/16) ----
export const MAX_ROUNDS = 3;

// ---- cover mode: the decoded-file gate (calibrated 2026-10-20 on 8 painted covers, 4 slide-like
// negatives and 3 pilot loops; change a number only with a new calibration table) ----
// FLOOR fails a cover: every calibration cover passes it, every slide-like negative fails it.
// TARGET is the cover-mode goal and `--strict` fails on it too; the calibration covers miss it on
// purpose, because they hold for about 2 s and flash at the seam.
export const COVER = Object.freeze({
  maxBytes: 3 * 1024 * 1024,
  targetBytes: 2 * 1024 * 1024,
  minSec: 6,
  maxSec: 12,
  stepMs: 50, // metrics run on a fixed grid of max(stepMs, shortest source frame)
  stillEps: 0.0005, // a grid step whose mean |dY| (luma 0..1, ~300 px wide) is below this is still
  floor: Object.freeze({ medianD: 0.0004, movingFrac: 0.45, stillSec: 2.0, seamLocal: 8.0 }),
  target: Object.freeze({ medianD: 0.0015, movingFrac: 0.95, stillSec: 0.5, spike: 6, seamLocal: 2.0, seamLo: 0.25 }),
  minContrast: 4.5,
  // G6: the title's cap height at the README display width (a full-width README image is about 830
  // CSS px wide); a smaller title is not a title, whatever its contrast.
  minGlyphPx: 24,
  displayWidth: 830,
  // Frame 0 shows the base art: SSIM of its check box against the source scaled into it.
  artSsim: 0.9,
  artMinShare: 0.1,
  seekSamples: 16, // frames re-rendered in a fresh page in a seeded shuffled order
  windowPadSec: 0.5, // a window re-render covers each defect's span plus this on each side
  maxDefects: 3,
  captureScale: 2,
  fps: Object.freeze([16, 20, 25]),
  // The page is laid out at `page` CSS px, captured at captureScale and downsampled to `out`.
  aspects: Object.freeze({ "2:1": Object.freeze({ page: [1200, 600], out: [1000, 500] }), "3:2": Object.freeze({ page: [1200, 800], out: [960, 640] }) }),
  encode: Object.freeze({ q: 86, edgeQ: 97, edgeFrames: 15, method: 4 }),
});

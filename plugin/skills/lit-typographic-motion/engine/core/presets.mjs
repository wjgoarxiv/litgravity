// The three preset style bibles as data (MO-B-01..03) and the auto-pick table (MO-B-00).
// The prose bibles live in references/style-bibles.md; this module is what the engine and the gate
// read, so palette hexes, voices, pass order and motion tokens have one source.

export const PRESET_IDS = Object.freeze(["swiss-signal", "terminalcore", "tidal"]);

// Font registry keys (fonts/manifest.json). Hangul runs never use a Latin face and the reverse.
const archivo = (width, weight) => `archivo-${width}-${weight}`;

export const PRESETS = Object.freeze({
  "swiss-signal": {
    id: "swiss-signal",
    palette: { bg: "#0C0E13", type: "#E9EBE4", signal: "#0F7A82", accent: "#D9A441", dim: "#4B5058", mark: "#0F7A82" },
    // Roles the MO-C-29 cluster check treats as the one signal and the one accent.
    signalRole: "signal",
    accentRole: "accent",
    voices: {
      display: { latin: archivo(100, 900), latinWidths: [75, 100, 125], hangul: "pretendard-700", weightSteps: ["pretendard-400", "pretendard-700"] },
      body: { latin: archivo(100, 400), hangul: "pretendard-400" },
      machine: { latin: "meslo-400", hangul: "pretendard-400" },
    },
    tokens: { slam: 0.18, holdMin: 0.6, holdMax: 0.9, cut: 0 },
    passes: ["swiss-grid", "dither"],
    passParams: {
      "swiss-grid": { columns: 12, gutterPx: 24, marginPx: 96, baselinePx: 8, moduleSnap: true, showGuides: false, hairlineWidthPx: 1 },
      dither: { mode: 1, paletteSize: 0, pixelScale: 1, strength: 0.3 },
    },
    // No bloom or halation: the bible keeps glow off the bone type, and the teal signal is too dark
    // to cross any luminance threshold.
    post: { exposure: 1, bloom: 0, bloomThreshold: 0.85, bloomKnee: 0, bloomRadius: 0, halation: 0, ca: 0.8, grain: 0.035, vignette: 0.25, fade: 1, flash: 0, shake: [0, 0], zoom: 1, invert: false },
  },
  terminalcore: {
    id: "terminalcore",
    palette: { bg: "#05070A", panel: "#0C1116", type: "#39FF6A", signal: "#39FF6A", signalBlue: "#2FB6FF", dim: "#7C8B93", mark: "#39FF6A" },
    signalRole: "signal",
    accentRole: null,
    voices: {
      display: { latin: "vt323", hangul: "galmuri9" },
      body: { latin: "vt323", hangul: "pretendard-400" },
      machine: { latin: "meslo-400", hangul: "galmuri9" },
      chrome: { latin: "silkscreen-400", hangul: "galmuri9" },
    },
    tokens: { typeInCharsPerSec: 22, bootFlicker: 0.25, cut: 0 },
    passes: ["terminal-ui", "crt", "dither", "glitch"],
    passParams: {
      "terminal-ui": { charGridPx: [14, 24], windowChromeWidthPx: 1.5, meterCount: 2, logLineRateCharsPerSec: 22, caretBlinkHz: 1.2 },
      crt: { scanlineFreqPerFrame: 540, scanlineDepth: 0.22, phosphorPersistence: 0, bloomAmount: 0.2, curvature: 0.06, vignette: 0.3, triadMaskAmount: 0.12, flickerAmp: 0.03, flickerFreqHz: 8 },
      dither: { mode: 1, paletteSize: 0, pixelScale: 2, strength: 0.35 },
      glitch: { intensity: 0.3, sliceCount: 6, maxOffsetPx: 24, blockCorruptSize: [32, 18], rgbSplitPx: 3, holdFrames: 2, hitRatePerSec: 0.5, areaCapPct: 12 },
    },
    post: { exposure: 1, bloom: 0.3, bloomThreshold: 0.8, bloomKnee: 0.4, bloomRadius: 0.5, halation: 0.08, ca: 1.0, grain: 0.03, vignette: 0.15, fade: 1, flash: 0, shake: [0, 0], zoom: 1, invert: false },
  },
  tidal: {
    id: "tidal",
    // Tidal has no signal hue of its own: the teal stop is its saturated cluster, and marks
    // (bars, the pen head) use the type colour.
    palette: { bg: "#0E1420", type: "#E8ECEF", stopA: "#124559", stopB: "#4C3B6E", accent: "#E07856", dim: "#8A94A6", mark: "#E8ECEF" },
    signalRole: "stopA",
    accentRole: "accent",
    voices: {
      display: { latin: archivo(100, 700), latinWidths: [100], hangul: "pretendard-700", weightSteps: ["pretendard-400", "pretendard-700"] },
      body: { latin: archivo(100, 400), hangul: "pretendard-400" },
      machine: { latin: "meslo-400", hangul: "pretendard-400" },
    },
    tokens: { drift: 3.0, surgePunch: 0.3, cut: 0 },
    passes: ["tidal-gradient", "swiss-grid", "glitch"],
    passParams: {
      "tidal-gradient": { flowSpeed: 0.05, warpAmount: 0.35, curlStrength: 0.35, octaves: 4, surgeOnHit: 0.35, surgeAttackSec: 0.2, surgeDecaySec: 0.4, surgeCapPerSec: 2, bandingSteps: 0, ditherAmount: 0.02 },
      "swiss-grid": { columns: 12, gutterPx: 24, marginPx: 96, baselinePx: 8, moduleSnap: true, showGuides: false, hairlineWidthPx: 1 },
      glitch: { intensity: 0.25, sliceCount: 5, maxOffsetPx: 18, blockCorruptSize: [32, 18], rgbSplitPx: 2, holdFrames: 2, hitRatePerSec: 0.5, areaCapPct: 10 },
    },
    post: { exposure: 1, bloom: 0.15, bloomThreshold: 0.85, bloomKnee: 0.4, bloomRadius: 0.6, halation: 0.1, ca: 0.6, grain: 0.03, vignette: 0.2, fade: 1, flash: 0, shake: [0, 0], zoom: 1, invert: false },
  },
});

// MO-B-00: checked in order, first match wins, whole words only. Korean keywords must start a
// token so they never match the tail of a longer compound; Latin keywords use word boundaries.
export const AUTO_PICK = Object.freeze([
  { preset: "terminalcore", korean: ["터미널", "CRT", "해커"], latin: ["terminal", "hacker", "crt"] },
  { preset: "tidal", korean: ["물결", "파도", "잔잔한", "흐름"], latin: ["gradient", "wave", "tide", "calm"] },
]);

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function matchesKeyword(text, keyword, korean) {
  const pattern = korean
    ? new RegExp(`(?<![\\p{L}\\p{N}])${escape(keyword)}`, "u")
    : new RegExp(`(?<![\\p{L}\\p{N}])${escape(keyword)}(?![\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
}

/**
 * Pick the preset for a brief. An explicit style always wins; otherwise the first table row with a
 * whole-word hit; otherwise swiss-signal. Returns the id and the reason the report prints.
 */
export function pickPreset({ style, text, request = "" }) {
  if (style && style !== "auto") {
    if (!PRESET_IDS.includes(style)) throw new Error(`unknown preset: ${style} (choose ${PRESET_IDS.join(", ")})`);
    // A style is the user's only when their request names it; a style the agent wrote into the
    // brief is the agent's default and is labelled so (RC8e).
    return { presetId: style, reason: matchesKeyword(String(request), style, false) ? "user-specified" : "agent default" };
  }
  for (const row of AUTO_PICK) {
    for (const keyword of row.korean) {
      if (matchesKeyword(text, keyword, true)) return { presetId: row.preset, reason: `agent default (brief mentions "${keyword}")` };
    }
    for (const keyword of row.latin) {
      if (matchesKeyword(text, keyword, false)) return { presetId: row.preset, reason: `agent default (brief mentions "${keyword}")` };
    }
  }
  return { presetId: "swiss-signal", reason: "agent default (no terminal or tidal keyword in the brief)" };
}

/** The palette a render actually uses, after the terminalcore signal-hue choice. */
export function resolvePalette(preset, { signalHue } = {}) {
  const palette = { ...preset.palette };
  if (preset.id === "terminalcore" && signalHue === "blue") {
    palette.signal = palette.signalBlue;
    palette.type = palette.signalBlue;
    palette.mark = palette.signalBlue;
  }
  return palette;
}

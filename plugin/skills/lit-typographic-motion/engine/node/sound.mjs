// The sound bed and the sound gate in pure product code: no network, no model
// weights, no dependency. A generated bed is always tempo + pulse + pad (one chord per treatment beat,
// or per two bars inside a long beat) plus the accents a beat's `sound` field asks for: a hit on a
// cut, a rise into a change, a closing cadence. It is 48 kHz 16-bit stereo, exactly
// round(frameCount x 48000 / fps) samples, normalized to -16 LUFS (ITU-R BS.1770-4, measured here)
// with its sample peak at or under -2 dBFS. Every noise source is seeded from the treatment, so two
// runs give the same bytes. Supplied and authored tracks are padded or trimmed to the film with a
// 50 ms fade and always muxed; the muxed stream is audited after the encode.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fnv1a32, mulberry32 } from "../core/util.mjs";
import { describeSpawn } from "../../../../lib/host-exec.mjs";

export const SOUND = Object.freeze({
  sampleRate: 48000,
  channels: 2,
  bitsPerSample: 16,
  targetLufs: -16,
  lufsTolerance: 2,
  bedPeakDbfs: -2,
  gatePeakDbfs: -0.5,
  silenceDbfs: -50,
  silenceWindowSec: 0.05,
  silenceMaxSec: 1.5,
  silenceHeadSec: 3,
  durationToleranceSec: 0.1,
  fadeSec: 0.05,
});

export const TEMPO_RANGE = Object.freeze([60, 160]);
const PITCH = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
export const KEYS = Object.freeze({ pitchClasses: Object.freeze(Object.keys(PITCH)), modes: Object.freeze(["major", "minor"]) });

/**
 * Timbre palettes. Each names its pad, pulse and accent voices; the recipes below are what the
 * synthesis code reads. `harmonics` are additive partial amplitudes of a single-cycle table.
 */
export const TIMBRES = Object.freeze({
  "soft-keys": Object.freeze({
    character: "warm, close and unhurried; rounded electric-piano pad over a felt kick",
    pad: { harmonics: [1, 0.32, 0.14, 0.06, 0.02], detuneCents: 5, level: 0.22, lowpassHz: 2600 },
    pulse: { kind: "thump", level: 0.42, every: 1 },
    accent: { kind: "felt", partials: [1, 2, 3, 4], decay: 1.6 },
  }),
  glass: Object.freeze({
    character: "bright, airy and precise; bell-like pad with a small tick on every beat",
    pad: { harmonics: [1, 0, 0.22, 0, 0.12, 0, 0.05], detuneCents: 9, level: 0.18, lowpassHz: 7000, shimmer: 0.35 },
    pulse: { kind: "tick", level: 0.3, every: 1 },
    accent: { kind: "bell", partials: [1, 2.76, 5.4, 8.93], decay: 2.4 },
  }),
  "pulse-synth": Object.freeze({
    character: "driving and graphic; filtered saw pad, eighth-note bass and a firm kick",
    pad: { harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08], detuneCents: 12, level: 0.16, lowpassHz: 1500 },
    pulse: { kind: "bass-eighths", level: 0.36, every: 0.5 },
    accent: { kind: "pluck", partials: [1, 0.5, 0.33, 0.25, 0.2], decay: 1.1 },
  }),
  "felt-strings": Object.freeze({
    character: "slow, tender and wide; bowed string pad with vibrato over a brushed pulse",
    pad: { harmonics: [1, 0.45, 0.3, 0.2, 0.12, 0.08], detuneCents: 7, level: 0.17, lowpassHz: 3200, vibrato: 0.004 },
    pulse: { kind: "brush", level: 0.24, every: 1 },
    accent: { kind: "felt", partials: [1, 2, 3], decay: 2.0 },
  }),
});

export class SoundError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

const dbfs = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const round4 = (x) => Math.round(x * 10000) / 10000;

export function normalizePalette(palette) {
  if (!palette || typeof palette !== "object" || Array.isArray(palette)) throw new SoundError("sound.palette", "sound.palette must be an object { timbre, key, mode, tempo }");
  const timbre = String(palette.timbre ?? "");
  if (!TIMBRES[timbre]) throw new SoundError("sound.palette.timbre", `sound.palette.timbre must be one of ${Object.keys(TIMBRES).join(", ")}`);
  const key = String(palette.key ?? "");
  if (!(key in PITCH)) throw new SoundError("sound.palette.key", `sound.palette.key must be a pitch class (${Object.keys(PITCH).join(", ")})`);
  const mode = palette.mode === undefined ? "major" : String(palette.mode);
  if (!KEYS.modes.includes(mode)) throw new SoundError("sound.palette.mode", "sound.palette.mode must be major or minor");
  const tempo = Number(palette.tempo);
  if (!Number.isFinite(tempo) || tempo < TEMPO_RANGE[0] || tempo > TEMPO_RANGE[1]) throw new SoundError("sound.palette.tempo", `sound.palette.tempo must be ${TEMPO_RANGE[0]}-${TEMPO_RANGE[1]} BPM`);
  return { timbre, key, mode, tempo };
}

const CUE_WORDS = [
  ["hit", /\b(?:hits?|impacts?|cuts?|stabs?|accents?)\b|타격|히트|컷|강세/iu],
  ["rise", /\b(?:rises?|rising|risers?|swells?|swelling|builds?|building|build-?ups?|lifts?|lifting)\b|상승|고조|빌드업/iu],
  ["cadence", /\b(?:cadences?|resolves?|resolving|resolution|close|closing|ending|final chord)\b|종지|마무리|해결/iu],
];

/** Cue kinds a beat's free-text `sound` field asks for; none when nothing matches. */
export function cueKindsFor(soundText) {
  const text = String(soundText ?? "");
  return CUE_WORDS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}

const nearest = (times, t, within) => {
  let best = null;
  for (const c of times) if (Math.abs(c - t) <= within && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c;
  return best;
};

/** Accent cues, each measured against the beat boundary or cut it serves. */
export function planCues({ beats = [], durationSec, cutTimes = [] }) {
  const cues = [];
  const clampT = (t) => Math.min(durationSec, Math.max(0, t));
  beats.forEach((beat, beatIndex) => {
    const t0 = clampT(Number(beat.t0));
    const t1 = clampT(Number(beat.t1));
    for (const kind of cueKindsFor(beat.sound)) {
      if (kind === "hit") {
        const cut = nearest(cutTimes, t0, 0.5);
        const target = cut ?? t0;
        cues.push({ kind, t: round4(target), beatIndex, target: round4(target), delta: 0 });
      } else if (kind === "rise") {
        const cut = nearest(cutTimes, t1, 0.5);
        const end = cut ?? t1;
        const start = Math.max(t0, end - 1.0);
        cues.push({ kind, t: round4(end), start: round4(start), beatIndex, target: round4(end), delta: 0 });
      } else {
        const t = t0 + 0.6 * (t1 - t0);
        cues.push({ kind, t: round4(t), beatIndex, target: round4(t), delta: 0, end: round4(beatIndex === beats.length - 1 ? durationSec : t1) });
      }
    }
  });
  cues.sort((a, b) => a.t - b.t || a.beatIndex - b.beatIndex);
  return cues;
}

// ---- BS.1770-4 ----
const SHELF = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] };
const HIGHPASS = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] };

function biquad(x, { b, a }) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/** Integrated loudness (LUFS) of 48 kHz channels per ITU-R BS.1770-4; -Infinity for silence. */
export function integratedLoudness(channels, sampleRate = SOUND.sampleRate) {
  if (sampleRate !== 48000) throw new SoundError("sound.sampleRate", "loudness is measured at 48 kHz only");
  const weighted = channels.map((c) => biquad(biquad(c, SHELF), HIGHPASS));
  const n = channels[0]?.length ?? 0;
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  if (n < block) return -Infinity;
  // Prefix sums of squares make every 400 ms block O(1).
  const prefix = weighted.map((w) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i] + w[i] * w[i];
    return p;
  });
  const blocks = [];
  for (let s = 0; s + block <= n; s += step) {
    let sum = 0;
    for (const p of prefix) sum += (p[s + block] - p[s]) / block;
    blocks.push(sum);
  }
  const loud = (z) => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter((z) => z > 0 && loud(z) > -70);
  if (!abs.length) return -Infinity;
  const relative = loud(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((z) => loud(z) > relative);
  if (!gated.length) return -Infinity;
  return loud(gated.reduce((a, b) => a + b, 0) / gated.length);
}

export function samplePeakDbfs(channels) {
  let peak = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) {
    const v = Math.abs(c[i]);
    if (v > peak) peak = v;
  }
  return dbfs(peak);
}

/** Longest run (seconds) of windows below `floorDbfs` RMS (all channels) within the first `headSec`. */
export function rmsRuns(channels, sampleRate = SOUND.sampleRate, { windowSec = SOUND.silenceWindowSec, floorDbfs = SOUND.silenceDbfs, headSec = SOUND.silenceHeadSec } = {}) {
  const win = Math.max(1, Math.round(windowSec * sampleRate));
  const end = Math.min(channels[0]?.length ?? 0, Math.round(headSec * sampleRate));
  let run = 0;
  let longest = 0;
  for (let s = 0; s < end; s += win) {
    const e = Math.min(end, s + win);
    let sum = 0;
    for (const c of channels) for (let i = s; i < e; i++) sum += c[i] * c[i];
    const rms = Math.sqrt(sum / ((e - s) * channels.length));
    if (dbfs(rms) < floorDbfs) {
      run += (e - s) / sampleRate;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  const covered = (channels[0]?.length ?? 0) / sampleRate;
  // A stream that ends inside the head is silent for the rest of it.
  if (covered < headSec) longest = Math.max(longest, run + (headSec - covered));
  return +longest.toFixed(4);
}

// ---- WAV ----
export function encodeWav({ left, right, sampleRate = SOUND.sampleRate }) {
  const n = left.length;
  const data = Buffer.alloc(n * 4);
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(Math.max(-1, Math.min(1, v)) * 32767)));
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(q(left[i]), i * 4);
    data.writeInt16LE(q(right[i]), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export function decodeWav(buffer) {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") throw new SoundError("sound.file", "not a RIFF/WAVE file");
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= buffer.length;) {
    const id = buffer.toString("ascii", o, o + 4);
    const size = buffer.readUInt32LE(o + 4);
    const body = buffer.subarray(o + 8, Math.min(buffer.length, o + 8 + size));
    if (id === "fmt ") {
      let format = body.readUInt16LE(0);
      if (format === 0xfffe && body.length >= 26) format = body.readUInt16LE(24);
      fmt = { format, channels: body.readUInt16LE(2), sampleRate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    } else if (id === "data") data = body;
    o += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new SoundError("sound.file", "WAV has no fmt or data chunk");
  const { format, channels, bits, sampleRate } = fmt;
  const bytes = bits / 8;
  const frames = Math.floor(data.length / (bytes * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  const read = format === 3 && bits === 32 ? (o) => data.readFloatLE(o)
    : format === 1 && bits === 16 ? (o) => data.readInt16LE(o) / 32768
      : format === 1 && bits === 24 ? (o) => data.readIntLE(o, 3) / 8388608
        : format === 1 && bits === 32 ? (o) => data.readInt32LE(o) / 2147483648
          : null;
  if (!read) throw new SoundError("sound.file", `unsupported WAV encoding (format ${format}, ${bits}-bit)`);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) out[c][i] = read((i * channels + c) * bytes);
  return { sampleRate, channels: out };
}

// ---- synthesis ----
const TABLE = 4096;
function wavetable(harmonics) {
  const t = new Float32Array(TABLE + 1);
  let peak = 0;
  for (let i = 0; i < TABLE; i++) {
    let v = 0;
    harmonics.forEach((a, k) => { if (a) v += a * Math.sin((2 * Math.PI * (k + 1) * i) / TABLE); });
    t[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < TABLE; i++) t[i] /= peak || 1;
  t[TABLE] = t[0];
  return t;
}

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const PROGRESSIONS = {
  major: [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]],
  minor: [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]],
};

/** Chord segments: one per beat, split into two-bar chords inside a long beat; the last resolves home. */
function chordSegments({ beats, durationSec, palette }) {
  const barSec = (4 * 60) / palette.tempo;
  const spans = beats.length ? beats.map((b) => [Math.max(0, Number(b.t0)), Math.min(durationSec, Number(b.t1))]).filter(([a, b]) => b > a) : [[0, durationSec]];
  const pieces = [];
  for (const [a, b] of spans) {
    const count = Math.max(1, Math.round((b - a) / (2 * barSec)));
    for (let k = 0; k < count; k++) pieces.push([a + ((b - a) * k) / count, a + ((b - a) * (k + 1)) / count]);
  }
  if (pieces.length) pieces[pieces.length - 1][1] = durationSec;
  const prog = PROGRESSIONS[palette.mode];
  const tonic = 48 + PITCH[palette.key];
  return pieces.map(([t0, t1], i) => {
    const [offset, quality] = i === pieces.length - 1 && pieces.length > 1 ? prog[0] : prog[i % prog.length];
    const root = tonic + offset - (offset > 6 ? 12 : 0);
    const third = quality === "maj" ? 4 : 3;
    return { t0, t1, notes: [root - 12, root, root + third, root + 7, root + 12] };
  });
}

function onePole(hz, sr) {
  return 1 - Math.exp((-2 * Math.PI * hz) / sr);
}

export function buildBed({ treatment, frameCount, fps, cutTimes = [] }) {
  const sr = SOUND.sampleRate;
  if (!(Number.isInteger(frameCount) && frameCount > 0) || !(fps > 0)) throw new SoundError("sound", "the bed needs a positive frame count and fps");
  const palette = normalizePalette(treatment?.sound?.palette);
  const voice = TIMBRES[palette.timbre];
  const sampleCount = Math.round((frameCount * sr) / fps);
  const durationSec = sampleCount / sr;
  const beats = Array.isArray(treatment?.beats) ? treatment.beats : [];
  const cues = planCues({ beats, durationSec, cutTimes });
  const rand = mulberry32(fnv1a32(`${treatment?.request ?? ""}|${palette.timbre}|${palette.key}|${palette.mode}|${palette.tempo}`));
  const L = new Float64Array(sampleCount);
  const R = new Float64Array(sampleCount);

  // Pad: every chord note as a detuned L/R pair from one wavetable, low-passed per channel.
  const table = wavetable(voice.pad.harmonics);
  const cents = voice.pad.detuneCents;
  for (const [i, seg] of chordSegments({ beats, durationSec, palette }).entries()) {
    const attack = i === 0 ? 0.2 : 0.12;
    const release = 0.35;
    const s0 = Math.floor(seg.t0 * sr);
    const s1 = Math.min(sampleCount, Math.ceil((seg.t1 + release) * sr));
    for (const [k, note] of seg.notes.entries()) {
      const hz = midiHz(note);
      const level = voice.pad.level * (k === 0 ? 0.7 : 1);
      const incL = (hz * 2 ** (-cents / 1200) * TABLE) / sr;
      const incR = (hz * 2 ** (cents / 1200) * TABLE) / sr;
      let pl = (rand() * TABLE) | 0;
      let pr = (rand() * TABLE) | 0;
      for (let s = s0; s < s1; s++) {
        const t = s / sr;
        const env = Math.min(1, (t - seg.t0) / attack) * (t > seg.t1 ? Math.max(0, 1 - (t - seg.t1) / release) : 1);
        const vib = voice.pad.vibrato ? 1 + voice.pad.vibrato * Math.sin(2 * Math.PI * 5.2 * t) : 1;
        pl = (pl + incL * vib) % TABLE;
        pr = (pr + incR * vib) % TABLE;
        L[s] += level * env * table[pl | 0];
        R[s] += level * env * table[pr | 0];
        if (voice.pad.shimmer) {
          const sh = voice.pad.shimmer * level * env * Math.sin(2 * Math.PI * hz * 2.003 * t);
          L[s] += sh * 0.6;
          R[s] += sh;
        }
      }
    }
  }
  const lp = onePole(voice.pad.lowpassHz, sr);
  let fl = 0;
  let fr = 0;
  for (let s = 0; s < sampleCount; s++) {
    fl += lp * (L[s] - fl);
    fr += lp * (R[s] - fr);
    L[s] = fl;
    R[s] = fr;
  }

  // Pulse: on the tempo grid from t = 0.
  const beatSec = 60 / palette.tempo;
  const stepSec = beatSec * voice.pulse.every;
  const bassTable = wavetable(TIMBRES["pulse-synth"].pad.harmonics);
  const segments = chordSegments({ beats, durationSec, palette });
  for (let k = 0; k * stepSec < durationSec; k++) {
    const t0 = k * stepSec;
    const s0 = Math.round(t0 * sr);
    const onBeat = Math.abs((t0 / beatSec) - Math.round(t0 / beatSec)) < 1e-6;
    const len = Math.min(sampleCount - s0, Math.round(0.45 * sr));
    const lvl = voice.pulse.level;
    if (voice.pulse.kind === "thump" || (voice.pulse.kind === "bass-eighths" && onBeat)) {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += (2 * Math.PI * (45 + 65 * Math.exp(-t / 0.03))) / sr;
        const v = lvl * Math.exp(-t / 0.14) * Math.sin(ph);
        L[s0 + i] += v;
        R[s0 + i] += v;
      }
    }
    if (voice.pulse.kind === "tick") {
      for (let i = 0; i < Math.min(len, Math.round(0.08 * sr)); i++) {
        const t = i / sr;
        const v = lvl * Math.exp(-t / 0.012) * (0.6 * Math.sin(2 * Math.PI * 3100 * t) + 0.4 * (rand() * 2 - 1));
        L[s0 + i] += v * 0.9;
        R[s0 + i] += v;
      }
      if (k % 4 === 0) for (let i = 0; i < len; i++) {
        const t = i / sr;
        const v = 0.5 * lvl * Math.exp(-t / 0.2) * Math.sin(2 * Math.PI * 55 * t);
        L[s0 + i] += v;
        R[s0 + i] += v;
      }
    }
    if (voice.pulse.kind === "brush") {
      let f = 0;
      const c = onePole(2400, sr);
      for (let i = 0; i < Math.min(len, Math.round(0.25 * sr)); i++) {
        const t = i / sr;
        f += c * (rand() * 2 - 1 - f);
        const v = lvl * (t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) / 0.07)) * f;
        L[s0 + i] += v;
        R[s0 + i] += v * 0.85;
      }
    }
    if (voice.pulse.kind === "bass-eighths") {
      const seg = segments.find((g) => t0 >= g.t0 && t0 < g.t1) ?? segments[segments.length - 1];
      const inc = (midiHz(seg.notes[0]) * TABLE) / sr;
      const gate = Math.round(stepSec * 0.7 * sr);
      let ph = 0;
      for (let i = 0; i < Math.min(sampleCount - s0, gate); i++) {
        ph = (ph + inc) % TABLE;
        const env = Math.min(1, i / 96) * Math.min(1, (gate - i) / 480);
        const v = 0.55 * lvl * env * bassTable[ph | 0];
        L[s0 + i] += v;
        R[s0 + i] += v;
      }
    }
  }

  // Accents, only where a beat asked for one.
  const tonic = 60 + PITCH[palette.key];
  const strike = (t0, notes, decay, level) => {
    const s0 = Math.round(t0 * sr);
    const len = Math.min(sampleCount - s0, Math.round(decay * 3 * sr));
    const parts = voice.accent.partials;
    for (const [n, note] of notes.entries()) {
      const hz = midiHz(note);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let v = 0;
        for (let p = 0; p < parts.length; p++) {
          const ratio = voice.accent.kind === "bell" ? parts[p] : p + 1;
          const amp = voice.accent.kind === "bell" ? 1 / (p + 1) : parts[p];
          v += amp * Math.exp((-t * (1 + p * 0.8)) / decay) * Math.sin(2 * Math.PI * hz * ratio * t);
        }
        v *= level * Math.min(1, t / 0.004);
        L[s0 + i] += v * (n % 2 ? 0.8 : 1);
        R[s0 + i] += v * (n % 2 ? 1 : 0.8);
      }
    }
  };
  for (const cue of cues) {
    if (cue.kind === "hit") {
      const s0 = Math.round(cue.t * sr);
      const len = Math.min(sampleCount - s0, Math.round(0.6 * sr));
      let f = 0;
      const c = onePole(voice.accent.kind === "bell" ? 6000 : 1800, sr);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        f += c * (rand() * 2 - 1 - f);
        ph += (2 * Math.PI * (50 + 90 * Math.exp(-t / 0.02))) / sr;
        const v = 0.55 * Math.exp(-t / 0.12) * f + 0.5 * Math.exp(-t / 0.22) * Math.sin(ph);
        L[s0 + i] += v;
        R[s0 + i] += v;
      }
      if (voice.accent.kind === "bell") strike(cue.t, [tonic + 12], 0.6, 0.12);
    } else if (cue.kind === "rise") {
      const s0 = Math.round(cue.start * sr);
      const s1 = Math.min(sampleCount, Math.round(cue.t * sr));
      const span = Math.max(1, s1 - s0);
      let f = 0;
      let ph = 0;
      for (let s = s0; s < s1; s++) {
        const u = (s - s0) / span;
        f += onePole(200 + 5800 * u * u, sr) * (rand() * 2 - 1 - f);
        ph += (2 * Math.PI * midiHz(tonic - 12 + 24 * u)) / sr;
        const v = 0.45 * u * u * f + (voice.pulse.kind === "bass-eighths" ? 0.12 * u * Math.sin(ph) : 0);
        L[s] += v * (1 - 0.3 * u);
        R[s] += v * (0.7 + 0.3 * u);
      }
    } else {
      const third = palette.mode === "major" ? 4 : 3;
      strike(cue.t, [tonic - 12, tonic, tonic + third, tonic + 7], voice.accent.decay, 0.1);
    }
  }

  // End fade, so a cut-off pad never clicks.
  const fade = Math.min(Math.round(0.4 * sr), Math.floor(sampleCount / 10));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    L[sampleCount - 1 - i] *= g;
    R[sampleCount - 1 - i] *= g;
  }

  // Loudness to -16 LUFS through a soft limiter under -2 dBFS; quantized as the WAV will be.
  const ceiling = 10 ** (-2.1 / 20);
  const knee = 0.5 * ceiling;
  const limit = (x) => {
    const a = Math.abs(x);
    return a <= knee ? x : Math.sign(x) * (knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee)));
  };
  const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767) / 32767;
  const render = (gain) => {
    const l = new Float32Array(sampleCount);
    const r = new Float32Array(sampleCount);
    for (let s = 0; s < sampleCount; s++) {
      l[s] = q(limit(L[s] * gain));
      r[s] = q(limit(R[s] * gain));
    }
    return [l, r];
  };
  const raw = integratedLoudness([Float32Array.from(L), Float32Array.from(R)]);
  let gain = Number.isFinite(raw) ? 10 ** ((SOUND.targetLufs - raw) / 20) : 1;
  let [left, right] = render(gain);
  let lufs = integratedLoudness([left, right]);
  for (let i = 0; i < 8 && Number.isFinite(lufs) && Math.abs(lufs - SOUND.targetLufs) > 0.2; i++) {
    gain *= 10 ** ((SOUND.targetLufs - lufs) / 20);
    [left, right] = render(gain);
    lufs = integratedLoudness([left, right]);
  }
  return { left, right, sampleCount, palette, cues, lufs: +lufs.toFixed(2), peakDbfs: +samplePeakDbfs([left, right]).toFixed(2), loudnessMethod: "BS.1770-4" };
}

export function writeBed({ treatment, frameCount, fps, cutTimes = [], dir }) {
  const bed = buildBed({ treatment, frameCount, fps, cutTimes });
  const file = path.join(dir, "sound", "bed.wav");
  mkdirSync(path.dirname(file), { recursive: true });
  const wav = encodeWav({ left: bed.left, right: bed.right, sampleRate: SOUND.sampleRate });
  writeFileSync(file, wav);
  const summary = {
    schema: "litgravity.motion-sound-cues/v1",
    mode: "generated",
    file,
    sha256: createHash("sha256").update(wav).digest("hex"),
    sampleRate: SOUND.sampleRate,
    sampleCount: bed.sampleCount,
    durationSec: +(bed.sampleCount / SOUND.sampleRate).toFixed(6),
    frameCount,
    fps,
    palette: bed.palette,
    timbre: bed.palette.timbre,
    key: `${bed.palette.key} ${bed.palette.mode}`,
    tempo: bed.palette.tempo,
    lufs: bed.lufs,
    peakDbfs: bed.peakDbfs,
    loudnessMethod: bed.loudnessMethod,
    cutTimes: cutTimes.map(round4),
    cues: bed.cues,
  };
  writeFileSync(path.join(dir, "sound-cues.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

/** Convert a supplied or authored track to the film's exact length (50 ms fade at a trim or pad). */
export function prepareTrack({ ffmpeg, input, frameCount, fps, dir, name = "track.wav" }) {
  if (!input || !existsSync(input)) throw new SoundError("sound.file", `audio file not found: ${input}`);
  const sr = SOUND.sampleRate;
  const want = Math.round((frameCount * sr) / fps);
  const out = path.join(dir, "sound", name);
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = path.join(dir, "sound", `.src-${process.pid}-${name}`);
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-vn", "-ac", "2", "-ar", String(sr), "-c:a", "pcm_s16le", "-f", "wav", tmp], { encoding: "utf8" });
  if (r.status !== 0 || !existsSync(tmp)) {
    rmSync(tmp, { force: true });
    throw new SoundError("sound.file", `audio file could not be decoded (${describeSpawn(r)})`);
  }
  let src;
  try {
    src = decodeWav(readFileSync(tmp));
  } finally {
    rmSync(tmp, { force: true });
  }
  const have = src.channels[0].length;
  const fade = Math.round(SOUND.fadeSec * sr);
  const left = new Float32Array(want);
  const right = new Float32Array(want);
  const [a, b] = [src.channels[0], src.channels[1] ?? src.channels[0]];
  const keep = Math.min(have, want);
  left.set(a.subarray(0, keep));
  right.set(b.subarray(0, keep));
  const action = have === want ? "exact" : have > want ? "trimmed" : "padded";
  if (action !== "exact") {
    for (let i = 0; i < Math.min(fade, keep); i++) {
      const g = i / fade;
      left[keep - 1 - i] *= g;
      right[keep - 1 - i] *= g;
    }
  }
  writeFileSync(out, encodeWav({ left, right, sampleRate: sr }));
  return { file: out, sampleCount: want, sourceDurationSec: +(have / sr).toFixed(6), action };
}

/** The sound gate on the decoded muxed stream (exit 20 for a generated bed that is missing or silent at the head). */
export function auditMuxed({ ffmpeg, ffprobe = null, film, videoDurationSec, mode }) {
  const na = (id) => ({ id, status: "N/A", detail: "sound mode none" });
  const ids = ["SOUND-STREAM", "SOUND-DURATION", "SOUND-PEAK", "SOUND-HEAD", "SOUND-LOUDNESS"];
  if (mode === "none") return { rules: ids.map(na), exitCode: null };
  let present = true;
  if (ffprobe) {
    const p = spawnSync(ffprobe, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", film], { encoding: "utf8" });
    present = p.status === 0 && p.stdout.trim().length > 0;
  }
  let pcm = null;
  if (present) {
    const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", film, "-map", "0:a:0", "-f", "f32le", "-ac", "2", "-ar", String(SOUND.sampleRate), "pipe:1"], { maxBuffer: 1024 * 1024 * 1024 });
    if (r.status === 0 && r.stdout?.length) pcm = r.stdout;
    else present = false;
  }
  if (!present) {
    return {
      rules: [{ id: "SOUND-STREAM", status: "FAIL", detail: `no audio stream in the film although sound mode is ${mode}` }, ...ids.slice(1).map((id) => ({ id, status: "N/A", detail: "no stream" }))],
      exitCode: 20,
    };
  }
  const frames = Math.floor(pcm.length / 8);
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    l[i] = pcm.readFloatLE(i * 8);
    r[i] = pcm.readFloatLE(i * 8 + 4);
  }
  const channels = [l, r];
  const duration = frames / SOUND.sampleRate;
  const peak = samplePeakDbfs(channels);
  const head = rmsRuns(channels);
  const lufs = integratedLoudness(channels);
  const rules = [{ id: "SOUND-STREAM", status: "PASS", detail: `audio stream present (${mode})` }];
  const dd = Math.abs(duration - videoDurationSec);
  rules.push({ id: "SOUND-DURATION", status: dd <= SOUND.durationToleranceSec ? "PASS" : "FAIL", detail: `audio ${duration.toFixed(3)} s vs video ${Number(videoDurationSec).toFixed(3)} s (limit ±${SOUND.durationToleranceSec} s)` });
  rules.push({ id: "SOUND-PEAK", status: peak <= SOUND.gatePeakDbfs ? "PASS" : "FAIL", detail: `sample peak ${peak.toFixed(2)} dBFS (limit ${SOUND.gatePeakDbfs} dBFS)` });
  const headBad = head > SOUND.silenceMaxSec;
  rules.push({
    id: "SOUND-HEAD",
    status: headBad ? (mode === "generated" ? "FAIL" : "WARN") : "PASS",
    detail: `longest run below ${SOUND.silenceDbfs} dBFS RMS in the first ${SOUND.silenceHeadSec} s: ${head.toFixed(2)} s (limit ${SOUND.silenceMaxSec} s)`,
  });
  const inRange = Number.isFinite(lufs) && Math.abs(lufs - SOUND.targetLufs) <= SOUND.lufsTolerance;
  rules.push({
    id: "SOUND-LOUDNESS",
    status: mode === "generated" ? (inRange ? "PASS" : "WARN") : "PASS",
    detail: `integrated ${Number.isFinite(lufs) ? lufs.toFixed(2) : "-inf"} LUFS (BS.1770-4${mode === "generated" ? `, target ${SOUND.targetLufs} ± ${SOUND.lufsTolerance}` : ", reported"})`,
  });
  return { rules, exitCode: headBad && mode === "generated" ? 20 : null };
}

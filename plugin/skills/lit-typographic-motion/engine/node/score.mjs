// The per-film score (sound mode `score`, the default for rich films): a layered house-family track
// built in product code from the film itself, no samples and no borrowed melodies. The film's own
// words seed its key, mode, tempo, progression, motif and percussion; its beats give the arrangement
// (intro, build, the drop on the turn, break, outro) and the drop lands on a downbeat. Each stem is its
// own buffer with its own pattern: kick, clap, hats, perc, bass (sub and line), chords (stab and pad),
// lead, arrangement fx and the on-screen events. The mix high-passes every non-bass stem, pans, ducks
// bass, chords and lead under the kick, sends to a reverb and a tempo delay, compresses the bus and
// ends in the shared master stage (-16 LUFS BS.1770-4, peak under -2 dBFS). The stems are kept.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fnv1a32, mulberry32 } from "../core/util.mjs";
import { SOUND, encodeWav, masterTo, planCues, samplePeakDbfs, wavetable, WAVETABLE_SIZE } from "./sound.mjs";
import { readStyle } from "./styles.mjs";

/** Each genre's kit: tempo band, kick pattern, bass and chord idiom, swing (share of a 16th). */
const KITS = Object.freeze({
  house: { bpm: [120, 126], kick: [0, 4, 8, 12], bass: [2, 6, 10, 14], stab: [3, 6, 11, 14], openHat: true, pad: false, swing: 0 },
  "tech-house": { bpm: [124, 128], kick: [0, 4, 8, 12], bass: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], stab: [6, 14], openHat: true, pad: false, swing: 0.04 },
  "deep-house": { bpm: [118, 122], kick: [0, 4, 8, 12], bass: [3, 6, 10, 14], stab: [2, 10], openHat: true, pad: true, swing: 0.08 },
  garage: { bpm: [130, 134], kick: [0, 10], bass: [0, 3, 7, 10], stab: [3, 7, 11, 15], openHat: false, pad: true, swing: 0.16 },
});
export const SCORE_GENRES = Object.freeze(Object.keys(KITS));

const KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITY = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14] };
const ROMAN = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];
const PROGRESSIONS = {
  major: [
    [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]],
    [[9, "min7"], [5, "maj7"], [0, "maj"], [7, "maj"]],
    [[0, "maj7"], [4, "min7"], [5, "maj7"], [7, "dom7"]],
    [[5, "maj7"], [7, "maj"], [4, "min7"], [9, "min7"]],
    [[0, "maj7"], [9, "min7"], [2, "min7"], [7, "dom7"]],
    [[2, "min9"], [7, "dom7"], [0, "maj9"], [0, "maj9"]],
  ],
  minor: [
    [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]],
    [[0, "min7"], [5, "min7"], [10, "maj"], [3, "maj7"]],
    [[0, "min"], [10, "maj"], [8, "maj"], [10, "maj"]],
    [[0, "min7"], [7, "min7"], [8, "maj7"], [5, "min7"]],
    [[8, "maj7"], [10, "maj"], [0, "min9"], [0, "min9"]],
    [[0, "min9"], [5, "min7"], [0, "min9"], [7, "min7"]],
  ],
};
const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
const chordName = ([offset, quality]) => {
  const minorish = quality.startsWith("min");
  const r = ROMAN[offset];
  return `${minorish ? r.toLowerCase() : r}${quality.replace(/^(?:maj|min)$/u, "").replace(/^min/u, "").replace(/^maj(?=\d)/u, "maj")}`;
};

/** The stems in mix order with their gain, pan, high-pass and sidechain depth. */
const MIX = Object.freeze({
  kick: { gain: 1.0, pan: 0, hp: 0, duck: 0, reverb: 0, delay: 0 },
  clap: { gain: 0.5, pan: 0, hp: 180, duck: 0, reverb: 0.22, delay: 0 },
  hats: { gain: 0.3, pan: 0.28, hp: 5000, duck: 0, reverb: 0.06, delay: 0 },
  perc: { gain: 0.34, pan: -0.32, hp: 220, duck: 0.15, reverb: 0.16, delay: 0.1 },
  bass: { gain: 0.62, pan: 0, hp: 0, duck: 0.85, reverb: 0, delay: 0 },
  chords: { gain: 0.36, pan: 0, hp: 160, duck: 0.6, reverb: 0.3, delay: 0.12 },
  lead: { gain: 0.3, pan: 0.16, hp: 260, duck: 0.3, reverb: 0.34, delay: 0.3 },
  fx: { gain: 0.42, pan: 0, hp: 90, duck: 0, reverb: 0.28, delay: 0 },
  events: { gain: 0.62, pan: 0, hp: 60, duck: 0, reverb: 0.12, delay: 0 },
});
export const SCORE_STEMS = Object.freeze(Object.keys(MIX));

const sectionAt = (sections, t) => sections.find((s) => t >= s.t0 && t < s.t1) ?? null;

/** The beats as an arrangement: intro, builds, the drop on the turn shot, a break before a second drop, an outro. */
function arrange(beats, turn) {
  const last = beats.length - 1;
  const after = beats.length - 1 - turn;
  return beats.map((b, i) => {
    let kind;
    if (i === turn) kind = "drop";
    else if (i < turn) kind = i === 0 ? "intro" : "build";
    else if (i === last) kind = "outro";
    else kind = after >= 3 && i === turn + 1 ? "break" : "drop";
    return { kind, t0: Number(b.t0), t1: Number(b.t1), beat: i };
  });
}

/**
 * The film's score plan: genre, key, tempo, progression, motif, sections, kick times and arrangement
 * fx. Pure and seeded from the treatment, so two films differ and one film always plans the same.
 */
export function planScore({ treatment, durationSec, cutTimes = [] }) {
  const style = readStyle(treatment.style);
  const genre = treatment.sound?.genre ?? style.score.genre;
  const kit = KITS[genre];
  const beats = Array.isArray(treatment.beats) && treatment.beats.length ? treatment.beats : [{ t0: 0, t1: durationSec }];
  const fingerprint = [treatment.request, treatment.idea, treatment.story?.turn, treatment.protagonist?.name, ...beats.map((b) => `${b.purpose}|${b.t0}|${b.t1}`)].join("\n");
  const seed = fnv1a32(fingerprint);
  const rand = mulberry32(seed);
  const tonic = seed % 12;
  const mode = rand() < (genre === "deep-house" ? 0.45 : 0.62) ? "minor" : "major";
  const bpm = kit.bpm[0] + Math.floor(rand() * (kit.bpm[1] - kit.bpm[0] + 1));
  const progression = PROGRESSIONS[mode][Math.floor(rand() * PROGRESSIONS[mode].length)];
  const turn = Number.isInteger(treatment.story?.beat) && treatment.story.beat < beats.length ? treatment.story.beat : Math.min(beats.length - 1, Math.floor(beats.length / 2));
  const sections = arrange(beats, turn).map((s, i, all) => ({ ...s, t1: i === all.length - 1 ? durationSec : s.t1 }));
  const drop = sections.find((s) => s.kind === "drop");
  const stepSec = 60 / bpm / 4;
  const barSec = 16 * stepSec;
  // The grid is placed so that a bar line falls exactly on the drop.
  const origin = drop.t0 - Math.ceil(drop.t0 / barSec - 1e-9) * barSec;
  const steps = [];
  for (let n = Math.ceil(-origin / stepSec - 1e-9); origin + n * stepSec < durationSec - 1e-9; n++) {
    const pos = ((n % 16) + 16) % 16;
    const t = origin + n * stepSec + (pos % 2 ? kit.swing * stepSec : 0);
    if (t < 0 || t >= durationSec) continue;
    const bar = Math.floor(n / 16);
    steps.push({ n, pos, bar, t, section: sectionAt(sections, t) });
  }
  const preDrop = drop.t0 - barSec / 2;
  const kicks = steps.filter((s) => s.section && ["build", "drop", "outro"].includes(s.section.kind) && kit.kick.includes(s.pos) && !(s.t >= preDrop && s.t < drop.t0) && !(s.section.kind === "outro" && s.t > s.section.t1 - barSec / 2)).map((s) => +s.t.toFixed(6));
  // A motif of one bar: six to eight notes of the pentatonic scale on a random walk, its last bar lifted.
  const motif = [];
  let degree = Math.floor(rand() * 3);
  for (let pos = 0; pos < 16; pos++) {
    if (rand() < (pos % 4 === 0 ? 0.62 : 0.4)) {
      degree = Math.max(0, Math.min(7, degree + Math.floor(rand() * 5) - 2));
      motif.push({ pos, degree });
    }
  }
  const percPattern = Array.from({ length: 16 }, (_, pos) => (pos % 4 !== 0 && rand() < 0.38 ? 1 + Math.floor(rand() * 3) : 0));
  const fx = [];
  sections.forEach((s, i) => {
    if (i === 0) return;
    const into = s.kind === "drop";
    const span = Math.min(into ? 2 * barSec : barSec / 2, s.t0 - sections[i - 1].t0);
    fx.push({ kind: "riser", start: +(s.t0 - span).toFixed(6), t: s.t0, strength: into ? 1 : 0.45 });
    if (into) fx.push({ kind: "impact", t: s.t0 });
    if (sections[i - 1].kind === "drop" && !into) fx.push({ kind: "downlifter", t: s.t0, end: +Math.min(s.t1, s.t0 + barSec).toFixed(6) });
    // A reverse swell of the coming chord breathes into every change that is not a drop.
    if (!into) fx.push({ kind: "reverse", start: +(s.t0 - Math.min(barSec / 2, s.t0 - sections[i - 1].t0)).toFixed(6), t: s.t0 });
  });
  return {
    genre, key: KEY_NAMES[tonic], tonic, mode, bpm, seed,
    progression: progression.map(chordName), chords: progression,
    motif, percPattern, sections, kicks, fx, stepSec, barSec, origin, steps,
  };
}

// ---- synthesis helpers ----
const SR = SOUND.sampleRate;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
// A one-pole coefficient, stable for any cutoff: below 1 Hz it would turn negative and diverge.
const onePole = (hz) => 1 - Math.exp((-2 * Math.PI * Math.max(1, hz)) / SR);

function rbj(type, hz, q = 0.707) {
  const w = (2 * Math.PI * Math.min(hz, SR * 0.45)) / SR;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = type === "hp" ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : type === "lp" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [alpha, 0, -alpha];
  return { b: b.map((v) => v / a0), a: [1, (-2 * cos) / a0, (1 - alpha) / a0] };
}

function filter(x, { b, a }) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    x[i] = v;
  }
  return x;
}

class Stem {
  constructor(n) {
    this.L = new Float64Array(n);
    this.R = new Float64Array(n);
  }

  /** Add a mono buffer at sample s0, panned -1..1 (constant power), scaled by gain. */
  add(s0, mono, pan = 0, gain = 1) {
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * gain;
    const gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * gain;
    const end = Math.min(this.L.length, s0 + mono.length);
    for (let s = Math.max(0, s0); s < end; s++) {
      this.L[s] += gl * mono[s - s0];
      this.R[s] += gr * mono[s - s0];
    }
  }
}

const buffer = (sec) => new Float64Array(Math.max(1, Math.round(sec * SR)));

function kickVoice() {
  const b = buffer(0.36);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (46 + 110 * Math.exp(-t / 0.035))) / SR;
    b[i] = Math.exp(-t / 0.2) * Math.sin(ph) + (t < 0.004 ? 0.3 * (1 - t / 0.004) : 0);
  }
  return b;
}

function noiseVoice(rand, sec, decay, { hp = 0, lp = 0, bursts = 1, gap = 0.011 } = {}) {
  const b = buffer(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let env = 0;
    for (let k = 0; k < bursts; k++) if (t >= k * gap) env = Math.max(env, Math.exp(-(t - k * gap) / (k === bursts - 1 ? decay : 0.006)));
    b[i] = (rand() * 2 - 1) * env;
  }
  if (hp) filter(b, rbj("hp", hp));
  if (lp) filter(b, rbj("lp", lp));
  return b;
}

function toneVoice(hz, sec, decay, { partials = [1], attack = 0.002 } = {}) {
  const b = buffer(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    partials.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * hz * (k + 1) * t); });
    b[i] = v * Math.min(1, t / attack) * Math.exp(-t / decay);
  }
  return b;
}

const SAW = wavetable([1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08]);
const SQUARE = wavetable([1, 0, 0.33, 0, 0.2, 0, 0.14, 0, 0.11]);

/** A filtered table voice: notes as detuned pairs, an amp envelope and a low-pass that closes over the note. */
function tableVoice(table, notes, sec, { attack = 0.004, decay = 0.25, sustain = 0, release = 0.05, cutoff = 2400, cutoffEnd = 600, detune = 8, phase = 0 } = {}) {
  const b = buffer(sec + release);
  const hold = Math.round(sec * SR);
  for (const note of notes) {
    for (const cents of [-detune, detune]) {
      const inc = (midiHz(note) * 2 ** (cents / 1200) * WAVETABLE_SIZE) / SR;
      let ph = (phase * WAVETABLE_SIZE + (cents > 0 ? WAVETABLE_SIZE / 3 : 0)) % WAVETABLE_SIZE;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const env = Math.min(1, t / attack) * (sustain + (1 - sustain) * Math.exp(-t / decay)) * (i < hold ? 1 : Math.max(0, 1 - (i - hold) / (release * SR)));
        ph = (ph + inc) % WAVETABLE_SIZE;
        b[i] += (env * table[ph | 0]) / notes.length;
      }
    }
  }
  let f = 0;
  for (let i = 0; i < b.length; i++) {
    const u = Math.min(1, i / Math.max(1, b.length));
    f += onePole(cutoff + (cutoffEnd - cutoff) * u) * (b[i] - f);
    b[i] = f;
  }
  return b;
}

function voicing(plan, chord, octave = 48) {
  const [offset, quality] = chord;
  const root = octave + plan.tonic + offset - (offset > 6 ? 12 : 0);
  return QUALITY[quality].map((iv) => root + iv);
}

/** The chord under time t: one per bar from the grid's origin, the last bar of the film resolves home. */
function chordAt(plan, t, durationSec) {
  const bar = Math.floor((t - plan.origin) / plan.barSec);
  if (t >= durationSec - plan.barSec && plan.sections.length > 1) return [0, plan.mode === "major" ? "maj7" : "min9"];
  return plan.chords[((bar % plan.chords.length) + plan.chords.length) % plan.chords.length];
}

// ---- the score ----

/** Build the score: the mixed track, every stem, the plan and the cue list. */
export function buildScore({ treatment, frameCount, fps, cutTimes = [] }) {
  const sampleCount = Math.round((frameCount * SR) / fps);
  const durationSec = sampleCount / SR;
  const plan = planScore({ treatment, durationSec, cutTimes });
  const beats = Array.isArray(treatment.beats) ? treatment.beats : [];
  const cues = planCues({ beats, durationSec, cutTimes, events: treatment.sound?.events });
  const rand = mulberry32(plan.seed ^ 0x9e3779b9);
  const stems = Object.fromEntries(SCORE_STEMS.map((k) => [k, new Stem(sampleCount)]));
  const at = (t) => Math.round(t * SR);
  const kick = kickVoice();
  const drop = plan.sections.find((s) => s.kind === "drop");

  for (const t of plan.kicks) stems.kick.add(at(t), kick);
  for (const step of plan.steps) {
    const sec = step.section;
    if (!sec) continue;
    const { kind } = sec;
    const full = kind === "build" || kind === "drop";
    const progress = (step.t - sec.t0) / Math.max(1e-6, sec.t1 - sec.t0);
    // Clap on two and four; a snare roll that tightens over the last bar into the drop.
    if (full && (step.pos === 4 || step.pos === 12) && !(step.t >= drop.t0 - plan.barSec && step.t < drop.t0)) stems.clap.add(at(step.t), noiseVoice(rand, 0.3, 0.13, { hp: 900, lp: 5200, bursts: 3 }), 0, 1);
    if (step.t >= drop.t0 - plan.barSec && step.t < drop.t0) {
      const u = 1 - (drop.t0 - step.t) / plan.barSec;
      if (u < 0.5 ? step.pos % 2 === 0 : true) stems.clap.add(at(step.t), noiseVoice(rand, 0.12, 0.05, { hp: 700, lp: 6000 }), 0, 0.35 + 0.65 * u);
      if (u >= 0.75) stems.clap.add(at(step.t + plan.stepSec / 2), noiseVoice(rand, 0.08, 0.03, { hp: 700, lp: 6000 }), 0, 0.8 * u);
    }
    // Hats: closed sixteenths with offbeat accents, open hats on the offbeat in the drop.
    const hatsOn = kind === "intro" ? step.pos % 2 === 0 : kind === "break" ? false : kind === "outro" ? step.pos % 2 === 0 : true;
    if (hatsOn) stems.hats.add(at(step.t), noiseVoice(rand, 0.06, 0.018, { hp: 7000 }), 0, (step.pos % 4 === 2 ? 0.9 : 0.5) * (kind === "intro" ? 0.35 + 0.5 * progress : 1));
    if (kind === "drop" && KITS[plan.genre].openHat && step.pos % 4 === 2) stems.hats.add(at(step.t), noiseVoice(rand, 0.3, 0.12, { hp: 6000 }), -0.4, 0.55);
    // Perc: the film's own sixteen-step pattern of rims and toms, everywhere but the break's first half.
    const hit = plan.percPattern[step.pos];
    if (hit && !(kind === "break" && progress < 0.5)) {
      const hz = [0, 520, 380, 760][hit];
      const tone = toneVoice(hz, 0.16, hit === 3 ? 0.03 : 0.06, { partials: [1, 0.3] });
      const click = noiseVoice(rand, 0.02, 0.004, { hp: 2000 });
      for (let i = 0; i < click.length; i++) tone[i] += 0.5 * click[i];
      stems.perc.add(at(step.t), tone, hit === 2 ? -0.5 : 0.35, kind === "intro" ? 0.5 : 0.85);
    }
    if (kind !== "intro" && kind !== "break" && step.pos % 2 === 1) stems.perc.add(at(step.t), noiseVoice(rand, 0.05, 0.012, { hp: 4500 }), 0.6, 0.25);
    // Bass line: the kit's pattern on the chord root, from the build on, out in the break.
    const chord = chordAt(plan, step.t, durationSec);
    const root = 36 + plan.tonic + chord[0] - (chord[0] > 6 ? 12 : 0);
    if ((kind === "build" && progress > 0.25) || kind === "drop" || (kind === "outro" && progress < 0.5)) {
      if (KITS[plan.genre].bass.includes(step.pos)) {
        const octave = step.pos % 8 === 6 && plan.genre !== "deep-house" ? 12 : 0;
        stems.bass.add(at(step.t), tableVoice(SAW, [root + octave], plan.stepSec * 0.9, { decay: 0.12, sustain: 0.5, cutoff: 1400, cutoffEnd: 300, detune: 4 }), 0, 0.75);
      }
    }
    // Chord stabs on the kit's steps in builds and drops.
    if ((kind === "build" || kind === "drop") && KITS[plan.genre].stab.includes(step.pos)) {
      stems.chords.add(at(step.t), tableVoice(SAW, voicing(plan, chord, 60), plan.stepSec * 1.4, { decay: 0.09, cutoff: kind === "drop" ? 4200 : 1800 + 2200 * progress, cutoffEnd: 900, detune: 11 }), 0, 0.9);
    }
    // Lead: the motif in the drop and the break, an octave up and drier in the break.
    if (kind === "drop" || kind === "break") {
      const note = plan.motif.find((m) => m.pos === step.pos);
      if (note) {
        const scale = PENTA[plan.mode];
        const lift = step.bar % 4 === 3 && note.pos >= 8 ? 2 : 0;
        const d = note.degree + lift;
        const midi = 72 + plan.tonic + scale[d % 5] + 12 * Math.floor(d / 5) + (kind === "break" ? 12 : 0);
        stems.lead.add(at(step.t), tableVoice(SQUARE, [midi], plan.stepSec * 1.8, { decay: 0.16, sustain: 0.2, cutoff: 5200, cutoffEnd: 1400, detune: 6 }), 0, kind === "break" ? 0.6 : 1);
      }
    }
  }

  // Sustained layers, one chord per bar: the sub under the drop and outro, the pad in the intro,
  // break and outro (and under the drop for the pad genres), opening its filter across the section.
  for (let bar = Math.floor(-plan.origin / plan.barSec) - 1; plan.origin + bar * plan.barSec < durationSec; bar++) {
    const t0 = Math.max(0, plan.origin + bar * plan.barSec);
    const t1 = Math.min(durationSec, plan.origin + (bar + 1) * plan.barSec);
    if (t1 <= t0) continue;
    const chord = chordAt(plan, (t0 + t1) / 2, durationSec);
    const sec = sectionAt(plan.sections, (t0 + t1) / 2);
    if (!sec) continue;
    const root = 36 + plan.tonic + chord[0] - (chord[0] > 6 ? 12 : 0);
    if (sec.kind === "drop" || sec.kind === "outro") {
      const sub = toneVoice(midiHz(root), t1 - t0 + 0.05, 1e6, { attack: 0.01 });
      const tail = Math.round(0.05 * SR);
      for (let i = 0; i < tail; i++) sub[sub.length - 1 - i] *= i / tail;
      stems.bass.add(at(t0), sub, 0, 0.55);
    }
    const padHere = sec.kind === "intro" || sec.kind === "break" || sec.kind === "outro" || (KITS[plan.genre].pad && sec.kind === "drop") || sec.kind === "build";
    if (padHere) {
      // A bar may start before its section (the grid can begin before 0 s), so clamp the progress.
      const u = Math.min(1, Math.max(0, (t0 - sec.t0) / Math.max(1e-6, sec.t1 - sec.t0)));
      const open = sec.kind === "intro" || sec.kind === "build" ? 700 + 3000 * u : sec.kind === "break" ? 2600 : 1800;
      stems.chords.add(at(t0), tableVoice(SAW, voicing(plan, chord, 48), t1 - t0, { attack: 0.25, decay: 1e6, sustain: 1, release: 0.4, cutoff: open, cutoffEnd: open * 1.3, detune: 14, phase: (bar * 0.37) % 1 }), 0, sec.kind === "drop" ? 0.35 : 0.6);
    }
  }

  // Arrangement fx: risers into each change (the strongest into the drop), the impact on the drop, a
  // downlifter after it, and a reverse swell into each change that is not a drop.
  for (const f of plan.fx) {
    if (f.kind === "riser") {
      const len = Math.max(1, at(f.t) - at(f.start));
      const b = new Float64Array(len);
      let lp = 0;
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const u = i / len;
        lp += onePole(300 + 7000 * u * u) * (rand() * 2 - 1 - lp);
        ph += (2 * Math.PI * midiHz(60 + plan.tonic + 24 * u)) / SR;
        b[i] = f.strength * u * u * (0.8 * lp + 0.25 * Math.sin(ph));
      }
      stems.fx.add(at(f.start), b, 0, 1);
    } else if (f.kind === "impact") {
      const boom = toneVoice(42, 1.6, 0.5, { attack: 0.001 });
      const crash = noiseVoice(rand, 1.4, 0.45, { hp: 3000 });
      for (let i = 0; i < boom.length; i++) boom[i] = 0.9 * boom[i] + 0.35 * (crash[i] ?? 0);
      stems.fx.add(at(f.t), boom, 0, 1);
    } else if (f.kind === "reverse") {
      const sec = Math.max(1 / SR, f.t - f.start);
      const tail = tableVoice(SAW, voicing(plan, chordAt(plan, f.t, durationSec), 60), sec, { attack: 0.002, decay: sec * 0.45, sustain: 0, release: 0.01, cutoff: 4200, cutoffEnd: 900, detune: 10 });
      tail.reverse();
      stems.fx.add(at(f.start), tail, 0, 0.5);
    } else {
      const len = Math.max(1, at(f.end) - at(f.t));
      const b = new Float64Array(len);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const u = 1 - i / len;
        lp += onePole(200 + 5000 * u * u) * (rand() * 2 - 1 - lp);
        b[i] = 0.6 * u * u * lp;
      }
      stems.fx.add(at(f.t), b, 0, 1);
    }
  }

  // Cues: the beats' own asks (a hit on a cut, a cadence) and every on-screen event, on its frame.
  const tonicMidi = 72 + plan.tonic;
  for (const cue of cues) {
    if (cue.kind === "hit") stems.fx.add(at(cue.t), toneVoice(55, 0.5, 0.18, { partials: [1, 0.4] }), 0, 0.7);
    else if (cue.kind === "cadence") stems.chords.add(at(cue.t), tableVoice(SAW, voicing(plan, [0, plan.mode === "major" ? "maj9" : "min9"], 60), 1.2, { attack: 0.01, decay: 0.8, cutoff: 3200, cutoffEnd: 800 }), 0, 0.7);
    else if (cue.kind === "event") {
      if (cue.sound === "tap") {
        const tone = toneVoice(midiHz(tonicMidi + 12 + (plan.mode === "major" ? 7 : 3)), 0.3, 0.07);
        const click = noiseVoice(rand, 0.03, 0.006, { hp: 2500 });
        for (let i = 0; i < click.length; i++) tone[i] += 1.4 * click[i];
        stems.events.add(at(cue.t), tone, 0.1, 1);
      } else if (cue.sound === "whoosh") {
        const len = at(0.4);
        const b = new Float64Array(len + at(0.08));
        let lp = 0;
        for (let i = 0; i < b.length; i++) {
          const u = i < len ? i / len : 1 - (i - len) / at(0.08);
          lp += onePole(300 + 3200 * u) * (rand() * 2 - 1 - lp);
          b[i] = 0.7 * u * u * lp;
        }
        stems.events.add(at(cue.t) - len, b, 0, 1);
      } else if (cue.sound === "chime") {
        stems.events.add(at(cue.t), toneVoice(midiHz(tonicMidi + 12), 1.4, 0.5, { partials: [1, 0, 0.2] }), -0.2, 0.5);
        stems.events.add(at(cue.t + 0.09), toneVoice(midiHz(tonicMidi + 19), 1.4, 0.5, { partials: [1, 0, 0.2] }), 0.2, 0.45);
      } else {
        const boom = toneVoice(50, 0.6, 0.2, { attack: 0.001 });
        const snap = noiseVoice(rand, 0.4, 0.1, { hp: 1200 });
        for (let i = 0; i < boom.length; i++) boom[i] = 0.8 * boom[i] + 0.6 * (snap[i] ?? 0);
        stems.events.add(at(cue.t), boom, 0, 1);
      }
    }
  }

  // The mix: high-pass, gain and pan per stem, the sidechain from the kick times, then the sends.
  const duck = new Float64Array(sampleCount).fill(1);
  for (const t of plan.kicks) {
    const s0 = at(t);
    for (let i = 0; i < at(0.4) && s0 + i < sampleCount; i++) {
      const dt = i / SR;
      const env = dt < 0.004 ? dt / 0.004 : Math.exp(-(dt - 0.004) / 0.07);
      duck[s0 + i] = Math.min(duck[s0 + i], 1 - env);
    }
  }
  const reverbIn = [new Float64Array(sampleCount), new Float64Array(sampleCount)];
  const delayIn = [new Float64Array(sampleCount), new Float64Array(sampleCount)];
  const processed = {};
  for (const name of SCORE_STEMS) {
    const m = MIX[name];
    const { L, R } = stems[name];
    if (m.hp) {
      filter(L, rbj("hp", m.hp));
      filter(R, rbj("hp", m.hp));
    }
    const pl = Math.cos(((m.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const pr = Math.sin(((m.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let s = 0; s < sampleCount; s++) {
      const g = m.gain * (1 - m.duck * (1 - duck[s]));
      L[s] *= g * pl;
      R[s] *= g * pr;
      reverbIn[0][s] += m.reverb * L[s];
      reverbIn[1][s] += m.reverb * R[s];
      delayIn[0][s] += m.delay * L[s];
      delayIn[1][s] += m.delay * R[s];
    }
    processed[name] = { L, R };
  }
  const reverb = reverbReturn(reverbIn);
  const delay = delayReturn(delayIn, (60 / plan.bpm) * 0.75, (60 / plan.bpm) * 0.5);

  // The bus: every stem and both returns, compressed, faded at the end, then mastered.
  const busL = new Float64Array(sampleCount);
  const busR = new Float64Array(sampleCount);
  for (const { L, R } of [...Object.values(processed), reverb, delay]) {
    for (let s = 0; s < sampleCount; s++) {
      busL[s] += L[s];
      busR[s] += R[s];
    }
  }
  let peak = 0;
  for (let s = 0; s < sampleCount; s++) peak = Math.max(peak, Math.abs(busL[s]), Math.abs(busR[s]));
  const norm = peak > 0 ? 1 / peak : 1;
  const comp = compressor(busL, busR, norm);
  const fade = Math.min(at(0.4), Math.floor(sampleCount / 10));
  for (let i = 0; i < fade; i++) {
    busL[sampleCount - 1 - i] *= i / fade;
    busR[sampleCount - 1 - i] *= i / fade;
  }
  const { left, right, gain, lufs } = masterTo(busL, busR);
  const scale = norm * gain * comp.meanGain;
  const out = (st) => ({ left: Float32Array.from(st.L, (v) => v * scale), right: Float32Array.from(st.R, (v) => v * scale) });
  return {
    left, right, sampleCount, plan, cues,
    stems: Object.fromEntries(SCORE_STEMS.map((k) => [k, out(processed[k])])),
    returns: { reverb: out(reverb), delay: out(delay) },
    lufs: +lufs.toFixed(2), peakDbfs: +samplePeakDbfs([left, right]).toFixed(2), loudnessMethod: "BS.1770-4",
    bus: { ratio: comp.ratio, thresholdDbfs: comp.thresholdDbfs, maxReductionDb: +comp.maxReductionDb.toFixed(2) },
  };
}

/** A small Schroeder reverb per channel: four damped combs into two all-passes, the right channel offset. */
function reverbReturn([inL, inR]) {
  const pre = rbj("hp", 300);
  const run = (input, spread) => {
    const x = filter(Float64Array.from(input), pre);
    const y = new Float64Array(x.length);
    for (const d of [1687, 1601, 1491, 1422].map((n) => n + spread)) {
      const line = new Float64Array(d);
      let k = 0;
      let damp = 0;
      for (let i = 0; i < x.length; i++) {
        const out = line[k];
        damp = out * 0.7 + damp * 0.3;
        line[k] = x[i] + damp * 0.8;
        y[i] += out * 0.25;
        k = (k + 1) % d;
      }
    }
    for (const d of [556, 441].map((n) => n + spread)) {
      const line = new Float64Array(d);
      let k = 0;
      for (let i = 0; i < y.length; i++) {
        const buf = line[k];
        const v = -0.5 * y[i] + buf;
        line[k] = y[i] + 0.5 * buf;
        y[i] = v;
        k = (k + 1) % d;
      }
    }
    return y;
  };
  return { L: run(inL, 0), R: run(inR, 23) };
}

/** A tempo delay: a dotted eighth left and an eighth right, low-passed in the feedback path. */
function delayReturn([inL, inR], leftSec, rightSec) {
  const run = (input, sec) => {
    const d = Math.max(1, Math.round(sec * SR));
    const y = new Float64Array(input.length);
    const c = onePole(3200);
    let lp = 0;
    for (let i = 0; i < input.length; i++) {
      const back = i >= d ? y[i - d] : 0;
      lp += c * (back - lp);
      y[i] = (i >= d ? input[i - d] : 0) + 0.36 * lp;
    }
    return y;
  };
  return { L: run(inL, leftSec), R: run(inR, rightSec) };
}

/** Bus compression in place on the peak-normalized bus: 10 ms attack, 150 ms release, 2.5:1 over -10 dBFS. */
function compressor(L, R, norm) {
  const thresholdDbfs = -10;
  const ratio = 2.5;
  const att = Math.exp(-1 / (0.01 * SR));
  const rel = Math.exp(-1 / (0.15 * SR));
  let env = 0;
  let sum = 0;
  let maxReductionDb = 0;
  for (let s = 0; s < L.length; s++) {
    const x = Math.max(Math.abs(L[s]), Math.abs(R[s])) * norm;
    env = x > env ? att * env + (1 - att) * x : rel * env + (1 - rel) * x;
    const level = 20 * Math.log10(Math.max(env, 1e-9));
    const over = Math.max(0, level - thresholdDbfs);
    const reductionDb = over - over / ratio;
    maxReductionDb = Math.max(maxReductionDb, reductionDb);
    const g = 10 ** (-reductionDb / 20);
    L[s] *= g;
    R[s] *= g;
    sum += g;
  }
  return { thresholdDbfs, ratio, maxReductionDb, meanGain: L.length ? sum / L.length : 1 };
}

const rmsDbfs = (st) => {
  let s = 0;
  for (let i = 0; i < st.left.length; i++) s += st.left[i] * st.left[i] + st.right[i] * st.right[i];
  const v = Math.sqrt(s / Math.max(1, 2 * st.left.length));
  return v > 0 ? +(20 * Math.log10(v)).toFixed(2) : -Infinity;
};

/** How far the bass dips right after a kick in the drop, against 150-210 ms later (dB). */
export function sidechainDepth(score) {
  const drop = score.plan.sections.find((x) => x.kind === "drop");
  const bass = score.stems.bass.left;
  const win = (a, b) => {
    let s = 0;
    for (let i = a; i < b; i++) s += bass[i] * bass[i];
    return Math.sqrt(s / Math.max(1, b - a));
  };
  let near = 0;
  let away = 0;
  for (const k of score.plan.kicks.filter((t) => t >= drop.t0 && t + 0.25 < drop.t1)) {
    const i = Math.round(k * SR);
    near += win(i + Math.round(0.005 * SR), i + Math.round(0.035 * SR));
    away += win(i + Math.round(0.15 * SR), i + Math.round(0.21 * SR));
  }
  return near > 0 && away > 0 ? +(20 * Math.log10(away / near)).toFixed(2) : 0;
}

/** Write `sound/score.wav`, every stem and return under `sound/stems/`, and `sound-cues.json`. */
export function writeScore({ treatment, frameCount, fps, cutTimes = [], dir }) {
  const score = buildScore({ treatment, frameCount, fps, cutTimes });
  const soundDir = path.join(dir, "sound");
  mkdirSync(path.join(soundDir, "stems"), { recursive: true });
  const file = path.join(soundDir, "score.wav");
  const wav = encodeWav({ left: score.left, right: score.right });
  writeFileSync(file, wav);
  const stems = [];
  for (const [name, st] of [...Object.entries(score.stems), ...Object.entries(score.returns).map(([k, v]) => [`return-${k}`, v])]) {
    const rel = `sound/stems/${name}.wav`;
    writeFileSync(path.join(dir, rel), encodeWav(st));
    stems.push({ name, file: rel, rmsDbfs: rmsDbfs(st), ...(name.startsWith("return-") ? { kind: "return" } : { gain: MIX[name].gain, pan: MIX[name].pan, highpassHz: MIX[name].hp, sidechain: MIX[name].duck }) });
  }
  const { plan } = score;
  const summary = {
    schema: "litgravity.motion-sound-cues/v1",
    mode: "score",
    file,
    sha256: createHash("sha256").update(wav).digest("hex"),
    sampleRate: SR,
    sampleCount: score.sampleCount,
    durationSec: +(score.sampleCount / SR).toFixed(6),
    frameCount,
    fps,
    genre: plan.genre,
    key: `${plan.key} ${plan.mode}`,
    tempo: plan.bpm,
    progression: plan.progression.join("–"),
    sections: plan.sections.map(({ kind, t0, t1, beat }) => ({ kind, t0, t1, beat })),
    fx: plan.fx,
    stems,
    sidechainDb: sidechainDepth(score),
    bus: score.bus,
    lufs: score.lufs,
    peakDbfs: score.peakDbfs,
    loudnessMethod: score.loudnessMethod,
    cutTimes: cutTimes.map((t) => Math.round(t * 10000) / 10000),
    cues: score.cues,
  };
  writeFileSync(path.join(dir, "sound-cues.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

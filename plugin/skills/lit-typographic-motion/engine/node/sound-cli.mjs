// `motion.mjs sound --out <dir>`: build the generated bed from <dir>/treatment.json so it can be
// heard and its cues checked before the full render. The render rebuilds the same bed at the film's
// exact frame count and cut times, so the muxed track always matches the picture.
import { existsSync } from "node:fs";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { loadBrief, planFromBrief } from "./brief.mjs";
import { BlockedError } from "./chrome.mjs";
import { asBlocked } from "./pipeline.mjs";
import { prepareTrack, writeBed } from "./sound.mjs";
import { loadTreatment } from "./treatment.mjs";

/** Frame count, fps and cut times for a treatment: the type plan when a brief was rendered, else the beats. */
export function soundTimeline(out, treatment) {
  const briefFile = path.join(out, ".run", "brief.json");
  if (treatment.path === "type" && existsSync(briefFile)) {
    const plan = asBlocked(() => planFromBrief(loadBrief(briefFile), { targetSec: treatment.durationSec, treatment }));
    return { fps: plan.fps, frameCount: plan.frameCount, cutTimes: plan.shots.slice(1).map((s) => s.start) };
  }
  const fps = treatment.fps ?? 60;
  return { fps, frameCount: Math.round(treatment.durationSec * fps), cutTimes: treatment.beats.slice(1).map((b) => b.t0) };
}

export async function soundCommand({ out }) {
  const treatment = asBlocked(() => loadTreatment(out));
  if (treatment.sound.mode !== "generated") {
    return { code: EXIT.OK, message: `SOUND: mode ${treatment.sound.mode}; nothing to generate (the render ${treatment.sound.mode === "none" ? "adds no track" : "prepares and muxes the track"})` };
  }
  const { fps, frameCount, cutTimes } = soundTimeline(out, treatment);
  const bed = writeBed({ treatment, frameCount, fps, cutTimes, dir: out });
  return {
    code: EXIT.OK,
    message: `SOUND: generated bed (${bed.timbre}, ${bed.key}, ${bed.tempo} BPM, ${bed.lufs.toFixed(1)} LUFS, peak ${bed.peakDbfs.toFixed(1)} dBFS) in ${path.join(out, "sound", "bed.wav")}; ${bed.cues.length} cues in ${path.join(out, "sound-cues.json")}`,
  };
}

/**
 * The film's track on either path: the generated bed at the film's exact frame count and cuts, a
 * supplied or authored track padded or trimmed to the film, or none. Always muxed whatever the
 * audio-analysis tier's state (the Wave 1 renderer dropped a track when that tier was absent).
 */
export function soundTrackFor({ treatment, out, stageDir = null, frameCount, fps, cutTimes, ffmpeg }) {
  const mode = treatment.sound.mode;
  if (mode === "none") return { mode, file: null, label: "none (asked for)" };
  if (mode === "generated") {
    const bed = writeBed({ treatment, frameCount, fps, cutTimes, dir: out });
    return { mode, file: path.join(out, "sound", "bed.wav"), label: `generated bed, ${bed.timbre} in ${bed.key}, ${bed.tempo} BPM`, bed };
  }
  const base = mode === "authored" && stageDir ? stageDir : out;
  const input = path.resolve(base, treatment.sound.file);
  if (mode === "authored" && stageDir && !input.startsWith(`${path.resolve(stageDir)}${path.sep}`)) {
    throw new BlockedError(EXIT.SOUND_INVALID, `SOUND_INVALID: an authored track must be a WAV inside the stage dir (${treatment.sound.file})`);
  }
  try {
    const track = prepareTrack({ ffmpeg, input, frameCount, fps, dir: out });
    return { mode, file: track.file, label: `${mode} track, ${track.action}`, track };
  } catch (error) {
    throw new BlockedError(EXIT.SOUND_INVALID, `SOUND_INVALID: ${error.field ?? "sound.file"}: ${error.message}`);
  }
}

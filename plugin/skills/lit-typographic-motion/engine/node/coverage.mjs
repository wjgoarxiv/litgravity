// MO-D-04 glyph coverage, run before the first frame: every codepoint of every string a shot shows
// must resolve in the cmap of the font its script run uses (the same run-to-font mapping the page
// type kit uses). A missing glyph is a pre-flight FAIL naming the font and the character, never a
// blank glyph found later in a still.
import { readFileSync } from "node:fs";
import { scriptRuns } from "../core/text.mjs";
import { runFontKey } from "../core/voices.mjs";
import { loadFontManifest, fontLocation, opentypeModule } from "./runtime.mjs";

/** The strings each shot shows, with the voice they are set in. */
export function shotStrings(plan) {
  const out = [];
  const add = (shot, voice, text) => {
    if (text) out.push({ shot: shot.id ?? shot.scene, voice, text });
  };
  for (const shot of plan.shots) {
    if (shot.scene === "signature") {
      out.push({ shot: shot.id ?? shot.scene, voice: "signature", text: shot.text, strokeFont: shot.font ?? "ems-readability" });
      continue;
    }
    add(shot, "display", shot.text);
    add(shot, "display", shot.heading);
    add(shot, "machine", shot.sub);
    add(shot, "body", shot.label);
    add(shot, "machine", shot.display);
    for (const item of shot.items ?? []) add(shot, "body", item);
  }
  if (plan.preset.passes.includes("terminal-ui")) {
    out.push({ shot: "terminal-ui", voice: "chrome", text: plan.label });
    out.push({ shot: "terminal-ui", voice: "machine", text: "T+0123456789." });
  }
  return out;
}

/** Font keys a plan needs: every run font plus any stroke font. */
export function planFontKeys(plan) {
  const keys = new Set();
  for (const s of shotStrings(plan)) {
    if (s.strokeFont) {
      keys.add(s.strokeFont);
      continue;
    }
    for (const run of scriptRuns(s.text)) {
      keys.add(runFontKey(plan.preset.voices, s.voice, run.script));
      const v = plan.preset.voices[s.voice];
      if (run.script === "latin" && v.latin.startsWith("archivo-")) for (const w of v.latinWidths ?? [100]) keys.add(runFontKey(plan.preset.voices, s.voice, "latin", { widthPct: w }));
      if (run.script === "hangul" && v.weightSteps) v.weightSteps.forEach((k) => keys.add(k));
    }
  }
  return [...keys];
}

export async function checkCoverage(plan, env = process.env) {
  const manifest = loadFontManifest();
  const { parse } = await import(opentypeModule(env));
  const cache = new Map();
  const cmap = (key) => {
    if (!cache.has(key)) {
      const font = manifest.fonts[key];
      const bytes = readFileSync(fontLocation(key, font, env));
      if (font.format === "svg") {
        const chars = new Set([...bytes.toString("utf8").matchAll(/<glyph[^>]*\sunicode="([^"]*)"/gu)].map((m) => m[1].replace(/&#x([0-9a-f]+);/giu, (_, h) => String.fromCodePoint(Number.parseInt(h, 16))).replace(/&quot;/gu, '"').replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&apos;/gu, "'")));
        cache.set(key, (ch) => chars.has(ch) || ch === " ");
      } else {
        const ot = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
        cache.set(key, (ch) => ot.charToGlyphIndex(ch) > 0);
      }
    }
    return cache.get(key);
  };
  const missing = [];
  for (const s of shotStrings(plan)) {
    const runs = s.strokeFont ? [{ script: "latin", text: s.text, key: s.strokeFont }] : scriptRuns(s.text).map((run) => ({ ...run, key: runFontKey(plan.preset.voices, s.voice, run.script) }));
    for (const run of runs) {
      const has = cmap(run.key);
      for (const ch of new Set(Array.from(run.text))) {
        if (/\s/u.test(ch)) continue;
        if (!has(ch)) missing.push(`${run.key} lacks "${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}) in ${s.shot}/${s.voice}`);
      }
    }
  }
  return { ok: missing.length === 0, missing };
}

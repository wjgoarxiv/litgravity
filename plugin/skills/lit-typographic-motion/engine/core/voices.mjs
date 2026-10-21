// The one mapping from (voice, script run) to a font key, shared by the page type kit and the
// Node glyph-coverage pre-flight so both resolve the same file. Hangul runs never get a Latin
// width instance or a synthetic weight: only the voice's Hangul face, or the lit-pptx 400/700 pair
// when the voice declares weight steps (MO-A-33).
export function runFontKey(voices, voice, script, { widthPct = 100, weight } = {}) {
  const v = voices[voice];
  if (!v) throw new Error(`unknown voice: ${voice}`);
  if (script === "hangul") {
    if (weight !== undefined && v.weightSteps) return weight >= 700 ? v.weightSteps[1] : v.weightSteps[0];
    return v.hangul;
  }
  if (v.latin.startsWith("archivo-")) {
    const base = Number(v.latin.split("-")[2]);
    const widths = v.latinWidths ?? [100];
    const nearest = widths.reduce((best, x) => (Math.abs(x - widthPct) < Math.abs(best - widthPct) ? x : best), widths[0]);
    return `archivo-${nearest}-${weight ?? base}`;
  }
  return v.latin;
}

// The MO-C-17 render report, written verbatim in structure to <out>/gate-report.txt, then one line
// each for MO-C-25, MO-C-26, MO-C-27, MO-C-29, MO-D-02, MO-D-03 and MO-D-04, then one line per other
// enforced MO-A / MO-SH / MO-FT rule in rule-index order.
import { PROVISIONAL_RULES } from "../core/constants.mjs";

const pad = (label) => `  ${label}`.padEnd(34);
const verdict = (rule) => (rule ? `${rule.status}${rule.provisional ? " (provisional number)" : ""}` : "N/A");

export function formatReport({ manifest, outputs, reason, gate, round, framesViewed, software, withheld }) {
  const byId = new Map(gate.rules.map((x) => [x.id, x]));
  const line = (id, label, text) => `${pad(`${id} ${label}:`)}${text ?? `${verdict(byId.get(id))} — ${byId.get(id)?.detail ?? "not evaluated"}`}`;
  const flash = byId.get("MO-C-03");
  const contrast = byId.get("MO-C-06");
  const reading = byId.get("MO-C-07/08");
  const det = byId.get("MO-C-09");
  const floors = byId.get("MO-C-10/11/12");
  const sizes = byId.get("MO-C-13");
  const still = byId.get("MO-C-14");
  const passes = (manifest.passRanges ?? []).map((p) => `${p.pass}@${p.sceneId}#${p.shotIndex}:${p.frameStart}-${p.frameEnd}`);
  const lines = [
    "lit-typographic-motion — render report",
    `outputs: ${outputs.film} · ${outputs.preview} (encoder: ${manifest.previewEncoder ?? "none"}) · ${outputs.poster} · ${outputs.still}${withheld ? "  [WITHHELD: MO-C-03 flash audit failed; exports are diagnostics in withheld/, not deliverables]" : ""}`,
    `preset: ${manifest.presetId}  (chosen because: ${reason})`,
    `duration / fps / resolution: ${manifest.durationSec} s @ ${manifest.fps} fps, ${manifest.resolution[0] * manifest.scale}x${manifest.resolution[1] * manifest.scale}`,
    `GLSL passes (manifest): ${passes.join(", ")}`,
    `WebGL2: ${software ? "software" : "hardware"} — ${manifest.renderer}  (flags: ${manifest.chromeFlags.join(" ")})${software ? "  [software-rendered, --samples lowered to 1, tidal octaves and crt persistence downgraded]" : ""}`,
    "",
    `QA gate: ${gate.pass ? "PASS" : "FAIL"}`,
    line("MO-C-01", "GLSL presence", `${verdict(byId.get("MO-C-01"))}`),
    line("MO-C-02", "WebGL2 tier", `${verdict(byId.get("MO-C-02"))}`),
    line("MO-C-03", "flash audit", `worst window ${flash?.worst ?? "?"} general / ${flash?.worstRed ?? "?"} red  (limit 3 / 3) — ${verdict(flash)}; ${flash?.detail ?? ""}`),
    line("MO-C-04", "title-safe", `${verdict(byId.get("MO-C-04"))}  (${byId.get("MO-C-04")?.detail ?? ""})`),
    line("MO-C-05", "action-safe", `${verdict(byId.get("MO-C-05"))}`),
    line("MO-C-06", "type contrast", `${contrast?.detail ?? "not measured"} — ${verdict(contrast)}`),
    line("MO-C-07/08", "reading time", `${reading?.detail ?? ""} — ${verdict(reading)}`),
    line("MO-C-09", "determinism", `rgbaSha256 match ${det?.status === "PASS" ? "Y" : det?.status === "WARN" ? "Y (SwiftShader re-check)" : "N"}  (${det?.detail ?? ""})`),
    line("MO-C-10/11/12", "duration/fps/res", `${verdict(floors)}  (${floors?.detail ?? ""})`),
    line("MO-C-13", "file sizes", `${sizes?.detail ?? ""} — ${verdict(sizes)}`),
    line("MO-C-14", "reduced-motion still", `${still?.detail ?? ""} — ${verdict(still)}`),
    "",
    `craft rounds run: ${round} / 3 max`,
    `frames actually viewed this run: ${framesViewed ?? 0} (confirmed looked, not just rendered)`,
    "",
    "additional rules:",
  ];
  const extraOrder = ["MO-C-25", "MO-C-26", "MO-C-27", "MO-C-29", "MO-D-02", "MO-D-03", "MO-D-04"];
  for (const id of extraOrder) lines.push(line(id, "", undefined).replace(/ :\s*/u, ": "));
  const shown = new Set(["MO-C-01", "MO-C-02", "MO-C-03", "MO-C-04", "MO-C-05", "MO-C-06", "MO-C-07/08", "MO-C-09", "MO-C-10/11/12", "MO-C-13", "MO-C-14", ...extraOrder]);
  for (const rule of gate.rules) if (!shown.has(rule.id)) lines.push(`${pad(`${rule.id}:`)}${verdict(rule)} — ${rule.detail}`);
  lines.push("", `provisional numbers (spec [NEW] defaults awaiting sign-off, implemented as written): ${PROVISIONAL_RULES.join(", ")}`);
  if (!gate.pass) lines.push(`failed rules: ${gate.failed.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

export function formatPreflightReport({ preflight, reason, presetId }) {
  const lines = [
    "lit-typographic-motion — render report (pre-flight)",
    `preset: ${presetId}  (chosen because: ${reason})`,
    "",
    `QA gate: FAIL (pre-flight; no frame was rendered)`,
    ...preflight.rules.map((x) => `${pad(`${x.id}:`)}${x.status} — ${x.detail}`),
    "",
    `failed rules: ${preflight.failed.join(", ")}`,
  ];
  return `${lines.join("\n")}\n`;
}

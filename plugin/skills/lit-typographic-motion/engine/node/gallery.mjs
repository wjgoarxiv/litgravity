// `motion.mjs styles --out <dir> [--format 16:9|9:16]`: the style gallery. One short demo film, the
// same treatment and the same drawings, rendered as a board round in every house style, so a person
// can see what each style looks like before asking for a film. Each style's board lands in
// `<dir>/<style>/stills/board.png`, and `<dir>/styles.png` puts them side by side. The demo also
// proves the styles and the scaffold pass the board check as shipped.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { decodePng } from "./png.mjs";
import { scaffoldHtml } from "./scaffold.mjs";
import { renderStage } from "./stage.mjs";
import { composeGrid } from "./stills.mjs";
import { STYLE_IDS, readStyle } from "./styles.mjs";

const COPY = ["작게 시작해서 끝까지", "One clock for every frame", "한 화면에 한 가지 생각", "Same house, every film"];

/** The demo treatment for one style: four shots, one of each text layout, 12 s. */
export function demoTreatment(styleId, format = "16:9") {
  const style = readStyle(styleId);
  const hand = (i) => style.transitions[i % style.transitions.length];
  const vertical = format === "9:16" ? " vertical" : "";
  const beats = [
    { t0: 0, t1: 3, layout: "title", hero: "The opening line lands while a ring draws itself behind it.", purpose: "Open on the promise.", onScreen: "A ring drawing on behind the opening line.", motion: "The ring draws on; the line rises in.", sound: "Pad opens with a hit on the first word." },
    { t0: 3, t1: 6, layout: "split", hero: "Five bars rise in turn beside the line.", purpose: "Show the system.", onScreen: "Five bars rising beside one line.", motion: "Bars rise in stagger.", sound: "Hit on the cut." },
    { t0: 6, t1: 9, layout: "split-alt", hero: "A dot travels a path from left to right.", purpose: "Show one idea per screen.", onScreen: "A dot crossing a drawn path.", motion: "The dot travels the path.", sound: "A rise into the close." },
    { t0: 9, t1: 12, layout: "stage", hero: "A grid of squares settles above the closing line.", purpose: "Close on the house.", onScreen: "A settling grid of squares over a closing caption.", motion: "Squares settle in stagger.", sound: "Closing cadence." },
  ].map((b, i, all) => ({ ...b, lines: [i], transition: i === all.length - 1 ? "end" : hand(i) }));
  return {
    // A calibration sheet, not a film: the same simple demo in every style, so the styles compare.
    request: `render a 12 s${vertical} simple demo film in the ${styleId} style`,
    register: "minimal",
    genre: "other", path: "stage", pathReason: "The demo draws shapes beside its type, which the type engine cannot draw.",
    style: styleId,
    idea: "Four screens, one per layout, so the house style can be judged before a film is made.",
    audience: "Someone choosing a house style for their films.", channel: "A gallery sheet viewed before a film is made, played with sound.",
    format, formatReason: format === "9:16" ? "The gallery shows the vertical layouts." : "The gallery shows the landscape layouts.",
    durationSec: 12, beats,
    story: { expect: "Four screens that each show a new shape.", turn: "The bars of the second screen become the path the dot travels on the third.", beat: 2, payoff: "Everything settles into one grid above the closing line." },
    protagonist: { name: "the signal mark", kind: "object", look: "The style's signal colour as a ring, bars, a dot and one accent square.", acts: [{ beat: 0, action: "Draws itself as a ring." }, { beat: 1, action: "Rises as five bars." }, { beat: 2, action: "Travels the path as a dot." }, { beat: 3, action: "Lands as the accent square of the grid." }] },
    subject: { name: "the style demo", source: "invented", specifics: ["Four screens with a ring, bars, a travelling dot and a grid.", "Each screen uses one layout of the house grid."] },
    visualDevices: [{ kind: "shape", role: "subject", beats: [0, 1, 2, 3] }, { kind: "path", role: "support", beats: [2] }],
    typePlan: { faces: [style.faces.headline.family], hierarchy: "One line per screen in the style's headline or display size.", maxWordsOnScreen: 6 },
    sound: { mode: "generated", plan: "The style's own bed with a hit on the cuts and a closing cadence.", palette: { ...style.sound }, events: [{ t: 1.2, on: "The ring closes.", kind: "tap" }, { t: 4.4, on: "The last bar reaches its height.", kind: "tap" }, { t: 10.6, on: "The accent square lands in the grid.", kind: "chime" }] },
    copy: { source: "invented", lines: COPY },
    inventions: ["the style demo (its four screens)", "all four copy lines"],
    ambition: "Each screen shows one layout cleanly so the style's type, colour and motion read at a glance.",
  };
}

// The demo's drawings: generic shapes in the style's own colours, one per shot.
const DEMO_DRAW = [
  `(s, svg) => {
      const z = LitStage.zone(s.layout, "subject");
      const r = Math.min(z.w, z.h) * 0.34;
      const len = 2 * Math.PI * r;
      svg.innerHTML = \`<circle cx="\${z.w * 0.5}" cy="\${z.h * 0.5}" r="\${r}" fill="none" stroke="var(--lit-line)" stroke-width="6"/><circle cx="\${z.w * 0.5}" cy="\${z.h * 0.5}" r="\${r}" fill="none" stroke="var(--lit-signal)" stroke-width="6" stroke-dasharray="\${len}" stroke-dashoffset="\${len * (1 - s.enter(0, 1.6))}"/>\`;
    },`,
  `(s, svg) => {
      const z = LitStage.zone(s.layout, "subject");
      const w = z.w / 9;
      svg.innerHTML = [0, 1, 2, 3, 4].map((k) => { const h = z.h * (0.3 + 0.12 * k) * s.enter(0.1 + k * T.stagger.item * 2, T.dur.hero); return \`<rect x="\${w * (1 + k * 1.6)}" y="\${z.h * 0.9 - h}" width="\${w}" height="\${h}" fill="\${k === 4 ? "var(--lit-accent, var(--lit-signal))" : "var(--lit-signal)"}"/>\`; }).join("");
    },`,
  `(s, svg) => {
      const z = LitStage.zone(s.layout, "subject");
      const x = z.w * (0.1 + 0.8 * T.ease.move(LitStage.clamp(s.local / (s.length * 0.8))));
      svg.innerHTML = \`<path d="M\${z.w * 0.1} \${z.h * 0.6} C \${z.w * 0.35} \${z.h * 0.2}, \${z.w * 0.65} \${z.h * 0.9}, \${z.w * 0.9} \${z.h * 0.45}" fill="none" stroke="var(--lit-line)" stroke-width="5"/><circle cx="\${x}" cy="\${z.h * 0.55}" r="\${z.h * 0.06}" fill="var(--lit-signal)"/>\`;
    },`,
  `(s, svg) => {
      const z = LitStage.zone(s.layout, "subject");
      const n = 8;
      const c = Math.min(z.w / (n + 2), z.h / 4);
      const cells = [];
      for (let k = 0; k < n * 2; k++) { const e = s.enter(0.05 * k, T.dur.move); cells.push(\`<rect x="\${c * (1 + (k % n)) + c * 0.1}" y="\${z.h * 0.3 + c * Math.floor(k / n) + (1 - e) * 30}" width="\${c * 0.8}" height="\${c * 0.8}" opacity="\${e}" fill="\${k === 11 ? "var(--lit-accent, var(--lit-signal))" : "var(--lit-muted)"}"/>\`); }
      svg.innerHTML = cells.join("");
    },`,
];

/** The demo page: the scaffold with the demo drawings in its DRAW slots. */
export function demoPage(treatment) {
  let k = 0;
  return scaffoldHtml(treatment).replace(/ {4}\(s, svg, t\) => \{\},/gu, () => `    ${DEMO_DRAW[k++ % DEMO_DRAW.length]}`);
}

/** Render the gallery: a board round per style, then one sheet of the four boards. */
export async function stylesCommand({ out, format = "16:9", env = process.env, log = () => {} }) {
  if (!["16:9", "9:16"].includes(format)) return { code: EXIT.USAGE, message: "--format is 16:9 or 9:16" };
  mkdirSync(out, { recursive: true });
  const boards = [];
  const verdicts = [];
  for (const id of STYLE_IDS) {
    const dir = path.join(out, id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(path.join(dir, "stage"), { recursive: true });
    const treatment = demoTreatment(id, format);
    writeFileSync(path.join(dir, "treatment.json"), `${JSON.stringify(treatment, null, 2)}\n`);
    writeFileSync(path.join(dir, "stage", "index.html"), demoPage(treatment));
    log(`styles: rendering the ${id} board`);
    const r = await renderStage({ out: dir, round: 1, stillsOnly: true, env, log });
    verdicts.push(`${id}: ${r.code === EXIT.OK ? "board check PASS" : r.message.split(";")[0]}`);
    boards.push(decodePng(readFileSync(path.join(dir, "stills", "board.png"))));
  }
  const rgba = boards.map((b) => (b.channels === 4 ? b.pixels : toRgba(b.pixels, b.channels)));
  const sheet = composeGrid(rgba, boards[0].width, boards[0].height, { cols: 2, tw: 960, th: 540 });
  const file = path.join(out, "styles.png");
  writeFileSync(file, sheet);
  const failed = verdicts.filter((v) => !/PASS$/u.test(v));
  return { code: failed.length ? EXIT.GATE_FAIL_QA : EXIT.OK, message: `STYLES: ${file}\n${verdicts.join("\n")}` };
}

function toRgba(pixels, channels) {
  const n = pixels.length / channels;
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = pixels[i * channels];
    out[i * 4 + 1] = pixels[i * channels + (channels >= 3 ? 1 : 0)];
    out[i * 4 + 2] = pixels[i * channels + (channels >= 3 ? 2 : 0)];
    out[i * 4 + 3] = 255;
  }
  return out;
}


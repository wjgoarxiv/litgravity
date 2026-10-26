import { hasHangul, ptToMm } from "./svg.mjs";

// Latin text defaults to a TrueType face because Chrome embeds TrueType in a PDF as real text
// (CID TrueType), while CFF and variable fonts such as Pretendard become Type 3 glyphs, which
// some journal checkers reject. Hangul labels use Pretendard for every glyph of the label.
export const FONT_LATIN = "Arial, Helvetica, 'Liberation Sans', sans-serif";
export const FONT_KOREAN = "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
export const fontFor = (text) => (hasHangul(text) ? FONT_KOREAN : FONT_LATIN);

// P&ID ink on an ISO A-series sheet drawn at 1:1, in millimetres. Line weight is the tone
// hierarchy of a P&ID: equipment and main process lines carry the sheet, signals stay light.
// Pipe classes step down the ISO 128 width series (0.7, 0.5, 0.35, 0.18) so a main process
// line, a minor process line, a utility line and an instrument connection never look alike.
export const PID = Object.freeze({
  ink: "#000000",
  paper: "#ffffff",
  weight: Object.freeze({
    frame: 0.7,
    equipment: 0.5,
    major: 0.7,
    minor: 0.5,
    utility: 0.35,
    symbol: 0.35,
    signal: 0.25,
    connection: 0.18,
    leader: 0.18,
    grid: 0.18,
    detail: 0.18,
  }),
  text: Object.freeze({ tag: 2.5, label: 2.5, line: 2.2, equipment: 3.0, note: 2.5, title: 5, small: 2.2 }),
  minTextMm: 2.0,
  minStrokeMm: 0.13,
});

// Okabe–Ito: eight hues that stay distinct for the common colour-vision deficiencies.
export const OKABE_ITO = Object.freeze({
  black: "#000000",
  orange: "#E69F00",
  sky: "#56B4E9",
  green: "#009E73",
  yellow: "#F0E442",
  blue: "#0072B2",
  vermillion: "#D55E00",
  purple: "#CC79A7",
});

export const GREYS = Object.freeze(["#000000", "#333333", "#555555", "#777777", "#999999", "#BBBBBB", "#DDDDDD", "#F2F2F2", "#FFFFFF"]);

// Stream roles for apparatus figures. A role keeps one colour across every panel of a figure,
// and every role is distinguishable under deuteranopia and protanopia (checked by PALETTE.CVD).
export const STREAM = Object.freeze({
  gas: Object.freeze({ color: OKABE_ITO.blue, dash: null, label: "Gas" }),
  liquid: Object.freeze({ color: OKABE_ITO.sky, dash: null, label: "Liquid" }),
  coolant: Object.freeze({ color: OKABE_ITO.green, dash: null, label: "Coolant" }),
  heating: Object.freeze({ color: OKABE_ITO.vermillion, dash: null, label: "Heating medium" }),
  vent: Object.freeze({ color: "#777777", dash: "1.2 0.8", label: "Vent" }),
  signal: Object.freeze({ color: "#555555", dash: "0.9 0.6", label: "Signal" }),
  sample: Object.freeze({ color: OKABE_ITO.purple, dash: null, label: "Sample" }),
  vacuum: Object.freeze({ color: OKABE_ITO.orange, dash: "2 0.8", label: "Vacuum" }),
});

// Journal figures: type and line sizes at final print size.
export const JOURNAL = Object.freeze({
  width: Object.freeze({ single: 85, onehalf: 120, double: 178 }),
  maxHeight: 230,
  textPt: 7,
  minTextPt: 6,
  panelPt: 8,
  linePt: 0.75,
  minLinePt: 0.35,
  get text() { return ptToMm(this.textPt); },
  get panel() { return ptToMm(this.panelPt); },
  get line() { return ptToMm(this.linePt); },
});

// Isometric illustration tokens, light paper. These are the grey palette's shades (the opt-in
// quiet look) and the strokes, outlines and halo shared by every palette.
export const ISO = Object.freeze({
  paper: "#ffffff",
  face: "#ffffff",
  top: "#fbfbf9",
  shade: Object.freeze(["#d6d6d2", "#e1e1dd", "#eaeae6", "#f3f3f0"]),
  section: "#c9c9c4",
  cavity: Object.freeze(["#b9bcbf", "#c6c9cc", "#d2d4d6", "#dcdee0"]),
  hi: "#222226",
  mid: "#6f6f75",
  lo: "#a9a9ae",
  faint: "#d0d0d3",
  lit: "#000000",
  accent: OKABE_ITO.blue,
  halo: "#7d7d74",
  haloOpacity: 0.28,
  liquid: "#cfe3ee",
  liquidEdge: "#8fb6cc",
  gas: "#eef4f8",
  weight: 0.2,
});

// Material palette, the isometric default: each base is the mid tone of a real finish, and the
// view derives a light-to-shadow ramp from it. Colour names what a part is made of; the accent
// is signal red, a hue no common finish uses, for the one part the text is about.
export const MATERIAL = Object.freeze({
  concrete: "#b9b2a3",
  steel: "#4f86b5",
  stainless: "#aab6c2",
  frame: "#5f8f4e",
  copper: "#c8743a",
  brass: "#c9a227",
  cast: "#4a4f57",
  insulation: "#d3d7d4",
  rubber: "#2f3133",
  glass: "#bfe0e8",
  accent: "#d1493f",
  liquid: "#8cc3e0",
});

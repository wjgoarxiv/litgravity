// SVG string building for lit-schematic. Every drawing is authored in millimetres: the
// viewBox unit is 1 mm at final print size, so stroke widths and font sizes are physical
// and the QA gate can check them without knowing the page.

export const MM_PER_PT = 25.4 / 72;
export const PT_PER_MM = 72 / 25.4;
export const ptToMm = (pt) => pt * MM_PER_PT;
export const mmToPt = (mm) => mm * PT_PER_MM;

export function n(value) {
  if (!Number.isFinite(value)) throw new Error(`lit-schematic: non-finite coordinate ${value}`);
  const text = (Math.round(value * 100) / 100).toFixed(2).replace(/\.?0+$/u, "");
  return text === "-0" ? "0" : text;
}

export const esc = (text) => String(text)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function attrs(pairs = {}) {
  return Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => ` ${key}="${esc(typeof value === "number" ? n(value) : String(value))}"`)
    .join("");
}

export const el = (tag, pairs, ...children) => {
  const body = children.flat().filter((child) => child !== undefined && child !== null && child !== false).join("");
  return body ? `<${tag}${attrs(pairs)}>${body}</${tag}>` : `<${tag}${attrs(pairs)}/>`;
};

export function pathOf(points, closed = false) {
  if (!points.length) return "";
  return points.map(([x, y], index) => `${index ? "L" : "M"}${n(x)} ${n(y)}`).join("") + (closed ? "Z" : "");
}

export const hasHangul = (text) => /[ᄀ-ᇿ㄰-㆏가-힯]/u.test(String(text));

// A conservative width estimate in em units, used for label placement and by the QA gate.
// Arial-like Latin and Pretendard Hangul; it overestimates slightly so a pass is safe.
export function textWidthEm(text) {
  let units = 0;
  for (const ch of String(text)) {
    if (/\s/u.test(ch)) units += 0.28;
    else if (hasHangul(ch)) units += 0.96;
    else if (/[ilIj.,:;!|'`]/u.test(ch)) units += 0.3;
    else if (/[ftr()[\]{}/\\-]/u.test(ch)) units += 0.38;
    else if (/[MWmw@%]/u.test(ch)) units += 0.86;
    else if (/[A-Z0-9#&]/u.test(ch)) units += 0.68;
    else units += 0.56;
  }
  return units;
}

// Box of a single-line label: [x0, y0, x1, y1] for a baseline at y with the given anchor.
export function textBox(x, y, text, size, anchor = "start") {
  const width = textWidthEm(text) * size;
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return [left, y - size * 0.8, left + width, y + size * 0.22];
}

export function svgDocument({ width, height, title, desc = "", mode, lang = "en", body, defs = "", style = "", extra = {} }) {
  if (!title) throw new Error("lit-schematic: a drawing needs a title (accessible name)");
  const head = [
    `<title id="schematic-title">${esc(title)}</title>`,
    desc ? `<desc id="schematic-desc">${esc(desc)}</desc>` : "",
    style ? `<style>${style}</style>` : "",
    defs ? `<defs>${defs}</defs>` : "",
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"${attrs({
    width: `${n(width)}mm`,
    height: `${n(height)}mm`,
    viewBox: `0 0 ${n(width)} ${n(height)}`,
    role: "img",
    "aria-labelledby": desc ? "schematic-title schematic-desc" : "schematic-title",
    "xml:lang": lang,
    "data-schematic-mode": mode,
    ...extra,
  })}>${head}${body}</svg>\n`;
}

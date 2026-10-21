"use strict";

/**
 * derive-palette.js — turn any brand ACCENT hex into a harmonious, WCAG-safe
 * azure-style palette (same token set as templates/enrolled/AZURE-PRO).
 *
 * Strategy: work in HSL, keep the accent's hue, and set each token's lightness
 * to the role it must play — darkening `primary`/`primary_deep` by *relative
 * luminance* until white text clears the WCAG floor (works for any hue, incl.
 * bright yellows/greens which must go darker than a blue would).
 */

// ── color math ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const v = String(hex).replace("#", "").trim();
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t2c = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [t2c(h + 1 / 3) * 255, t2c(h) * 255, t2c(h - 1 / 3) * 255];
}
function relLuminance([r, g, b]) {
  const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [ch(r), ch(g), ch(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
/** WCAG contrast ratio between two colors. */
function contrast(a, b) {
  const l1 = relLuminance(a), l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** Contrast of white text on a given color (color is the darker one). */
function whiteContrast(rgb) { return 1.05 / (relLuminance(rgb) + 0.05); }
/** Contrast of a (dark) color as text on white — same ratio as white-on-color. */
function onWhiteContrast(rgb) { return contrast([255, 255, 255], rgb); }

function hsl(h, s, l) { return rgbToHex(hslToRgb([h, s, l])); }

/** Lighten an HSL color (raise L) until it reaches `floor` contrast on `bgRgb`. */
function lightenForContrastOn(bgRgb, h, s, lStart, floor = 4.5) {
  let L = lStart;
  for (let i = 0; i < 60; i++) {
    if (contrast(hslToRgb([h, s, L]), bgRgb) >= floor) break;
    L += 0.012;
    if (L >= 0.98) { L = 0.98; break; }
  }
  return L;
}

/** Darken an HSL color (lower L) until white text reaches `floor`. */
function darkenForWhite(h, s, l, floor = 4.5) {
  let L = l;
  for (let i = 0; i < 60; i++) {
    if (whiteContrast(hslToRgb([h, s, L])) >= floor) break;
    L -= 0.015;
    if (L <= 0.04) { L = 0.04; break; }
  }
  return L;
}
/** Darken until the color (as text) reaches `floor` on white. */
function darkenForOnWhite(h, s, l, floor = 4.5) {
  let L = l;
  for (let i = 0; i < 60; i++) {
    if (onWhiteContrast(hslToRgb([h, s, L])) >= floor) break;
    L -= 0.015;
    if (L <= 0.04) { L = 0.04; break; }
  }
  return L;
}

// ── palette derivation ──────────────────────────────────────────────────────
/**
 * @param {string} accentHex e.g. "#7C3AED"
 * @returns full azure-style palette + a `gradient:[c1,c2]` pair and meta ratios.
 */
function derivePalette(accentHex) {
  const [h, s0] = rgbToHsl(hexToRgb(accentHex));
  const s = Math.max(0.55, Math.min(0.9, s0 || 0.7)); // ensure a rich, branded chroma

  // primary: the accent, darkened (by luminance) until white text passes 4.5:1
  const pL = darkenForWhite(h, s, 0.48, 4.5);
  const primary = hsl(h, s, pL);
  const primaryRgb = hslToRgb([h, s, pL]);
  const primary_deep = hsl(h, Math.min(0.7, s + 0.05), darkenForWhite(h, s + 0.05, 0.22, 7.0));
  // azure is decorative (rings/dots/large "+") — keep it bright but ensure the
  // large "+" still clears the 3:1 large-text floor on white for any hue.
  let azureL = Math.min(0.62, pL + 0.14);
  while (azureL > 0.2 && onWhiteContrast(hslToRgb([h, s, azureL])) < 3.0) azureL -= 0.015;
  const azure = hsl(h, s, azureL);
  const azure_soft = hsl(h, Math.max(0.5, s - 0.1), 0.78);
  const tint = hsl(h, 0.55, 0.965);
  const tint_2 = hsl(h, 0.55, 0.92);
  const line = hsl(h, 0.25, 0.86);
  const ink = hsl(h, 0.45, 0.12);                 // near-black with a hue hint
  // ink_muted is body/secondary text shown on BOTH white and tint cards — darken
  // until it clears 4.5:1 on the tint (the lighter-text's harder background).
  const tintRgb = hexToRgb(tint);
  let imL = 0.42;
  while (imL > 0.18 && contrast(hslToRgb([h, 0.22, imL]), tintRgb) < 4.6) imL -= 0.012;
  const ink_muted = hsl(h, 0.22, imL);
  // light text used on primary / primary_deep filled cards — lighten until it
  // clears 4.5:1 on the *lighter* of the two (primary), so both pass.
  const emphasis_text = hsl(h, 0.4, lightenForContrastOn(primaryRgb, h, 0.4, 0.86, 4.5));
  // gradient: vivid accent → hue-shifted indigo-equivalent (both mid-dark)
  const g1 = hsl(h, Math.min(0.85, s + 0.05), 0.53);
  const g2 = hsl(h + 25, Math.min(0.8, s), 0.55);

  return {
    ground: "#FFFFFF",
    paper: hsl(h, 0.5, 0.985),
    ink, ink_muted,
    primary, primary_deep, azure, azure_soft,
    tint, tint_2, line,
    metric: ink,
    bullet_color: primary.replace("#", ""),
    section_accent: primary.replace("#", ""),
    emphasis_text,
    gradient: [g1, g2],
    _ratios: {
      whiteOnPrimary: +whiteContrast(hexToRgb(primary)).toFixed(2),
      whiteOnPrimaryDeep: +whiteContrast(hexToRgb(primary_deep)).toFixed(2),
      inkMutedOnWhite: +onWhiteContrast(hexToRgb(ink_muted)).toFixed(2),
    },
  };
}

/** Map AZURE-PRO's default decoration hexes → the derived palette equivalents,
 * so hardcoded decoration colors (rings/dots/panels/pills) recolor coherently. */
function defaultToDerivedMap(p) {
  const norm = (x) => "#" + String(x).replace("#", "").toUpperCase();
  return new Map([
    ["#1D4ED8", norm(p.primary)],
    ["#0B2E6F", norm(p.primary_deep)],
    ["#3B82F6", norm(p.azure)],
    ["#93C5FD", norm(p.azure_soft)],
    ["#EEF4FF", norm(p.tint)],
    ["#DCE9FF", norm(p.tint_2)],
    ["#D5DEEC", norm(p.line)],
    ["#0E1B2C", norm(p.ink)],
  ]);
}

module.exports = {
  derivePalette,
  defaultToDerivedMap,
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
  whiteContrast, onWhiteContrast, contrast,
};

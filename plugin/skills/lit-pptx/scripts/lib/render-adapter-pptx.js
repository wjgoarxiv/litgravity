"use strict";

/**
 * render-adapter-pptx.js — Render a resolved slide spec to a PPTX file.
 *
 * Architecture: Each text line is its own separate shape (individual addText()
 * call). Bullet items use manual "•  " prefix in green (#00AE41) Bold 16pt.
 * Section headers are separate shapes in Bold 18pt black.
 *
 * Input: resolved spec from layout-resolver, templateObj from registry, output path.
 * Output: writes a .pptx file via pptxgenjs.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runtimeRequire } = require("./runtime-require");
const { extractContent, looksLikeKpi } = require("./layout-resolver");
const { LEGACY_TOKENS } = require("./template-registry");

// Narrowest a KPI badge can be and still read as one glance (template token kpi.minCardWidth).
let KPI_MIN_CARD_WIDTH_IN = LEGACY_TOKENS.kpi.minCardWidth;
let KPI_GAP = LEGACY_TOKENS.kpi.gap;

const TOOLKIT_ROOT = path.resolve(__dirname, "../..");
const ASSETS_MEDIA = path.join(TOOLKIT_ROOT, "assets", "media");
const ASSETS_AZURE = path.join(TOOLKIT_ROOT, "assets", "azure");

/** Resolve a decoration asset path: explicit absolute override (custom-accent
 * regenerated gradients), then d.dir "azure" → assets/azure, else assets/media. */
function decorAssetPath(d) {
  if (d.assetPath) return d.assetPath;
  if (d.dir === "azure") return path.join(ASSETS_AZURE, d.asset);
  return path.join(ASSETS_MEDIA, d.asset);
}
const hex = (c) => (c || "#000000").replace("#", "");

// A template may carry its own disclaimer line (`text:` on the decoration); this
// generic one names no organisation.
const DEFAULT_DISCLAIMER =
  "\u203B \uBCF8 \uBB38\uC11C\uB294 \uB300\uC678\uBE44\uB85C, \uAD8C\uD55C\uC774 \uC5C6\uB294 \uC790\uC5D0\uAC8C \uC5F4\uB78C, \uBCF5\uC0AC, \uBC30\uD3EC, \uACF5\uAC1C, \uB610\uB294 \uC0AC\uC6A9\uC774 \uAE08\uC9C0\uB429\uB2C8\uB2E4.";

function linkedTableCell(text, options) {
  const original = cleanMd(text);
  let display = original;
  let url = null;
  const markdown = original.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdown) {
    display = original.replace(markdown[0], markdown[1]);
    url = markdown[2];
  } else {
    const rawUrl = original.match(/https?:\/\/[^\s<>\])}]+/i);
    const doi = original.match(/\b10\.\d{4,9}\/[^\s<>\])}]+/i);
    if (rawUrl) url = rawUrl[0].replace(/[.,;:]+$/, "");
    else if (doi) url = `https://doi.org/${doi[0].replace(/[.,;:]+$/, "")}`;
  }
  return {
    text: display,
    options: {
      ...options,
      ...(url ? { hyperlink: { url } } : {}),
    },
  };
}

// ── Text style constants (defaults; every template reassigns them in render()).
// These are reassigned from the template at the start of render() so the same
// adapter serves any enrolled template (e.g. BOILERPLATE-PRETENDARD).
let FONT_BOLD = "Pretendard";
let FONT_MEDIUM = "Pretendard";
let FONT_LIGHT = "Pretendard";
let CHAR_SPACING = -0.7;
// Chart colours and faces for templates without the rich palette; set per render().
let PLAIN_CHART_STYLE = { series: ["3C3836", "689D6A", "D79921", "B16286"], ink: "3C3836", ink_muted: "6E6256", line: "CBC2B5", titleFont: "Pretendard", bodyFont: "Pretendard" };

function expandHome(p) {
  if (p === "~") return os.homedir();
  if (p && p.startsWith(`~${path.sep}`)) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveImagePath(src, sourceDir) {
  if (!src) throw new Error("Image source is empty");
  const expanded = expandHome(src);
  const candidates = [];
  if (path.isAbsolute(expanded)) candidates.push(expanded);
  else {
    if (sourceDir) candidates.push(path.resolve(sourceDir, expanded));
    candidates.push(path.resolve(process.cwd(), expanded));
    candidates.push(path.join(ASSETS_MEDIA, expanded));
    candidates.push(path.resolve(TOOLKIT_ROOT, expanded));
  }
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Image not found: ${src}. Checked: ${candidates.join(", ")}`);
  }
  return found;
}

function readImageSize(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) { offset++; continue; }
      const marker = buf[offset + 1];
      const length = buf.readUInt16BE(offset + 2);
      if (length < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function containBox(x, y, w, h, imageSize) {
  if (!imageSize || !imageSize.width || !imageSize.height) return { x, y, w, h };
  const boxRatio = w / h;
  const imageRatio = imageSize.width / imageSize.height;
  if (imageRatio > boxRatio) {
    const fittedH = w / imageRatio;
    return { x, y: y + (h - fittedH) / 2, w, h: fittedH };
  }
  const fittedW = h * imageRatio;
  return { x: x + (w - fittedW) / 2, y, w: fittedW, h };
}

// Bullet items. Geometry comes from the template's tokens (bullet.*, secHeader.*, summary.*,
// toc.*), reassigned in render(); these defaults are the legacy values.
let BULLET_COLOR = "1D4ED8"; // bullet color (reassigned per template)
let SECTION_ACCENT = "1D4ED8"; // section-card / accent color (reassigned per template)
const BULLET_PREFIX = "\u2022  "; // "•  " (bullet + two spaces)
let BULLET_X = LEGACY_TOKENS.bullet.x;
let BULLET_W = LEGACY_TOKENS.bullet.w;

// Section headers
let SEC_HEADER_FONT = FONT_BOLD;
let SEC_HEADER_SIZE = LEGACY_TOKENS.secHeader.size;
const SEC_HEADER_COLOR = "000000";
let SEC_HEADER_X = LEGACY_TOKENS.secHeader.x;
let SEC_HEADER_W = LEGACY_TOKENS.secHeader.w;
let SEC_HEADER_H = LEGACY_TOKENS.secHeader.h;

// Summary (narrow width)
let SUMMARY_HEADER_W = LEGACY_TOKENS.summary.headerW;
let SUMMARY_BULLET_W = LEGACY_TOKENS.summary.bulletW;
let SUMMARY_BULLET_SIZE = LEGACY_TOKENS.summary.bulletSize;
let SUMMARY_BULLET_H = LEGACY_TOKENS.summary.bulletH;
let SUMMARY_BULLET_Y_SPACING = LEGACY_TOKENS.summary.ySpacing;
let SUMMARY_BULLET_LINE_SPACING = LEGACY_TOKENS.summary.lineSpacing;

// TOC items (separate shapes)
let TOC_FONT = FONT_BOLD;
let TOC_SIZE = LEGACY_TOKENS.toc.size;
const TOC_COLOR = "000000";
let TOC_X = LEGACY_TOKENS.toc.x;
let TOC_W = LEGACY_TOKENS.toc.w;
let TOC_H = LEGACY_TOKENS.toc.h;
let TOC_Y_START = LEGACY_TOKENS.toc.yStart;
let TOC_Y_SPACING = LEGACY_TOKENS.toc.ySpacing;

/** Reassign the token-driven geometry from the template's pack (legacy values when absent). */
function applyTokens(tokens) {
  const t = tokens || LEGACY_TOKENS;
  ({ x: BULLET_X, w: BULLET_W } = t.bullet);
  ({ size: SEC_HEADER_SIZE, x: SEC_HEADER_X, w: SEC_HEADER_W, h: SEC_HEADER_H } = t.secHeader);
  ({ headerW: SUMMARY_HEADER_W, bulletW: SUMMARY_BULLET_W, bulletSize: SUMMARY_BULLET_SIZE, bulletH: SUMMARY_BULLET_H,
    ySpacing: SUMMARY_BULLET_Y_SPACING, lineSpacing: SUMMARY_BULLET_LINE_SPACING } = t.summary);
  ({ size: TOC_SIZE, x: TOC_X, w: TOC_W, h: TOC_H, yStart: TOC_Y_START, ySpacing: TOC_Y_SPACING } = t.toc);
  ({ pad: CARD_PAD, chip: CARD_CHIP, minH: CARD_MIN_H, gap: CARD_GAP, radius: CARD_RADIUS } = t.card);
  ({ minCardWidth: KPI_MIN_CARD_WIDTH_IN, gap: KPI_GAP } = t.kpi);
  NOTICE = { ...t.notice };
}

function weightedTextLength(text) {
  let total = 0;
  for (const ch of String(text || "")) {
    if (/\s/.test(ch)) total += 0.35;
    else if (/^[\x00-\x7F]$/.test(ch)) total += 0.58;
    else total += 1.0;
  }
  return total;
}

function estimateWrappedLines(text, widthIn, fontSize) {
  const usablePt = Math.max(12, (widthIn || 4) * 72 - 10);
  // Conservative on purpose: PowerPoint wraps dense mixed
  // Korean-English strings earlier than a naive ASCII width estimate.
  const unitsPerLine = Math.max(4, usablePt / Math.max(4, fontSize * 0.95));
  return Math.max(1, Math.ceil(weightedTextLength(text) / unitsPerLine));
}

function estimateTextHeight(text, widthIn, fontSize, lineSpacingMultiple) {
  const lines = estimateWrappedLines(text, widthIn, fontSize);
  return Math.max(0.14, ((lines * fontSize * lineSpacingMultiple) / 72) * 1.4 + 0.08);
}

function bodyElements(items) {
  const elements = [];
  let numberedCounter = 0;
  for (const item of items) {
    if (item.type === "section") {
      elements.push({ kind: "section", text: item.heading || "" });
      numberedCounter = 0;
      for (const child of item.children || []) {
        numberedCounter++;
        elements.push({ kind: "numbered", text: `(${numberedCounter})  ${child.text || ""}` });
      }
    } else if (item.type === "bullet") {
      elements.push({ kind: "bullet", text: item.text || "" });
      numberedCounter = 0;
      for (const child of item.children || []) {
        numberedCounter++;
        elements.push({ kind: "numbered", text: `(${numberedCounter})  ${child.text || ""}` });
      }
    } else if (item.type === "numbered") {
      numberedCounter++;
      elements.push({ kind: "numbered", text: `(${numberedCounter})  ${item.text || ""}` });
    } else if (item.type === "text") {
      elements.push({ kind: "text", text: item.text || "" });
    }
  }
  return elements;
}

function chooseBodyStyle(items, widthIn, startY, bottomY) {
  const available = Math.max(0.5, (bottomY || 7.0) - startY);
  const sizes = [16, 15, 14, 13];
  for (const bodySize of sizes) {
    const sectionSize = Math.min(18, bodySize + 2);
    const lineSpacing = bodySize <= 10 ? 1.05 : 1.18;
    const gap = bodySize <= 10 ? 0.035 : 0.05;
    const total = bodyElements(items).reduce((sum, el) => {
      const size = el.kind === "section" ? sectionSize : bodySize;
      const w = el.kind === "section" ? Math.min(widthIn, SEC_HEADER_W) : widthIn;
      return sum + estimateTextHeight(el.text, w, size, lineSpacing) + gap;
    }, 0);
    if (total <= available) return { bodySize, sectionSize, lineSpacing, gap };
  }
  return { bodySize: 13, sectionSize: 15, lineSpacing: 1.08, gap: 0.04 };
}

function estimateSectionHeight(item, secW, bulletW, style) {
  let total = estimateTextHeight(item.heading || "", secW, style.sectionSize, style.lineSpacing) + style.gap;
  let numberedCounter = 0;
  for (const child of item.children || []) {
    numberedCounter++;
    total += estimateTextHeight(`(${numberedCounter})  ${child.text || ""}`, bulletW, style.bodySize, style.lineSpacing) + style.gap;
  }
  return total + 0.12;
}

function addSectionCard(slide, x, y, w, h) {
  slide.addShape("rect", {
    x,
    y: y - 0.035,
    w,
    h: Math.max(0.28, h),
    fill: { color: "F7F9F8", transparency: 12 },
    line: { color: "D8E2DD", width: 0.5, transparency: 20 },
  });
}

function bodyItemsToDiagnosticLines(items) {
  const lines = [];
  let numberedCounter = 0;
  for (const item of items || []) {
    if (item.type === "section") {
      lines.push(`■ ${item.heading || ""}`);
      numberedCounter = 0;
      for (const child of item.children || []) {
        numberedCounter++;
        lines.push(`(${numberedCounter}) ${child.text || ""}`);
      }
    } else if (item.type === "bullet") {
      lines.push(`• ${item.text || ""}`);
      numberedCounter = 0;
      for (const child of item.children || []) {
        numberedCounter++;
        lines.push(`(${numberedCounter}) ${child.text || ""}`);
      }
    } else if (item.type === "numbered") {
      numberedCounter++;
      lines.push(`(${numberedCounter}) ${item.text || ""}`);
    } else if (item.type === "text") {
      lines.push(item.text || "");
    }
  }
  return lines.filter(Boolean);
}

function bodyItemsToDiagnosticCards(items) {
  const cards = [];
  let numberedCounter = 0;
  for (const item of items || []) {
    if (item.type === "section" || item.type === "bullet") {
      const title = item.heading || item.text || "";
      const body = [];
      numberedCounter = 0;
      for (const child of item.children || []) {
        numberedCounter++;
        body.push(`(${numberedCounter}) ${child.text || ""}`);
      }
      if (title || body.length) cards.push({ title, body });
    } else if (item.type === "numbered") {
      numberedCounter++;
      cards.push({ title: `(${numberedCounter})`, body: [item.text || ""] });
    } else if (item.type === "text" && item.text) {
      cards.push({ title: "", body: [item.text] });
    }
  }
  return cards;
}

function splitLinesByWeight(lines, columns) {
  const groups = Array.from({ length: columns }, () => []);
  const weights = Array(columns).fill(0);
  for (const line of lines) {
    let target = 0;
    for (let i = 1; i < columns; i++) {
      if (weights[i] < weights[target]) target = i;
    }
    groups[target].push(line);
    weights[target] += Math.max(20, weightedTextLength(line));
  }
  return groups;
}

function splitCardsByWeight(cards, columns) {
  const groups = Array.from({ length: columns }, () => []);
  const weights = Array(columns).fill(0);
  for (const card of cards) {
    let target = 0;
    for (let i = 1; i < columns; i++) {
      if (weights[i] < weights[target]) target = i;
    }
    groups[target].push(card);
    const cardWeight = weightedTextLength(card.title || "") * 1.4
      + (card.body || []).reduce((sum, line) => sum + weightedTextLength(line), 0);
    weights[target] += Math.max(80, cardWeight);
  }
  return groups;
}

function renderDiagnosticCard(slide, card, x, y, w, h, idx) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: idx % 2 ? "F8FAF9" : "F3F6F4", transparency: 2 },
    line: { color: "D6E2DB", width: 0.35, transparency: 12 },
  });
  slide.addShape("rect", {
    x,
    y,
    w: 0.028,
    h,
    fill: { color: SECTION_ACCENT, transparency: 0 },
    line: { color: SECTION_ACCENT, transparency: 100 },
  });

  const padX = 0.055;
  const padY = 0.05;
  const titleH = card.title ? Math.min(0.28, Math.max(0.18, h * 0.16)) : 0;
  if (card.title) {
    slide.addText(card.title, {
      x: x + padX,
      y: y + padY,
      w: w - padX * 1.45,
      h: titleH,
      fontFace: FONT_BOLD,
      fontSize: 7.4,
      color: "002554",
      charSpacing: -0.25,
      fit: "shrink",
      margin: 0.01,
      breakLine: false,
      valign: "top",
    });
  }

  const bodyText = (card.body || []).join("\n");
  if (bodyText) {
    slide.addText(bodyText, {
      x: x + padX,
      y: y + padY + titleH + 0.015,
      w: w - padX * 1.45,
      h: Math.max(0.16, h - titleH - padY * 1.6),
      fontFace: FONT_MEDIUM,
      fontSize: 5.85,
      color: "1F1F1F",
      charSpacing: -0.18,
      fit: "shrink",
      margin: 0.008,
      paraSpaceAfterPt: 0,
      lineSpacingMultiple: 0.96,
      breakLine: false,
      valign: "top",
    });
  }
}

function estimateDiagnosticCardHeight(card, w) {
  const padY = 0.05;
  const titleH = card.title ? 0.24 : 0;
  const bodyText = (card.body || []).join("\n");
  const bodyH = bodyText ? estimateTextHeight(bodyText, Math.max(0.8, w - 0.12), 5.85, 1.02) : 0;
  return Math.max(0.56, Math.min(2.35, padY * 2 + titleH + bodyH));
}

function renderCramStressBody(slide, items, pageH) {
  const cards = bodyItemsToDiagnosticCards(items);
  const columns = 3;
  const groups = cards.length ? splitCardsByWeight(cards, columns) : splitLinesByWeight(bodyItemsToDiagnosticLines(items), columns).map((group) => [{ title: "", body: group }]);
  const x = 0.28;
  const y = 0.98;
  const w = 7.78;
  const h = pageH - y - 0.34;
  const gap = 0.105;
  const colW = (w - gap * (columns - 1)) / columns;
  groups.forEach((group, idx) => {
    const colX = x + idx * (colW + gap);
    const cardGap = 0.075;
    const availableH = h - cardGap * Math.max(0, group.length - 1);
    const desiredHeights = group.map((card) => estimateDiagnosticCardHeight(card, colW));
    const desiredTotal = desiredHeights.reduce((sum, value) => sum + value, 0) || 1;
    const scale = desiredTotal > availableH ? availableH / desiredTotal : 1;
    let cursorY = y;
    group.forEach((card, cardIdx) => {
      const remainingCards = group.length - cardIdx - 1;
      const rawH = desiredHeights[cardIdx] * scale;
      const cardH = Math.max(0.62, Math.min(rawH, h - (cursorY - y) - remainingCards * (0.62 + cardGap)));
      renderDiagnosticCard(slide, card, colX, cursorY, colW, cardH, idx + cardIdx);
      cursorY += cardH + cardGap;
    });
  });
}

function renderCramStressImageSheet(slide, content, sourceDir, pageW, pageH) {
  if (!content) return;
  const images = content.type === "image-grid"
    ? (Array.isArray(content.images) ? content.images : [])
    : content.type === "image" ? [content] : [];
  if (images.length === 0) return;
  const x = 8.24;
  const y = 0.98;
  const w = pageW - x - 0.25;
  const h = pageH - y - 0.34;
  const cols = images.length >= 8 ? 2 : 1;
  const rows = Math.ceil(images.length / cols);
  const gap = 0.04;
  const cellW = (w - gap * (cols - 1)) / cols;
  const headerH = 0.28;
  const sheetH = Math.min(h - 0.9, rows * 0.58 + gap * (rows - 1));
  const cellH = (sheetH - gap * (rows - 1)) / rows;
  const noteY = y + headerH + sheetH + 0.16;
  const noteH = Math.min(1.0, h - (noteY - y) - 0.08);
  const panelH = noteY - y + noteH;
  slide.addShape("rect", {
    x: x - 0.04,
    y: y - 0.04,
    w: w + 0.08,
    h: panelH + 0.08,
    fill: { color: "F5F8F6", transparency: 0 },
    line: { color: "CAD4CE", width: 0.5 },
  });
  slide.addText("RAW EVIDENCE CONTACT SHEET", {
    x,
    y: y + 0.02,
    w,
    h: 0.16,
    fontFace: FONT_BOLD,
    fontSize: 5.8,
    color: "002554",
    charSpacing: -0.15,
    fit: "shrink",
    margin: 0,
  });
  slide.addShape("rect", {
    x,
    y: y + 0.22,
    w,
    h: 0,
    line: { color: SECTION_ACCENT, width: 0.45 },
  });
  images.forEach((image, idx) => {
    const imgPath = resolveImagePath(image.src, sourceDir);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const fit = containBox(
      x + col * (cellW + gap),
      y + headerH + row * (cellH + gap),
      cellW,
      cellH,
      readImageSize(imgPath),
    );
    slide.addImage({
      path: imgPath,
      ...fit,
      altText: image.caption || path.basename(image.src || imgPath),
    });
  });
  slide.addShape("rect", {
    x,
    y: noteY,
    w,
    h: noteH,
    fill: { color: "FFFFFF", transparency: 0 },
    line: { color: "D6E2DB", width: 0.35, transparency: 20 },
  });
  slide.addText("diagnostic cram-stress\nmicrotext is intentional\nproduction decks must synthesize\noverflow / marker / missing media = fail", {
    x: x + 0.06,
    y: noteY + 0.07,
    w: w - 0.12,
    h: Math.max(0.24, noteH - 0.14),
    fontFace: FONT_MEDIUM,
    fontSize: 5.3,
    color: "333333",
    charSpacing: -0.15,
    fit: "shrink",
    margin: 0.01,
    breakLine: false,
    lineSpacingMultiple: 1.02,
    valign: "mid",
  });
}

function isCramStressDeck(resolved) {
  const meta = (resolved && resolved.deck && resolved.deck.metadata) || {};
  return String(meta.render_mode || meta.renderMode || "").toLowerCase() === "cram-stress";
}

function renderCramStressSlide(slide, slideSpec, pageW, pageH, sourceDir) {
  const regions = slideSpec.regions || {};
  const title = regions.title && regions.title.content;
  if (title) {
    slide.addText(String(title), {
      x: 0.24,
      y: 0.24,
      w: pageW - 1.72,
      h: 0.46,
      fontFace: FONT_BOLD,
      fontSize: 13.5,
      color: "000000",
      charSpacing: CHAR_SPACING,
      fit: "shrink",
    });
    slide.addShape("rect", {
      x: 0.24,
      y: 0.76,
      w: pageW - 0.48,
      h: 0,
      line: { color: SECTION_ACCENT, width: 1.2 },
    });
  }
  if (regions.body && regions.body.content && regions.body.content.type === "body") {
    renderCramStressBody(slide, regions.body.content.items || [], pageH);
  }
  if (regions.image && regions.image.content) {
    renderCramStressImageSheet(slide, regions.image.content, sourceDir, pageW, pageH);
  }
}

function shouldUseDenseBodyFlow(items, widthIn, startY, bottomY) {
  const elements = bodyElements(items);
  const charCount = elements.reduce((sum, el) => sum + String(el.text || "").length, 0);
  const available = Math.max(0.5, (bottomY || 7.0) - startY);
  const estimatedAtMin = elements.reduce((sum, el) => {
    const size = el.kind === "section" ? 12.8 : 11.5;
    return sum + estimateTextHeight(el.text, Math.max(1.8, widthIn / 2), size, 1.02) + 0.025;
  }, 0);
  return widthIn >= 4.4 && (elements.length >= 18 || charCount >= 2400 || estimatedAtMin > available * 1.35);
}

function chooseDenseBodyStyle() {
  return { bodySize: 11.5, sectionSize: 12.8, lineSpacing: 1.02, gap: 0.025 };
}

// ── Font role helpers ───────────────────────────────────────────────────────

/**
 * Build font role map from template capabilities.
 * Maps YAML field names to pptxgenjs option names.
 */
function buildFontRoles(templateObj) {
  if (!templateObj || !templateObj.capabilities || !templateObj.capabilities.font_roles) {
    return {};
  }

  const roles = {};
  for (const [name, def] of Object.entries(templateObj.capabilities.font_roles)) {
    roles[name] = {
      font: def.font,
      size: def.size,
      color: (def.color || "#000000").replace("#", ""),
      align: def.align || "left",
      charSpacing: def.char_spacing,
      lineSpacing: def.line_spacing,
      bold: def.bold,
      spaceAfter: def.space_after,
      bulletType: def.bullet_type,
      bulletChar: def.bullet_char,
      bulletFont: def.bullet_font,
      numberType: def.number_type,
      marL: def.marL,
      indent: def.indent,
      fill: def.fill ? def.fill.replace("#", "") : undefined,
      borderColor: def.border_color ? def.border_color.replace("#", "") : undefined,
      borderWidth: def.border_width,
    };
  }
  return roles;
}

// ── Decoration rendering ────────────────────────────────────────────────────

/**
 * Add decoration elements to a pptxgenjs slide.
 * Note: slide_number is intentionally omitted — the reference template has none.
 */
function addDecorations(slide, decorations, fontRoles) {
  if (!decorations || !Array.isArray(decorations)) return;

  for (const d of decorations) {
    if (d.type === "image") {
      slide.addImage({
        path: decorAssetPath(d),
        x: d.x || 0,
        y: d.y || 0,
        w: d.w || 1,
        h: d.h || 1,
        rotate: d.rotate || undefined,
        altText: d.asset || "template-image",
      });

    } else if (d.type === "rect" || d.type === "roundRect" || d.type === "pill") {
      // Solid color block / rounded card / full-radius pill. Optional text label.
      const shape = d.type === "rect" ? "rect" : "roundRect";
      const opts = {
        x: d.x || 0, y: d.y || 0, w: d.w || 1, h: d.h || 0.5,
      };
      if (d.fill) opts.fill = { color: hex(d.fill), transparency: d.alpha || 0 };
      else opts.fill = { type: "none" };
      if (d.line) opts.line = { color: hex(d.line), width: d.line_width || 1 };
      else opts.line = { type: "none" };
      if (shape === "roundRect") opts.rectRadius = d.type === "pill" ? (d.h || 0.5) / 2 : (d.radius != null ? d.radius : 0.12);
      slide.addShape(shape, opts);
      if (d.text) {
        slide.addText(d.text, {
          x: d.x || 0, y: d.y || 0, w: d.w || 1, h: d.h || 0.5,
          fontFace: d.font || FONT_BOLD, fontSize: d.size || 12,
          color: hex(d.text_color || "#FFFFFF"), bold: !!d.bold,
          align: d.align || "center", valign: "middle",
          charSpacing: d.char_spacing != null ? d.char_spacing : CHAR_SPACING,
        });
      }

    } else if (d.type === "ellipse" || d.type === "ring") {
      const opts = { x: d.x || 0, y: d.y || 0, w: d.w || 1, h: d.h || (d.w || 1) };
      if (d.type === "ring" || !d.fill) {
        opts.fill = { type: "none" };
        opts.line = { color: hex(d.line || d.color || "#FFFFFF"), width: d.line_width || 2 };
      } else {
        opts.fill = { color: hex(d.fill), transparency: d.alpha || 0 };
        opts.line = { type: "none" };
      }
      slide.addShape("ellipse", opts);

    } else if (d.type === "text") {
      slide.addText(d.text || "", {
        x: d.x || 0, y: d.y || 0, w: d.w || 4, h: d.h || 1,
        fontFace: d.font || FONT_BOLD, fontSize: d.size || 14,
        color: hex(d.color || "#000000"), bold: !!d.bold,
        align: d.align || "left", valign: d.valign || "top",
        charSpacing: d.char_spacing != null ? d.char_spacing : CHAR_SPACING,
        transparency: d.transparency != null ? d.transparency : undefined,
      });

    } else if (d.type === "line") {
      slide.addShape("rect", {
        x: d.x || 0,
        y: d.y || 0,
        w: d.w || 1,
        h: 0,
        line: { color: (d.color || "#000000").replace("#", ""), width: d.width || 1 },
      });

    } else if (d.type === "confidential_mark") {
      const role = fontRoles.confidential_mark || {};
      const mX = d.x || 0, mY = d.y || 0, mW = d.w || 1, mH = d.h || 0.3;
      const bColor = role.borderColor || "C00000";
      const bPt = role.borderWidth || 1;
      slide.addShape("rect", {
        x: mX, y: mY, w: mW, h: mH,
        line: { color: bColor, width: bPt },
      });
      slide.addText("\u5C0D \u5916 \u79D8", {
        x: mX, y: mY, w: mW, h: mH,
        fontFace: role.font || FONT_MEDIUM,
        fontSize: role.size || 14,
        color: role.color || "C00000",
        align: role.align || "center",
        valign: "middle",
      });

    } else if (d.type === "disclaimer") {
      const role = fontRoles.disclaimer || {};
      slide.addText(
        d.text || DEFAULT_DISCLAIMER,
        {
          x: d.x || 0,
          y: d.y || 0,
          w: d.w || 1,
          h: d.h || 0.2,
          fontFace: role.font || FONT_LIGHT,
          fontSize: role.size || 6,
          color: role.color || "666666",
          align: role.align || "left",
        }
      );
    }
    // slide_number intentionally removed — reference template has none
  }
}

// ── Body shape rendering (individual shapes per line) ────────────────────

/**
 * Add body items as individual shapes to a slide.
 * Each section header and bullet item is a separate positioned shape.
 *
 * @param {object} slide - pptxgenjs slide
 * @param {Array} items - AST items (section, bullet, numbered, text)
 * @param {number} startY - Starting y position
 * @param {number} maxX - Max width for positioning
 * @returns {number} The y position after the last item
 */
function addBodyShapes(slide, items, startY, maxX, bottomY, originX) {
  const denseFlow = shouldUseDenseBodyFlow(items, maxX, startY, bottomY || 7.0);
  const columns = denseFlow ? 2 : 1;
  const colGap = denseFlow ? 0.16 : 0;
  const colW = (maxX - colGap * (columns - 1)) / columns;
  let col = 0;
  let y = startY;
  // Template regions have always drawn body text at the template's own left
  // margin. A placed box carries its own, and passes it here.
  const baseX = originX != null ? originX : SEC_HEADER_X;
  const bodyIndent = denseFlow ? 0.13 : (BULLET_X - SEC_HEADER_X);
  const BODY_FULL_W = 10.188;
  const scale = colW / BODY_FULL_W;
  const secW = denseFlow ? Math.max(1.4, colW - 0.04) : SEC_HEADER_W * scale;
  const bulletW = denseFlow ? Math.max(1.2, colW - bodyIndent - 0.02) : BULLET_W * scale;
  let numberedCounter = 0;
  const style = denseFlow ? chooseDenseBodyStyle() : chooseBodyStyle(items, bulletW, startY, bottomY || 7.0);

  function colX() { return baseX + col * (colW + colGap); }
  function secX() { return colX(); }
  function bulletX() { return colX() + bodyIndent; }
  function maybeAdvanceColumn(nextHeight) {
    if (!denseFlow || col >= columns - 1) return;
    if (y + nextHeight > (bottomY || 7.0)) {
      col++;
      y = startY;
    }
  }

  for (const item of items) {
    if (item.type === "section") {
      const sectionH = estimateTextHeight(item.heading, secW, style.sectionSize, style.lineSpacing);
      const cardH = estimateSectionHeight(item, secW, bulletW, style);
      maybeAdvanceColumn(Math.min(cardH, sectionH + 0.2));
      addSectionCard(slide, secX() - 0.035, y - 0.03, Math.max(secW, bulletW + bodyIndent) + 0.07, cardH);
      // Section header — separate shape, black, 1.5 line spacing
      slide.addText(mdRuns(item.heading, {
        fontFace: SEC_HEADER_FONT,
        fontSize: style.sectionSize,
        color: SEC_HEADER_COLOR,
        charSpacing: CHAR_SPACING,
      }), {
        x: secX(),
        y: y,
        w: secW,
        h: sectionH,
        lineSpacingMultiple: style.lineSpacing,
      });
      y += sectionH + style.gap;

      // Numbered children with (1)(2)(3) format
      if (item.children) {
        numberedCounter = 0;
        for (const child of item.children) {
          numberedCounter++;
          const numPrefix = `(${numberedCounter})  `;
          const text = numPrefix + cleanMd(child.text);
          const h = estimateTextHeight(text, bulletW, style.bodySize, style.lineSpacing);
          maybeAdvanceColumn(h);
          slide.addText([
            { text: numPrefix, options: { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING } },
            ...mdRuns(child.text, { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING }),
          ], {
            x: bulletX(),
            y: y,
            w: bulletW,
            h,
            lineSpacingMultiple: style.lineSpacing,
          });
          y += h + style.gap;
        }
      }
      y += 0.08;

    } else if (item.type === "bullet") {
      const h = estimateTextHeight(item.text, bulletW, style.bodySize, style.lineSpacing);
      maybeAdvanceColumn(h);
      // Bullet item — green prefix + black text
      slide.addText([
        { text: BULLET_PREFIX, options: { fontFace: FONT_BOLD, fontSize: style.bodySize, color: BULLET_COLOR, charSpacing: CHAR_SPACING } },
        ...mdRuns(item.text, { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING }),
      ], {
        x: bulletX(),
        y: y,
        w: bulletW,
        h,
        lineSpacingMultiple: style.lineSpacing,
      });
      y += h + style.gap;

      // Children (numbered sub-items)
      if (item.children) {
        numberedCounter = 0;
        for (const child of item.children) {
          numberedCounter++;
          const numPrefix = `(${numberedCounter})  `;
          const text = numPrefix + cleanMd(child.text);
          const childH = estimateTextHeight(text, bulletW, style.bodySize, style.lineSpacing);
          maybeAdvanceColumn(childH);
          slide.addText([
            { text: numPrefix, options: { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING } },
            ...mdRuns(child.text, { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING }),
          ], {
            x: bulletX(),
            y: y,
            w: bulletW,
            h: childH,
            lineSpacingMultiple: style.lineSpacing,
          });
          y += childH + style.gap;
        }
      }

    } else if (item.type === "numbered") {
      numberedCounter++;
      const numPrefix = `(${numberedCounter})  `;
      const text = numPrefix + cleanMd(item.text);
      const h = estimateTextHeight(text, bulletW, style.bodySize, style.lineSpacing);
      maybeAdvanceColumn(h);
      slide.addText([
        { text: numPrefix, options: { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING } },
        ...mdRuns(item.text, { fontFace: FONT_MEDIUM, fontSize: style.bodySize, color: "000000", charSpacing: CHAR_SPACING }),
      ], {
        x: bulletX(),
        y: y,
        w: bulletW,
        h,
        lineSpacingMultiple: style.lineSpacing,
      });
      y += h + style.gap;

    } else if (item.type === "text") {
      const h = estimateTextHeight(item.text, bulletW, style.bodySize, style.lineSpacing);
      maybeAdvanceColumn(h);
      slide.addText(mdRuns(item.text, {
        fontFace: FONT_MEDIUM,
        fontSize: style.bodySize,
        color: "000000",
        charSpacing: CHAR_SPACING,
      }), {
        x: bulletX(),
        y: y,
        w: bulletW,
        h,
        lineSpacingMultiple: style.lineSpacing,
      });
      y += h + style.gap;
    }
  }

  return y;
}

/**
 * Add summary group content as individual shapes.
 * Uses narrow width (~4.3" for headers, ~4.1" for bullets).
 */
function addSummaryShapes(slide, content, region) {
  let y = region.y || 1.04;

  // Group heading
  if (content.heading) {
    slide.addText(mdRuns(content.heading, {
      fontFace: SEC_HEADER_FONT,
      fontSize: SEC_HEADER_SIZE,
      color: SEC_HEADER_COLOR,
      charSpacing: CHAR_SPACING,
    }), {
      x: region.x || 0.39,
      y: y,
      w: SUMMARY_HEADER_W,
      h: SEC_HEADER_H,
    });
    y += SEC_HEADER_H + 0.08;
  }

  // Items
  if (content.items) {
    for (const item of content.items) {
      if (item.type === "section") {
        // Section header
        slide.addText(mdRuns(item.heading, {
          fontFace: SEC_HEADER_FONT,
          fontSize: SEC_HEADER_SIZE,
          color: SEC_HEADER_COLOR,
          charSpacing: CHAR_SPACING,
        }), {
          x: region.x || 0.39,
          y: y,
          w: SUMMARY_HEADER_W,
          h: SEC_HEADER_H,
        });
        y += SEC_HEADER_H + 0.05;

        // Children as bullet items
        if (item.children) {
          for (const child of item.children) {
            slide.addText([
              { text: BULLET_PREFIX, options: { fontFace: FONT_BOLD, fontSize: SUMMARY_BULLET_SIZE, color: BULLET_COLOR, charSpacing: CHAR_SPACING } },
              ...mdRuns(child.text, { fontFace: FONT_MEDIUM, fontSize: SUMMARY_BULLET_SIZE, color: "000000", charSpacing: CHAR_SPACING }),
            ], {
              x: 0.59,
              y: y,
              w: SUMMARY_BULLET_W,
              h: SUMMARY_BULLET_H,
              lineSpacingMultiple: SUMMARY_BULLET_LINE_SPACING,
            });
            y += SUMMARY_BULLET_Y_SPACING;
          }
        }

      } else if (item.type === "bullet") {
        slide.addText([
          { text: BULLET_PREFIX, options: { fontFace: FONT_BOLD, fontSize: SUMMARY_BULLET_SIZE, color: BULLET_COLOR, charSpacing: CHAR_SPACING } },
          ...mdRuns(item.text, { fontFace: FONT_MEDIUM, fontSize: SUMMARY_BULLET_SIZE, color: "000000", charSpacing: CHAR_SPACING }),
        ], {
          x: 0.59,
          y: y,
          w: SUMMARY_BULLET_W,
          h: SUMMARY_BULLET_H,
          lineSpacingMultiple: SUMMARY_BULLET_LINE_SPACING,
        });
        y += SUMMARY_BULLET_Y_SPACING;

        if (item.children) {
          for (const child of item.children) {
            slide.addText([
              { text: BULLET_PREFIX, options: { fontFace: FONT_BOLD, fontSize: SUMMARY_BULLET_SIZE, color: BULLET_COLOR, charSpacing: CHAR_SPACING } },
              ...mdRuns(child.text, { fontFace: FONT_MEDIUM, fontSize: SUMMARY_BULLET_SIZE, color: "000000", charSpacing: CHAR_SPACING }),
            ], {
              x: 0.59,
              y: y,
              w: SUMMARY_BULLET_W,
              h: SUMMARY_BULLET_H,
              lineSpacingMultiple: SUMMARY_BULLET_LINE_SPACING,
            });
            y += SUMMARY_BULLET_Y_SPACING;
          }
        }

      } else if (item.type === "numbered") {
        slide.addText([
          { text: BULLET_PREFIX, options: { fontFace: FONT_BOLD, fontSize: SUMMARY_BULLET_SIZE, color: BULLET_COLOR, charSpacing: CHAR_SPACING } },
          ...mdRuns(item.text, { fontFace: FONT_MEDIUM, fontSize: SUMMARY_BULLET_SIZE, color: "000000", charSpacing: CHAR_SPACING }),
        ], {
          x: 0.59,
          y: y,
          w: SUMMARY_BULLET_W,
          h: SUMMARY_BULLET_H,
          lineSpacingMultiple: SUMMARY_BULLET_LINE_SPACING,
        });
        y += SUMMARY_BULLET_Y_SPACING;
      }
    }
  }
}

// ── TOC rendering (separate shapes per item) ─────────────────────────────

/**
 * Add TOC items as separate text shapes, matching TEMPLATE-PPTX.pptx exactly.
 * Each item is: "N.  text" in the bold face at 18pt, w=7.5, h=0.55, spaced 0.65" apart.
 */
function addTocShapes(slide, items) {
  let y = TOC_Y_START;
  let num = 1;

  for (const item of items) {
    const text = `${num}.  ${cleanMd(item.text || item.heading || "")}`;
    slide.addText(text, {
      x: TOC_X,
      y: y,
      w: TOC_W,
      h: TOC_H,
      fontFace: TOC_FONT,
      fontSize: TOC_SIZE,
      color: TOC_COLOR,
      charSpacing: CHAR_SPACING,
    });
    y += TOC_Y_SPACING;
    num++;
  }
}

/**
 * Check if a slide is a TOC slide by inspecting the title region content.
 */
function isTocSlide(regions) {
  const title = regions.title;
  if (!title || typeof title.content !== "string") return false;
  return title.content.includes("목차");
}

function adjustedRegionsForImageColumn(regions) {
  const body = regions.body;
  const image = regions.image;
  if (!body || !image || !body.content || !image.content) return regions;
  if (body.content.type !== "body" || !["image", "image-grid"].includes(image.content.type)) return regions;

  const bodyX = body.x || 0;
  const bodyW = body.w || 10.188;
  const imageX = image.x || 0;
  const gap = 0.25;
  if (imageX <= bodyX || imageX >= bodyX + bodyW) return regions;

  const denseImageGrid = image.content.type === "image-grid" && Array.isArray(image.content.images) && image.content.images.length >= 6;
  return {
    ...regions,
    body: {
      ...body,
      w: Math.max(0.5, imageX - bodyX - gap),
    },
    image: denseImageGrid ? {
      ...image,
      y: Math.min(image.y || 1.5, 1.08),
      h: Math.max(image.h || 3.0, 5.85),
    } : image,
    figure_caption: denseImageGrid && regions.figure_caption ? {
      ...regions.figure_caption,
      y: Math.max(regions.figure_caption.y || 4.55, 7.02),
    } : regions.figure_caption,
  };
}

// ── Region rendering ────────────────────────────────────────────────────────

/**
 * Add a region as a positioned element on the slide.
 *
 * Content types:
 *   - string:               title, main-box, notes
 *   - { type: "body" }      bullet/section/numbered items → individual shapes
 *   - { type: "kpi-table" } table with headers and rows
 *   - { type: "image" }     image element
 *   - { type: "figure-caption" } figure caption (auto-numbered "도 N.")
 *   - { type: "table-caption" }  table caption (auto-numbered "표 N.")
 *   - { type: "summary-group" }  heading + items → individual shapes
 */
function addRegion(slide, name, region, fontRoles, pageH, regionBottom, isToc, sourceDir) {
  if (!region) return;

  const content = region.content;
  if (content === undefined || content === null) return;
  if (typeof content === "object" && !content.type) return;

  const roleName = region.font_role || region.heading_role || region.sub_item_role;
  const role = fontRoles[roleName] || {};

  // ── String content (title, main-box, notes) ────────────────────────
  if (typeof content === "string") {
    const opts = {
      x: region.x || 0,
      y: region.y || 0,
      w: region.w || 4,
      h: region.h || ((regionBottom || (pageH - 0.5)) - (region.y || 0)),
      fontFace: role.font || FONT_BOLD,
      fontSize: role.size || 16,
      color: (role.color || "000000").replace("#", ""),
      align: region.align || role.align || "left",
      valign: region.valign || "top",
    };

    if (role.charSpacing != null) opts.charSpacing = role.charSpacing;
    if (role.lineSpacing) opts.lineSpacingMultiple = role.lineSpacing;

    // Border (main_box)
    if (region.border) {
      opts.line = {
        color: (region.border.color || "#000000").replace("#", ""),
        width: region.border.width || 1,
      };
    }

    // Autofit
    if (region.autofit === "resize") opts.autoFit = true;
    else if (region.autofit === "shrink") opts.shrinkText = true;

    slide.addText(mdRuns(content, {
      fontFace: opts.fontFace,
      fontSize: opts.fontSize,
      color: opts.color,
      ...(opts.charSpacing != null ? { charSpacing: opts.charSpacing } : {}),
    }), name === "title" ? { ...opts, objectName: "title@legacy" } : opts);
    return;
  }

  // ── Body content → TOC shapes or individual shapes ──────────────────
  if (content.type === "body") {
    if (isToc) {
      addTocShapes(slide, content.items || []);
    } else {
      const startY = region.y || 1.044;
      addBodyShapes(slide, content.items || [], startY, region.w || 10.188, regionBottom || pageH - 0.5, region.originX);
    }
    return;
  }

  // ── KPI Table ──────────────────────────────────────────────────────
  if (content.type === "kpi-table" && content.chart) {
    renderChart(slide, content, region, PLAIN_CHART_STYLE, regionBottom);
    return;
  }
  if (content.type === "kpi-table") {
    const numeric = numericColumns(content.headers || [], content.rows || []);
    const metrics = tableMetrics((content.rows || []).length + 1, region.y || 0, regionBottom,
      { rowH: 0.35, maxRowH: 0.55, headerSize: 14, dataSize: 14 });
    const headerRole = fontRoles[region.font_role_header] || fontRoles.table_header;
    const dataRole = fontRoles[region.font_role_data] || fontRoles.table_data;

    const tableData = [];

    if (content.headers && content.headers.length > 0) {
      tableData.push(
        content.headers.map((h) => ({
          text: cleanMd(h),
          options: {
            bold: false,
            fontSize: headerRole ? headerRole.size : 14,
            fontFace: headerRole ? headerRole.font : FONT_BOLD,
            color: headerRole ? headerRole.color : "000000",
            align: numeric[content.headers.indexOf(h)] ? "right" : (headerRole ? headerRole.align : "left"),
            valign: "middle",
            ...(headerRole && headerRole.charSpacing != null
              ? { charSpacing: headerRole.charSpacing }
              : {}),
            ...(headerRole && headerRole.fill
              ? { fill: { color: headerRole.fill.replace("#", "") } }
              : {}),
          },
        }))
      );
    }

    if (content.rows) {
      for (const row of content.rows) {
        tableData.push(
          row.map((cell, ci) => linkedTableCell(cell, {
              fontSize: dataRole ? dataRole.size : 14,
              fontFace: dataRole ? dataRole.font : FONT_MEDIUM,
              color: dataRole ? dataRole.color : "000000",
              align: numeric[ci] ? "right" : (dataRole ? dataRole.align : "left"),
              valign: "middle",
              ...(dataRole && dataRole.charSpacing != null
                ? { charSpacing: dataRole.charSpacing }
                : {}),
            }))
        );
      }
    }

    const numCols = (content.headers && content.headers.length) || 1;
    const tblX = region.x || 0;
    const tblY = region.y || 0;
    const tblW = region.w || 4;
    slide.addTable(tableData, {
      x: tblX,
      y: tblY,
      w: tblW,
      border: { pt: 1.5, color: "000000" },
      colW: numCols > 0 && content.headers ? proportionalWidths(content.headers, content.rows || [], tblW) : Array(numCols).fill(tblW / numCols),
      margin: [3.6, 7.2, 3.6, 7.2],
      rowH: metrics.rowH,
    });
    return;
  }

  // ── Image ──────────────────────────────────────────────────────────
  if (content.type === "image") {
    const imgPath = resolveImagePath(content.src, sourceDir);
    const fit = containBox(
      region.x || 0,
      region.y || 0,
      region.w || 2,
      region.h || 1,
      readImageSize(imgPath),
    );
    slide.addImage({
      path: imgPath,
      ...fit,
      altText: content.caption || path.basename(content.src || imgPath),
    });
    return;
  }

  if (content.type === "image-grid") {
    const images = Array.isArray(content.images) ? content.images : [];
    const count = images.length;
    if (count === 0) return;
    const cols = count <= 2 ? count : 2;
    const rows = Math.ceil(count / cols);
    const gap = 0.06;
    const baseX = region.x || 0;
    const baseY = region.y || 0;
    const baseW = region.w || 4;
    const baseH = region.h || 3;
    const cellW = (baseW - gap * (cols - 1)) / cols;
    const cellH = (baseH - gap * (rows - 1)) / rows;
    images.forEach((image, idx) => {
      const imgPath = resolveImagePath(image.src, sourceDir);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const fit = containBox(
        baseX + col * (cellW + gap),
        baseY + row * (cellH + gap),
        cellW,
        cellH,
        readImageSize(imgPath),
      );
      slide.addImage({
        path: imgPath,
        ...fit,
        altText: image.caption || path.basename(image.src || imgPath),
      });
    });
    return;
  }

  // ── Figure Caption ────────────────────────────────────────────────
  if (content.type === "figure-caption") {
    const num = content.number || 1;
    const prefix = content.prefix || "도";
    const captionText = content.caption ? `${prefix} ${num}. ${cleanMd(content.caption)}` : `${prefix} ${num}.`;
    const captionRole = fontRoles.figure_caption || {};
    const captionW = region.w || 4;
    const captionSize = captionRole.size || 16;
    const captionSpacing = captionRole.lineSpacing || 1.3;
    slide.addText(captionText, {
      x: region.x || 0,
      y: region.y || 0,
      w: captionW,
      // A caption that wraps needs a box tall enough to hold every line, or it
      // overflows its frame. The declared region height is the floor, not the cap.
      h: Math.max(
        region.h || 0.456,
        estimateTextHeight(captionText, captionW, captionSize, captionSpacing)
      ),
      fontFace: captionRole.font || FONT_MEDIUM,
      fontSize: captionSize,
      color: (captionRole.color || "000000").replace("#", ""),
      align: region.align || captionRole.align || "center",
      charSpacing: captionRole.charSpacing != null ? captionRole.charSpacing : CHAR_SPACING,
      lineSpacingMultiple: captionRole.lineSpacing || 1.3,
    });
    return;
  }

  // ── Table Caption ─────────────────────────────────────────────────
  if (content.type === "table-caption") {
    const num = content.number || 1;
    const prefix = content.prefix || "표";
    const captionText = content.caption ? `${prefix} ${num}. ${cleanMd(content.caption)}` : `${prefix} ${num}.`;
    const captionRole = fontRoles.table_caption || {};
    const captionW = region.w || 4;
    const captionSize = captionRole.size || 16;
    const captionSpacing = captionRole.lineSpacing || 1.3;
    slide.addText(captionText, {
      x: region.x || 0,
      y: region.y || 0,
      w: captionW,
      // Same rule as the figure caption: the declared region height is the
      // floor, not the cap, or a wrapping caption overflows its frame.
      h: Math.max(
        region.h || 0.456,
        estimateTextHeight(captionText, captionW, captionSize, captionSpacing)
      ),
      fontFace: captionRole.font || FONT_MEDIUM,
      fontSize: captionSize,
      color: (captionRole.color || "000000").replace("#", ""),
      align: region.align || captionRole.align || "center",
      charSpacing: captionRole.charSpacing != null ? captionRole.charSpacing : CHAR_SPACING,
      lineSpacingMultiple: captionRole.lineSpacing || 1.3,
    });
    return;
  }

  // ── Summary Group → individual shapes ──────────────────────────────
  if (content.type === "summary-group") {
    addSummaryShapes(slide, content, region);
    return;
  }
}

// ── Rich card, KPI and table rendering (templates with the rich-blocks capability) ──

/** Split a title string into runs, emphasizing **word** in the primary color. */
function azureTitleRuns(text, P) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) =>
    p.startsWith("**") && p.endsWith("**")
      ? { text: p.slice(2, -2), options: { color: hex(P.primary) } }
      : { text: p, options: {} }
  );
}

/** Strip leftover markdown markers (### heading, list dashes, **bold**, `code`)
 *  from inline text, returning a clean plain string. */
function cleanMd(s) {
  return String(s || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[*-]\s+/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<![\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/gu, "$1")
    .replace(/`/g, "")
    .trim();
}

/** Convert inline markdown in `text` to pptxgenjs styled runs: **x** → a bold
 *  run, plain segments → normal runs. Leading heading/list markers and backticks
 *  are stripped. `runOpts` styles every run; bold runs additionally set bold.
 *  Guarantees no raw "**", "###", or backtick reaches the rendered <a:t>. */
function mdRuns(text, runOpts = {}) {
  const clean = String(text || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[*-]\s+/, "")
    .replace(/`/g, "");
  // **x** is bold; *x* (a journal or book name) is italic.
  const parts = clean.split(/(\*\*[^*]+\*\*|(?<![\w*])\*[^*\s](?:[^*]*[^*\s])?\*(?![\w*]))/gu).filter((p) => p !== "");
  if (parts.length === 0) return [{ text: "", options: { ...runOpts } }];
  return parts.map((p) =>
    p.startsWith("**") && p.endsWith("**")
      ? { text: p.slice(2, -2), options: { ...runOpts, bold: true } }
      : p.length > 2 && p.startsWith("*") && p.endsWith("*")
        ? { text: p.slice(1, -1), options: { ...runOpts, italic: true } }
        : { text: p, options: { ...runOpts } }
  );
}

/** Convert body items into up to 4 cards: {heading, lines[]}.
 *  Handles both authoring styles:
 *   - `### Title` (parsed as `text`) followed by `- **point**` (a `section`) → one card
 *     titled by the heading, the section folded into the body.
 *   - bare `- **Title**` sections → one card each (heading = bold title). */
function bodyToCards(items) {
  const cards = [];
  let cur = null;
  for (const item of items || []) {
    if (item.type === "text" && item.text) {
      cur = { heading: cleanMd(item.text), lines: [] };
      cards.push(cur);
    } else if (item.type === "section" || item.type === "bullet") {
      const head = cleanMd(item.heading || item.text || "");
      const kids = (item.children || []).map((c) => cleanMd(c.text)).filter(Boolean);
      if (cur && cur.lines.length === 0 && cur.heading) {
        // fold this section under the preceding heading card
        if (head) cur.lines.push(head);
        kids.forEach((k) => cur.lines.push("  " + k));
      } else {
        cur = { heading: head, lines: kids };
        cards.push(cur);
      }
    } else if (item.type === "numbered" && item.text) {
      if (cur) cur.lines.push(cleanMd(item.text));
      else { cur = { heading: "", lines: [cleanMd(item.text)] }; cards.push(cur); }
    }
  }
  return cards.slice(0, 4);
}

// Card geometry shared by drawing and sizing, so a card is exactly as tall as its text
// (template tokens card.*; reassigned in render()).
let CARD_PAD = LEGACY_TOKENS.card.pad;
let CARD_CHIP = LEGACY_TOKENS.card.chip;
let CARD_MIN_H = LEGACY_TOKENS.card.minH;
let CARD_GAP = LEGACY_TOKENS.card.gap;
let CARD_RADIUS = LEGACY_TOKENS.card.radius;

// Primary reading text stays at or above the 12 pt floor of the design laws.
function cardBodySize(card) {
  return card.lines && card.lines.length > 4 ? 12 : 13;
}

// Card text height: the conservative wrap count, but line boxes at their real
// leading (estimateTextHeight pads every paragraph, which left short cards hollow).
function cardTextHeight(text, innerW, fontSize, lineSpacing) {
  return (estimateWrappedLines(text, innerW, fontSize) * fontSize * lineSpacing * 1.2) / 72;
}

function cardHeadingHeight(card, innerW) {
  return card.heading ? cardTextHeight(card.heading, innerW, 15, 1.05) + 0.06 : 0;
}

function cardBodyHeight(card, innerW) {
  if (card.bodyRuns && card.bodyRuns.length) return card.bodyHeight || 0;
  const fs = cardBodySize(card);
  return (card.lines || []).reduce((sum, line) => sum + cardTextHeight(line, innerW, fs, 1.3), 0.1);
}

/** Height a card needs for its chip, heading and body at the width it is drawn. */
function azureCardHeight(card, w) {
  const innerW = w - 2 * CARD_PAD;
  const head = card.heading ? 0.18 + Math.max(0.4, cardHeadingHeight(card, innerW)) + 0.04 : 0.18;
  return CARD_PAD + CARD_CHIP + head + cardBodyHeight(card, innerW) + CARD_PAD;
}

/**
 * The height a row of cards is drawn at: the tallest card's content, never taller
 * than the region the template reserves and never shorter than CARD_MIN_H. A fixed
 * region height left short cards mostly empty; the space below a short row is free
 * for the takeaway, and the craft gate reports a slide that stays thin.
 */
function fittedCardHeight(cards, w, regionH) {
  const need = Math.max(...cards.map((c) => azureCardHeight(c, w)));
  return Math.min(regionH, Math.max(CARD_MIN_H, need));
}

/** Draw one rounded card with a numbered chip, heading, and body lines. */
function drawAzureCard(slide, x, y, w, h, card, idx, P, emphasized) {
  const bg = emphasized ? hex(P.primary_deep) : hex(P.tint);
  const headColor = emphasized ? "FFFFFF" : hex(P.ink);
  const bodyColor = emphasized ? hex(P.emphasisTextColor) : hex(P.ink_muted);
  slide.addShape("roundRect", { x, y, w, h, rectRadius: CARD_RADIUS, fill: { color: bg }, line: { type: "none" } });
  const pad = CARD_PAD;
  const innerW = w - 2 * pad;
  // numbered chip
  const chip = CARD_CHIP;
  slide.addShape("roundRect", {
    x: x + pad, y: y + pad, w: chip, h: chip, rectRadius: 0.12,
    fill: { color: emphasized ? "FFFFFF" : hex(P.primary) }, line: { type: "none" },
  });
  // Number sits in a text box whose rect is identical to the chip rect, with
  // margin:0 and tight line spacing so the numeral reads dead-centre.
  slide.addText(String(idx + 1).padStart(2, "0"), {
    x: x + pad, y: y + pad, w: chip, h: chip, align: "center", valign: "middle",
    fontFace: P.titleFont, fontSize: 15, bold: true,
    color: emphasized ? hex(P.primary_deep) : "FFFFFF",
    margin: 0, lineSpacingMultiple: 1,
  });
  const headH = cardHeadingHeight(card, innerW);
  if (card.heading) {
    slide.addText(card.heading, {
      x: x + pad, y: y + pad + chip + 0.18, w: innerW, h: Math.max(0.4, headH),
      fontFace: P.titleFont, fontSize: 15, bold: true, color: headColor, align: "left", valign: "top",
      charSpacing: -0.3,
    });
  }
  const bodyY = y + pad + chip + 0.18 + (card.heading ? Math.max(0.4, headH) + 0.04 : 0);
  const bodyH = Math.max(0.3, h - (bodyY - y) - 0.18);
  if (card.bodyRuns && card.bodyRuns.length) {
    slide.addText(card.bodyRuns, {
      x: x + pad, y: bodyY, w: innerW, h: bodyH,
      color: bodyColor, align: "left", valign: "top", lineSpacingMultiple: card.lineSpacing || 1.28, charSpacing: -0.2,
    });
  } else if (card.lines && card.lines.length) {
    // Shrink body font when there are many lines so it never exceeds the frame.
    const fs = cardBodySize(card);
    slide.addText(card.lines.join("\n"), {
      x: x + pad, y: bodyY, w: innerW, h: bodyH,
      fontFace: P.bodyFont, fontSize: fs, color: bodyColor, align: "left", valign: "top",
      lineSpacingMultiple: 1.3, charSpacing: -0.2,
    });
  }
}

/** Render content/main body as a row of cards, as tall as the longest card needs. */
function renderAzureCards(slide, items, region, P) {
  const cards = bodyToCards(items);
  if (!cards.length) return;
  const n = cards.length;
  const x0 = region.x || 0.6, y0 = region.y || 1.6, w = region.w || 12.1;
  const gap = CARD_GAP;
  const cardW = (w - (n - 1) * gap) / n;
  const h = fittedCardHeight(cards, cardW, region.h || 3.0);
  cards.forEach((c, i) => {
    drawAzureCard(slide, x0 + i * (cardW + gap), y0, cardW, h, c, i, P, n >= 3 && i === n - 1);
  });
  return y0 + h;
}

/** Flatten body/summary items (sections + children + bullets) into styled runs.
 *  `scale` (≤1) shrinks fonts to fit a fixed card height. */
function itemsToRuns(items, P, scale = 1) {
  const s = (v) => Math.max(8, Math.round(v * scale * 10) / 10);
  const runs = [];
  for (const it of items || []) {
    if (it.type === "section") {
      runs.push({ text: cleanMd(it.heading || ""), options: { bold: true, fontFace: P.titleFont, fontSize: s(14), color: hex(P.ink), breakLine: true } });
      for (const c of it.children || []) {
        runs.push({ text: "  " + cleanMd(c.text || ""), options: { fontFace: P.bodyFont, fontSize: s(12.5), color: hex(P.ink_muted), breakLine: true } });
      }
    } else if (it.text) {
      runs.push({ text: (it.type === "numbered" ? "  " : "• ") + cleanMd(it.text), options: { fontFace: P.bodyFont, fontSize: s(13), color: hex(P.ink_muted), breakLine: true } });
    }
  }
  return runs;
}

/** Estimate the rendered height of a group's items at a given font scale,
 *  using the same conservative metric inventory respects (estimateTextHeight). */
function estimateGroupHeight(items, innerW, scale, lineSpacing) {
  let hsum = 0;
  for (const it of items || []) {
    if (it.type === "section") {
      hsum += estimateTextHeight(it.heading || "", innerW, 14 * scale, lineSpacing);
      for (const c of it.children || []) hsum += estimateTextHeight("  " + (c.text || ""), innerW - 0.1, 12.5 * scale, lineSpacing);
    } else if (it.text) {
      hsum += estimateTextHeight(it.text, innerW, 13 * scale, lineSpacing);
    }
  }
  return hsum;
}

/** The height a group's runs take at their real leading, for sizing (not fitting) the card. */
function groupTextHeight(items, innerW, scale, lineSpacing) {
  let hsum = 0.1;
  for (const it of items || []) {
    if (it.type === "section") {
      hsum += cardTextHeight(it.heading || "", innerW, 14 * scale, lineSpacing);
      for (const c of it.children || []) hsum += cardTextHeight("  " + (c.text || ""), innerW - 0.1, 12.5 * scale, lineSpacing);
    } else if (it.text) {
      hsum += cardTextHeight("• " + it.text, innerW, 13 * scale, lineSpacing);
    }
  }
  return hsum;
}

/** A summary group as a card: the largest font scale (1 down to 0.55) whose text fits
 *  `maxH`, and the height that text needs at that scale. */
function groupCard(content, w, maxH, P) {
  const innerW = w - 2 * CARD_PAD;
  const heading = cleanMd(content.heading || "");
  const headH = heading ? 0.18 + Math.max(0.4, cardHeadingHeight({ heading }, innerW)) + 0.04 : 0.18;
  const fixed = CARD_PAD + CARD_CHIP + headH + 0.18;
  let scale = 0.55, ls = 1.12;
  for (const s of [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6, 0.55]) {
    if (estimateGroupHeight(content.items, innerW, s, s < 1 ? 1.12 : 1.28) <= maxH - fixed) { scale = s; ls = s < 1 ? 1.12 : 1.28; break; }
  }
  const bodyHeight = groupTextHeight(content.items, innerW, scale, ls);
  return {
    card: { heading, bodyRuns: itemsToRuns(content.items, P, scale), lineSpacing: ls, bodyHeight },
    need: Math.min(maxH, fixed + bodyHeight + CARD_PAD - 0.18),
  };
}

/** Render a single summary-group as one card, at `opts.height` (shared by the
 *  groups of one slide) or at the height its own text needs. */
function renderAzureGroupCard(slide, content, region, P, idx, height) {
  const w = region.w || 5.6, maxH = region.h || 2.4;
  const { card, need } = groupCard(content, w, maxH, P);
  const h = Math.min(maxH, Math.max(CARD_MIN_H, height || need));
  drawAzureCard(slide, region.x || 0.6, region.y || 1.6, w, h, card, idx, P, false);
}

/** Render a general data table (palette-styled): primary header, zebra tint rows. */
// ── Tables and charts that fill their region ────────────────────────────────

// A cell reads as a number when, after units and signs, only digits remain.
const NUMERIC_CELL = /^(?:[▲▼△▽]\s*)?[+\-−±]?\s*[\d.,]+\s*(?:%p?|배|x|pt|bp|[가-힣]{1,3}|[A-Za-z]{1,3})?$/u;
const isNumericCell = (text) => NUMERIC_CELL.test(cleanMd(String(text)).trim());

/** Columns whose data cells are all numbers are right-aligned; a dash for a missing value is blank. */
function numericColumns(headers, rows) {
  return headers.map((_, ci) => {
    const cells = rows.map((r) => r[ci]).filter((c) => c != null && !/^[\s—–\-]*$/u.test(cleanMd(String(c))));
    return cells.length > 0 && cells.every(isNumericCell);
  });
}

/** Column widths proportional to the longest cell, Hangul counted wider, with a floor. */
function proportionalWidths(headers, rows, totalW) {
  const len = (t) => [...cleanMd(String(t || ""))].reduce((n, ch) => n + (/[\u3131-\uD7A3]/u.test(ch) ? 1.7 : 1), 0);
  const want = headers.map((h, ci) => Math.max(len(h), ...rows.map((r) => len(r[ci])), 4));
  const floor = Math.min(0.9, totalW / headers.length);
  const sum = want.reduce((a, b) => a + b, 0);
  let widths = want.map((w) => Math.max(floor, (w / sum) * totalW));
  const scale = totalW / widths.reduce((a, b) => a + b, 0);
  widths = widths.map((w) => w * scale);
  return widths;
}

/**
 * Row height and font size for a table that should use the room it has: rows
 * grow toward `bottom` (up to a comfortable maximum) instead of leaving the lower
 * half of the slide empty, and a roomy table gets a larger font.
 */
function tableMetrics(rowCount, y, bottom, base) {
  const room = Math.max(0, (bottom || y + rowCount * base.rowH) - y);
  const rowH = Math.min(base.maxRowH, Math.max(base.rowH, (room * 0.92) / rowCount));
  const scale = rowH >= 0.55 ? 1.2 : rowH >= 0.47 ? 1.1 : 1;
  return { rowH, headerSize: +(base.headerSize * scale).toFixed(1), dataSize: +(base.dataSize * scale).toFixed(1) };
}

function renderAzureTable(slide, content, region, P, bottom) {
  const headers = content.headers || [];
  const rows = content.rows || [];
  if (!headers.length) return;
  const x = region.x || 0.6, y = region.y || 1.6, w = region.w || 6.0;
  const numeric = numericColumns(headers, rows);
  const m = tableMetrics(rows.length + 1, y, bottom, { rowH: 0.4, maxRowH: 0.72, headerSize: 12, dataSize: 11.5 });
  const tableRows = [];
  tableRows.push(headers.map((h, ci) => ({
    text: cleanMd(h),
    options: { bold: true, color: "FFFFFF", fill: { color: hex(P.primary) }, fontFace: P.titleFont, fontSize: m.headerSize, align: numeric[ci] ? "right" : "left", valign: "middle" },
  })));
  rows.forEach((r, ri) => {
    tableRows.push(r.map((c, ci) => linkedTableCell(c, {
      color: hex(P.ink), fill: { color: ri % 2 ? "FFFFFF" : hex(P.tint) }, fontFace: P.bodyFont, fontSize: m.dataSize,
      align: numeric[ci] ? "right" : "left", valign: "middle", bold: ci === 0 && !numeric[0],
    })));
  });
  slide.addTable(tableRows, {
    x, y, w, colW: proportionalWidths(headers, rows, w),
    border: { type: "solid", color: hex(P.line), pt: 0.5 }, rowH: m.rowH, margin: [0.04, 0.12, 0.04, 0.12], autoPage: false,
  });
}

/** Parse "1,234", "▲12.5%", "−3" into a number; anything else is null. */
function chartNumber(text) {
  const t = cleanMd(String(text || "")).trim().replace(/[,\s]/g, "").replace(/^[▲△+]/u, "").replace(/^[▼▽−]/u, "-");
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

const CHART_TYPE = { bar: "bar", column: "bar", stacked: "bar", line: "line", area: "area", pie: "pie", doughnut: "doughnut" };

/**
 * A native PowerPoint chart (editable in PowerPoint: right-click > Edit Data)
 * from a `::: chart` block. It takes the whole region down to `bottom`.
 */
function renderChart(slide, content, region, style, bottom) {
  const headers = content.headers || [];
  const rows = content.rows || [];
  const spec = content.chart || {};
  const kind = CHART_TYPE[spec.type] || "bar";
  const labels = rows.map((r) => cleanMd(String(r[0] || "")));
  const series = headers.slice(1).map((name, si) => ({
    name: cleanMd(String(name)),
    labels,
    // A missing cell stays null: pptxgenjs writes it as a blank point, and the line breaks there instead of dropping to zero.
    values: rows.map((r) => chartNumber(r[si + 1])),
  }));
  // Data labels keep the decimals the table writes: "18.0" stays 18.0 beside a table that says 18.0.
  const decimals = Math.min(3, Math.max(0, ...rows.flatMap((r) => r.slice(1).map((v) => ((/\.(\d+)/u.exec(cleanMd(String(v == null ? "" : v)).replace(/,/gu, "")) || [, ""])[1]).length))));
  const x = region.x || 0.6, y = region.y || 1.6, w = region.w || 8;
  const h = Math.max(1.6, ((bottom || y + (region.h || 3.2)) - y));
  const colors = style.series.map((c) => hex(c));
  const round = kind === "pie" || kind === "doughnut";
  const data = round ? series.slice(0, 1) : series;
  // Crowding, estimated in points: a category label wider than its slot is slanted; side-by-side
  // value labels wider than their bars collide, so the values are read off a shown axis instead.
  const ems = (t) => [...String(t)].reduce((a, ch) => a + (/[\u3131-\uD7A3]/u.test(ch) ? 0.94 : /\s/u.test(ch) ? 0.28 : 0.56), 0);
  const labelPt = style.labelSize || 11;
  const slot = (w * 72 * 0.85) / Math.max(1, labels.length);
  // A renderer adds space between Hangul and digits ("25 년 2Q"), so a label needs a quarter of its slot spare.
  // A horizontal bar chart lists its categories down the left side; slanted there, LibreOffice skips some of them.
  const slanted = !round && kind !== "line" && spec.type !== "bar" && Math.max(0, ...labels.map(ems)) * labelPt > slot * 0.75;
  const clustered = kind === "bar" && spec.type !== "stacked" && data.length > 1;
  const valueW = Math.max(0, ...data.flatMap((d) => d.values.map((v) => ems(Number(v).toLocaleString("en-US"))))) * labelPt;
  // Several lines share one band of the plot, so a value printed over each point lands on its neighbours'.
  const crowded = !round && ((clustered && valueW > (slot / 1.6 / data.length) * 1.1) || (kind === "line" && data.length > 1));
  const values = data.flatMap((d) => d.values).filter((v) => v !== null);
  // Horizontal bars of several series stack thin bars down each row; once a bar is thinner than its value label, the labels touch.
  const horizontal = !round && spec.type === "bar";
  const dataPt = style.labelSize || (round ? 12 : 10);
  const barPt = (h * 72 - 54) / Math.max(1, labels.length) / (data.length + 0.6);
  const thin = horizontal && data.length > 1 && spec.labels !== false && barPt < dataPt * 1.2;
  // A narrow horizontal bar chart gets few axis numbers, each with room to stand level; left to itself, LibreOffice slants a crowded value axis.
  const top = Math.max(0, ...values), low = Math.min(0, ...values);
  const tickW = ems(Math.round(Math.max(top, -low)).toLocaleString("en-US")) * dataPt;
  const catW = Math.min(w * 72 * 0.4, Math.max(0, ...labels.map(ems)) * labelPt + 8);
  const ticks = Math.floor((w * 72 - catW - 16) / (tickW * 2));
  const nice = (step) => { const p = 10 ** Math.floor(Math.log10(step)); return [1, 2, 2.5, 5, 10].find((m) => m * p >= step) * p; };
  const majorUnit = horizontal && top > low && ticks < 6 ? nice((top - low) / Math.max(1, ticks - 1)) : null;
  const zeroBased = !round && values.length > 0 && values.every((v) => v >= 0);
  // The unit stands once: a legend whose series names carry it already says it, so the axis title goes;
  // otherwise it is set level (a rotated title stacks Hangul a glyph a line and reads tiny; 360 degrees, since
  // pptxgenjs writes no angle for 0 and the axis default is vertical). Amendments 8.
  const unitShown = spec.unit && data.length > 1 && data.every((d) => String(d.name || "").includes(spec.unit));
  const axisTitle = spec.unit && !unitShown && !(Boolean(style.valAxisHidden) && !crowded && !thin);
  slide.addChart(kind, data, {
    x, y, w, h,
    barDir: spec.type === "bar" ? "bar" : "col",
    barGrouping: spec.type === "stacked" ? "stacked" : "clustered",
    barGapWidthPct: 60,
    chartColors: round ? labels.map((_, i) => colors[i % colors.length]) : colors,
    showLegend: round || data.length > 1,
    legendPos: round ? "r" : "t",
    legendFontFace: style.bodyFont, legendFontSize: 11, legendColor: hex(style.ink),
    showValue: !round && spec.labels !== false && !crowded && !thin,
    showPercent: round && spec.labels !== false, showLabel: false,
    dataLabelFontFace: style.bodyFont, dataLabelFontSize: style.labelSize || (round ? 12 : 10),
    dataLabelColor: round ? "FFFFFF" : hex(style.ink),
    dataLabelPosition: round ? "ctr" : kind === "line" ? "t" : "outEnd",
    dataLabelFormatCode: round ? "0%" : decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0",
    catAxisLabelFontFace: style.bodyFont, catAxisLabelFontSize: style.labelSize || 11, catAxisLabelColor: hex(style.ink),
    valAxisLabelFontFace: style.bodyFont, valAxisLabelFontSize: style.labelSize || 10, valAxisLabelColor: hex(style.ink_muted),
    valAxisLabelFormatCode: "#,##0",
    // A pack with direct labels and no gridlines drops the value axis: the labels carry the values.
    valAxisHidden: Boolean(style.valAxisHidden) && !crowded && !thin,
    ...(majorUnit ? { valAxisMajorUnit: majorUnit } : {}),
    // With negative values the zero line runs through the plot, so the category labels move to the axis minimum, off the bars.
    ...(horizontal && low < 0 ? { catAxisLabelPos: "low" } : {}),
    // Blank points leave a gap, never a joined or zero point.
    displayBlanksAs: "gap",
    ...(style.valMax ? { valAxisMaxVal: style.valMax } : {}),
    ...(zeroBased ? { valAxisMinVal: 0 } : {}),
    ...(slanted ? { catAxisLabelRotate: -45 } : {}),
    catAxisLineShow: true, catAxisLineColor: hex(style.line),
    valGridLine: style.grid === false && !crowded && !thin ? { style: "none" } : { color: hex(style.line), size: 0.5 },
    valAxisLineShow: false,
    lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
    holeSize: 58,
    ...(axisTitle ? { showValAxisTitle: true, valAxisTitle: spec.unit, valAxisTitleRotate: 360, valAxisTitleFontSize: style.labelSize || 10, valAxisTitleColor: hex(style.ink_muted), valAxisTitleFontFace: style.bodyFont } : {}),
    ...(spec.title ? { showTitle: true, title: spec.title, titleFontFace: style.titleFont, titleFontSize: 13, titleColor: hex(style.ink) } : {}),
  });
}

/** A main-box as a tinted callout sized to its text, not an outlined frame. */
function renderAzureCallout(slide, text, region, P) {
  const x = region.x || 0.84, y = region.y || 5.8, w = region.w || 11.6;
  const lines = Math.max(1, Math.ceil(cleanMd(text).length / Math.max(20, w * 9)));
  const h = Math.min(region.h || 1.0, 0.28 + lines * 0.3);
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.1, fill: { color: hex(P.tint) }, line: { type: "none" } });
  slide.addText(cleanMd(text), {
    x: x + 0.24, y, w: w - 0.48, h, fontFace: P.bodyFont, fontSize: 13, bold: true,
    color: hex(P.primary_deep), align: "left", valign: "middle", margin: 0,
  });
}

/** Render a kpi-table as a row of KPI cards (value + label); first card filled. */
function renderAzureKpi(slide, content, region, P) {
  const cards = kpiCards(content);
  const values = cards.map((c) => c.value);
  const labels = cards.map((c) => c.label);
  const n = Math.min(values.length, 4);
  if (!n) return;
  const x0 = region.x || 0.6, y0 = region.y || 1.6, w = region.w || 12.1, h = region.h || 1.7;
  const gap = KPI_GAP;
  const cardW = (w - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const fill = i === 0;
    const x = x0 + i * (cardW + gap);
    slide.addShape("roundRect", {
      x, y: y0, w: cardW, h, rectRadius: 0.16,
      fill: { color: fill ? hex(P.primary) : "FFFFFF" },
      line: fill ? { type: "none" } : { color: hex(P.line), width: 1 },
    });
    slide.addText(cleanMd(values[i]), {
      x: x + 0.28, y: y0 + 0.20, w: cardW - 0.56, h: 0.8,
      fontFace: P.titleFont, fontSize: 30, bold: true,
      color: fill ? "FFFFFF" : hex(P.primary), align: "left", valign: "middle", charSpacing: -1, margin: 0,
    });
    slide.addText(cleanMd(labels[i]).toUpperCase(), {
      x: x + 0.30, y: y0 + h - 0.5, w: cardW - 0.56, h: 0.32,
      fontFace: P.bodyFont, fontSize: 9.5, bold: false,
      color: fill ? hex(P.emphasisTextColor) : hex(P.ink_muted), align: "left", valign: "middle", charSpacing: 0.4, margin: 0,
    });
  }
}

/** A pipe table reads as KPI in two shapes:
 *   - TALL: 2 cols of value|label pairs, ≤4 pairs, value cell short/metric-like.
 *   - WIDE: 3–4 cols, a single data row of short metric values (labels = header).
 *  Anything else (multi-row, long cells) is a real data table. */


/** Normalize a kpi-table into [{value,label}] cards for both KPI shapes. */
/**
 * Is there room to draw this as KPI badges?
 *
 * A badge stacks a value over a label and reads as one glance, which stops
 * working the moment the card is narrower than its own words: in a column half
 * the slide wide, four badges leave 1.4in each and a label like "영업이익" wraps
 * to one character per line. Below the floor the same data is drawn as a table,
 * which narrows gracefully.
 */
function kpiFits(content, widthIn) {
  const cards = kpiCards(content).length;
  return cards > 0 && (widthIn || 0) / cards >= KPI_MIN_CARD_WIDTH_IN;
}

function kpiCards(content) {
  const headers = content.headers || [];
  const rows = content.rows || [];
  if (headers.length === 2) {
    return [headers, ...rows].slice(0, 4).map((p) => ({ value: p[0], label: p[1] }));
  }
  const row = rows[0] || [];
  // A second body row is each figure's basis or comparison ("전년 대비 +12%", "목표 50%").
  const basis = rows[1] || [];
  return headers.slice(0, 6).map((lab, i) => ({ value: row[i] != null ? row[i] : "", label: lab, ...(basis[i] ? { note: basis[i] } : {}) }));
}

/** Azure region dispatch. Returns true if it fully handled the region.
 *  opts.hasImage = slide also has a populated image region (→ never card the body). */
function renderAzureRegion(slide, layout, name, region, fontRoles, P, opts = {}) {
  const content = region.content;
  if (content == null) return false;
  if (name === "main_box" && typeof content === "string" && content.trim()) {
    // Below a card row that came out shorter than its region, the takeaway follows
    // the cards instead of leaving a band of empty slide between them.
    const follow = opts.flow && opts.flow.cardsBottom != null ? opts.flow.cardsBottom + 0.32 : null;
    renderAzureCallout(slide, content, follow != null && follow < (region.y || 5.8) ? { ...region, y: follow } : region, P);
    return true;
  }
  if (layout === "cover" && name === "title" && typeof content === "string" && content.includes("**")) {
    const role = fontRoles.cover_title || {};
    slide.addText(azureTitleRuns(content, P), {
      objectName: "title@legacy",
      x: region.x || 0, y: region.y || 0, w: region.w || 8, h: region.h || 1,
      fontFace: role.font || P.titleFont, fontSize: role.size || 48, bold: role.bold !== false,
      align: role.align || "left", valign: "middle",
      charSpacing: role.charSpacing != null ? role.charSpacing : -1, lineSpacingMultiple: role.lineSpacing || 1.08,
    });
    return true;
  }
  if (typeof content === "object") {
    if (content.type === "body" && (layout === "content" || layout === "main")) {
      // Cards ONLY for section-structured bodies (≥2 ### sections) with no image.
      // Prose bullets, or any body sharing the slide with an image, render as a
      // normal text column (fall through to addRegion) so nothing is cramped.
      const sections = (content.items || []).filter((i) => i.type === "section");
      if (sections.length >= 2 && !opts.hasImage) {
        const bottom = renderAzureCards(slide, content.items, region, P);
        if (opts.flow) opts.flow.cardsBottom = bottom;
        return true;
      }
      return false;
    }
    if (content.type === "kpi-table") {
      if (content.chart) {
        // Pie and doughnut slices carry white labels, so they use the darker tones only.
        const round = ["pie", "doughnut"].includes(content.chart.type);
        const series = round ? [P.primary, P.primary_deep, P.azure, P.ink_muted] : [P.primary, P.azure_soft, P.primary_deep, P.ink_muted];
        renderChart(slide, content, region, { ...P, series }, opts.bottom);
      }
      else if (looksLikeKpi(content) && kpiFits(content, region.w)) {
        renderAzureKpi(slide, content, region, P);
      }
      else renderAzureTable(slide, content, region, P, opts.bottom);
      return true;
    }
    if (content.type === "summary-group") {
      const idx = name === "group_bottom" ? 1 : 0;
      renderAzureGroupCard(slide, content, region, P, idx, opts.groupHeight);
      return true;
    }
  }
  return false;
}

// ── Placements (author-positioned boxes and shapes) ─────────────────────────

/** Region name a placed block should be rendered as. */
function partRegionName(blockType) {
  switch (blockType) {
    case "title": return "title";
    case "kpi-table": return "table";
    case "image": return "image";
    case "figure-caption": return "figure_caption";
    case "table-caption": return "table_caption";
    default: return "body";
  }
}

/** font_role a placed block falls back to when its box names none. */
function defaultPartRole(blockType) {
  switch (blockType) {
    case "title": return "section_title";
    case "figure-caption": return "figure_caption";
    case "table-caption": return "table_caption";
    case "notes": return "disclaimer";
    default: return "body_text";
  }
}

function estimatePartHeight(content, widthIn, role) {
  const size = role.size || 13;
  const spacing = role.lineSpacing || 1.3;
  if (typeof content === "string") {
    return estimateTextHeight(content, widthIn, size, spacing) + 0.08;
  }
  if (content && content.type === "body") {
    const text = (content.items || []).map((i) => i.heading || i.text || "").join("\n");
    return estimateTextHeight(text, widthIn, size, spacing) + 0.12;
  }
  return 0.5;
}

/**
 * Turn a shape placement into the decoration element addDecorations reads.
 *
 * A rule is drawn as a zero-height rect whose stroke is the visible mark, so it
 * reads its colour and thickness from `color`/`width` while every other
 * primitive reads `line`/`line_width`. Authors write one spelling — `line=` and
 * `lw=` — and the difference is absorbed here.
 */
function shapeToDecoration(placement, sourceDir) {
  const isRule = placement.shape === "line";
  const element = {
    type: placement.shape,
    x: placement.x, y: placement.y, w: placement.w, h: placement.h,
  };
  for (const [key, value] of Object.entries(placement)) {
    if (["kind", "z", "shape", "x", "y", "w", "h"].includes(key)) continue;
    if (key === "lw") element[isRule ? "width" : "line_width"] = value;
    else if (key === "line" && isRule) element.color = value;
    else if (key === "src") element.assetPath = resolveImagePath(value, sourceDir);
    else element[key] = value;
  }
  return element;
}

/**
 * Render one placed box by flowing its blocks down the box.
 *
 * Every block but the last takes the height its content needs; the last takes
 * whatever is left, so a heading followed by body fills the box rather than
 * floating in its top edge. Nothing here consults the auto-nudge rules: a box
 * lands exactly where the author put it, and the QA gate reports the consequence.
 */
function renderPlacementBox(slide, placement, ctx) {
  const blocks = placement.blocks || [];
  if (blocks.length === 0) return;

  // Columns replace the body region, so they render in the template's own idiom.
  // An explicit box is literal: the author asked for this content, here.
  const useRich = ctx.rich && placement.z === "content";
  const bottom = placement.y + (placement.h != null ? placement.h : 1.0);
  let y = placement.y;

  blocks.forEach((block, i) => {
    const remaining = Math.max(0.2, bottom - y);
    const roleName = placement.role || defaultPartRole(block.type);
    const role = ctx.fontRoles[roleName] || {};
    const content = extractContent(block);
    const isLast = i === blocks.length - 1;
    const h = isLast
      ? remaining
      : Math.min(remaining, Math.max(0.2, estimatePartHeight(content, placement.w, role)));

    const region = {
      x: placement.x, y, w: placement.w, h,
      content,
      font_role: roleName,
      originX: placement.x,
      ...(placement.align ? { align: placement.align } : {}),
      ...(placement.valign ? { valign: placement.valign } : {}),
    };

    const name = partRegionName(block.type);
    const rendered = useRich &&
      renderAzureRegion(slide, ctx.layout, name, region, ctx.fontRoles, ctx.P, {});
    if (!rendered) {
      addRegion(slide, name, region, ctx.fontRoles, ctx.pageH, y + h, false, ctx.sourceDir);
    }
    y += h;
  });
}

function renderPlacements(slide, placements, band, ctx) {
  for (const placement of placements) {
    if (placement.z !== band) continue;
    if (placement.kind === "shape") {
      addDecorations(slide, [shapeToDecoration(placement, ctx.sourceDir)], ctx.fontRoles);
    } else {
      renderPlacementBox(slide, placement, ctx);
    }
  }
}

// ── Main render function ────────────────────────────────────────────────────

/**
 * Render the full resolved spec to a PPTX file.
 *
 * @param {object} resolved - Resolved spec from layout-resolver
 * @param {object} templateObj - Template object from template-registry
 * @param {string} outputPath - Where to write the .pptx file
 * @returns {Promise<string>} Resolves with the output path
 */
/**
 * The deck-wide `notice:` (for example "예시 데이터 — 실제 수치로 바꿔 주세요") as a
 * coloured tag at the bottom left of every slide, cover included, so a sample or
 * draft deck can never be mistaken for a sourced one. A 9 pt grey footnote was easy
 * to miss; the tag keeps its own fill and text colour (template palette
 * `notice_fill` / `notice_ink`, default a light red with dark red text, 6:1).
 */
const NOTICE_FILL = "FDECEA";
const NOTICE_INK = "A21B12";
let NOTICE = { ...LEGACY_TOKENS.notice };

function addNotice(slide, text, pageW, pageH, pal) {
  const label = cleanMd(text);
  const fontSize = NOTICE.size;
  const textW = (weightedTextLength(label) * fontSize * 0.98) / 72;
  const w = Math.min(pageW * 0.55, textW + 0.46);
  const h = NOTICE.h;
  const x = NOTICE.x, y = pageH - h - NOTICE.bottom;
  const fill = ((pal && pal.notice_fill) || NOTICE_FILL).replace("#", "");
  const ink = ((pal && pal.notice_ink) || NOTICE_INK).replace("#", "");
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.15, fill: { color: fill }, line: { type: "none" }, objectName: "lit-notice tag" });
  slide.addText(label, {
    objectName: "lit-notice text",
    x: x + 0.16, y, w: w - 0.32, h,
    fontFace: FONT_BOLD, fontSize, bold: true, color: ink,
    align: "left", valign: "middle", margin: 0, fit: "shrink",
  });
}

/**
 * Give the first object drawn on a slide that has no name of its own the name `family@<id>`, so a
 * checker can read the layout family the source asked for and compare it with what it measures.
 */
function stampFamily(slide, family) {
  const at = { addText: 1, addShape: 1, addImage: 0, addTable: 1, addChart: 2 };
  const originals = {};
  let done = false;
  const restore = () => { for (const m of Object.keys(originals)) slide[m] = originals[m]; };
  for (const [method, index] of Object.entries(at)) {
    originals[method] = slide[method];
    slide[method] = (...args) => {
      if (!(args[index] && args[index].objectName)) {
        restore();
        done = true;
        args[index] = { ...(args[index] || {}), objectName: `family@${family}` };
      }
      return originals[method].apply(slide, args);
    };
  }
  /** Whether a shape took the name; unwraps the slide either way. */
  return () => { restore(); return done; };
}

async function render(resolved, templateObj, outputPath) {
  const pack = (templateObj && templateObj.pack) || null;
  if (pack && !pack.legacy) return require("./render-pack").renderPack(resolved, templateObj, outputPath);
  applyTokens(pack && pack.tokens);
  const fontRoles = buildFontRoles(templateObj);

  // Brand-neutralize: derive font/spacing/accent from the template, falling back
  // to Pretendard when a template names no family.
  const tpl = (templateObj && templateObj.template) || {};
  const tplFonts = tpl.fonts || {};
  const tplType = tpl.global_typography || {};
  FONT_BOLD = tplFonts.title || "Pretendard";
  FONT_MEDIUM = tplFonts.body || "Pretendard";
  FONT_LIGHT = tplFonts.light || "Pretendard";
  CHAR_SPACING = tplType.char_spacing != null ? tplType.char_spacing : -0.7;
  SEC_HEADER_FONT = FONT_BOLD;
  TOC_FONT = FONT_BOLD;
  BULLET_COLOR = (tplType.bullet_color || "1D4ED8").replace("#", "");
  SECTION_ACCENT = (tplType.section_accent || "1D4ED8").replace("#", "");

  // Rich card/KPI/divider rendering — palette-driven, for templates with the rich-blocks
  // capability. Tokens come from the template palette.
  const rich = Boolean(pack && (pack.capabilities || []).includes("rich-blocks"));
  const pal = tpl.palette || {};
  PLAIN_CHART_STYLE = {
    series: [pal.ink || "#3C3836", pal.accent_green_2 || pal.primary || "#689D6A", pal.accent_amber || "#D79921", pal.accent_purple || "#B16286"],
    ink: pal.ink || "#3C3836", ink_muted: pal.ink_muted || "#6E6256", line: pal.line || "#CBC2B5",
    titleFont: FONT_BOLD, bodyFont: FONT_MEDIUM,
  };
  const P = {
    titleFont: FONT_BOLD, bodyFont: FONT_MEDIUM,
    primary: pal.primary || "#1D4ED8", primary_deep: pal.primary_deep || "#0B2E6F",
    ink: pal.ink || "#0E1B2C", ink_muted: pal.ink_muted || "#51607A",
    tint: pal.tint || "#EEF4FF", line: pal.line || "#D5DEEC", azure_soft: pal.azure_soft || "#93C5FD", azure: pal.azure || "#3B82F6",
    emphasisTextColor: pal.emphasis_text || "#C9D8F5",
  };

  const dims =
    (templateObj && templateObj.template && templateObj.template.dimensions) || {};
  const pageW = dims.width || 10.833;
  const pageH = dims.height || 7.5;

  // Loaded here, not at module load, so AST-only and --list-* runs never install.
  const PptxGenJS = runtimeRequire("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_LANDSCAPE", width: pageW, height: pageH });
  pptx.layout = "A4_LANDSCAPE";

  const title = (resolved.deck && resolved.deck.title) || "Presentation";
  pptx.title = title;
  const sourceDir = resolved.sourceDir;
  const cramStress = isCramStressDeck(resolved);
  const deckMeta = (resolved.deck && resolved.deck.metadata) || {};
  const notice = typeof deckMeta.notice === "string" && deckMeta.notice.trim() ? deckMeta.notice.trim() : null;

  for (const slideSpec of resolved.slides || []) {
    const slide = pptx.addSlide();
    stampFamily(slide, slideSpec.family || slideSpec.layout);

    // Draw order is a band at a time: template decorations, then anything the
    // author put under the content, then the template's regions, then the
    // columns that replaced the body, then anything sitting on top.
    addDecorations(slide, slideSpec.decorations, fontRoles);

    const placements = slideSpec.placements || [];
    const placementCtx = {
      rich, P, fontRoles, pageH, sourceDir,
      layout: slideSpec.layout,
    };
    renderPlacements(slide, placements, "under", placementCtx);

    const regions = adjustedRegionsForImageColumn(slideSpec.regions || {});
    if (cramStress && ["content", "main"].includes(slideSpec.layout) && regions.body) {
      renderCramStressSlide(slide, { ...slideSpec, regions }, pageW, pageH, sourceDir);
      continue;
    }

    // Calculate bottom boundary for regions without explicit h
    const bottomBoundary = {};
    for (const [name, region] of Object.entries(regions)) {
      let bottom = pageH - 0.5;
      for (const [otherName, otherRegion] of Object.entries(regions)) {
        if (otherName === name || otherName === "title") continue;
        if (name === "body" && ["image", "figure_caption"].includes(otherName)) continue;
        if (otherRegion.y && otherRegion.y > (region.y || 0) && otherRegion.h) {
          const candidateBottom = otherRegion.y - 0.15;
          if (candidateBottom < bottom) bottom = candidateBottom;
        }
      }
      bottomBoundary[name] = bottom;
    }

    const tocSlide = isTocSlide(regions);
    const hasImage = Object.entries(regions).some(([n, r]) =>
      (n === "image" || n === "figure") && r.content &&
      (r.content.type === "image" || r.content.type === "image-grid"));

    // Summary groups sit side by side, so they share the height the fuller one needs.
    const groups = Object.values(regions).filter((r) => r.content && r.content.type === "summary-group");
    const groupHeight = rich && groups.length
      ? Math.max(...groups.map((r) => groupCard(r.content, r.w || 5.6, r.h || 2.4, P).need))
      : null;

    const flow = {};
    for (const [name, region] of Object.entries(regions)) {
      if (rich && renderAzureRegion(slide, slideSpec.layout, name, region, fontRoles, P, { hasImage, bottom: bottomBoundary[name], groupHeight, flow })) continue;
      addRegion(slide, name, region, fontRoles, pageH, bottomBoundary[name], tocSlide, sourceDir);
    }

    renderPlacements(slide, placements, "content", placementCtx);
    renderPlacements(slide, placements, "over", placementCtx);
    if (notice) addNotice(slide, notice, pageW, pageH, pal);
  }

  await writeTagged(pptx, outputPath);
  return outputPath;
}

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/u;

/**
 * Korean text runs carry their language: pptxgenjs writes lang="en-US" on every run, and a renderer then
 * applies Latin rules to Hangul (LibreOffice on a host whose system locale is not Korean adds space
 * between Hangul and digits: "주 2일" set as "주  2 일"). A run that holds Hangul is ko-KR with en-US as its
 * alternate language; a chart that holds Hangul names ko-KR for its text. Latin-only runs keep en-US.
 */
function tagLanguages(name, xml) {
  if (/^ppt\/slides\/slide\d+\.xml$/u.test(name)) {
    return xml.replace(/<a:r><a:rPr\b([^>]*?)(\/?>)([\s\S]*?)<a:t>([^<]*)<\/a:t><\/a:r>/gu, (m, attrs, close, mid, text) => {
      if (!HANGUL.test(text)) return m;
      const rest = attrs.replace(/\s(?:lang|altLang)="[^"]*"/gu, "");
      return `<a:r><a:rPr lang="ko-KR" altLang="en-US"${rest}${close}${mid}<a:t>${text}</a:t></a:r>`;
    });
  }
  if (/^ppt\/charts\/chart\d+\.xml$/u.test(name) && HANGUL.test(xml)) {
    let out = xml.replace(/<a:defRPr\b(?![^>]*\blang=)/gu, '<a:defRPr lang="ko-KR" altLang="en-US"')
      .replace(/<a:endParaRPr lang="en-US"/gu, '<a:endParaRPr lang="ko-KR" altLang="en-US"');
    if (!/<c:lang\b/u.test(out)) out = out.replace(/(<c:date1904 val="[01]"\/>)/u, '$1<c:lang val="ko-KR"/>');
    return out;
  }
  return xml;
}

/** Write a deck with its Korean runs and charts tagged (see tagLanguages); `edit` may rewrite a part first. */
async function writeTagged(pptx, outputPath, edit = (name, xml) => xml) {
  const JSZip = runtimeRequire("jszip");
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: "nodebuffer" }));
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/(slides\/slide|charts\/chart|theme\/theme)\d+\.xml$/u.test(n))) {
    const xml = await zip.file(name).async("string");
    zip.file(name, tagLanguages(name, edit(name, xml)));
  }
  fs.writeFileSync(outputPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ── Tonality packs ──────────────────────────────────────────────────────────
//
// A pack deck is drawn by render-pack.js. It reuses the helpers below, and the font globals the
// free placement boxes read are switched to the pack's faces before it draws.

function usePackFonts(titleFont, bodyFont, tokens) {
  FONT_BOLD = titleFont;
  FONT_MEDIUM = bodyFont;
  FONT_LIGHT = bodyFont;
  CHAR_SPACING = 0;
  applyTokens(tokens);
}

module.exports = {
  render,
  shared: {
    hex, cleanMd, mdRuns, linkedTableCell, resolveImagePath, readImageSize, containBox,
    kpiCards, numericColumns, proportionalWidths, renderChart, stampFamily, renderPlacements, usePackFonts, writeTagged,
  },
};

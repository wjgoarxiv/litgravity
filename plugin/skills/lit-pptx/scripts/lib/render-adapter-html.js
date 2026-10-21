"use strict";

const fs = require("fs");
const path = require("path");

/**
 * render-adapter-html.js — Render a resolved slide spec to an HTML string.
 *
 * Input: resolved spec from layout-resolver, plus templateObj from registry.
 * Output: self-contained HTML document with inline CSS.
 */

const REPO_ROOT = path.resolve(__dirname, "../..");
const A2Z_WEIGHTS = ["Thin", "ExtraLight", "Light", "Regular", "Medium", "SemiBold", "Bold", "ExtraBold", "Black"];

/** Map a font-family name to bundled OTF file(s): [{path, weight}]. */
function bundledFontFiles(family) {
  const f = (family || "").trim();
  if (f === "Pretendard") {
    return [
      { file: "fonts/pretendard/Pretendard-Regular.otf", weight: 400 },
      { file: "fonts/pretendard/Pretendard-Bold.otf", weight: 700 },
    ]
      .map((e) => ({ ...e, abs: path.join(REPO_ROOT, e.file) }))
      .filter((e) => fs.existsSync(e.abs));
  }
  const last = f.split(/\s+/).pop();
  if ((f.includes("에이투지체") || f.startsWith("A2Z")) && A2Z_WEIGHTS.includes(last)) {
    const abs = path.join(REPO_ROOT, "fonts", "a2z", `A2Z-${last}.otf`);
    return fs.existsSync(abs) ? [{ abs, weight: 400, family: f }] : [];
  }
  return [];
}

/** Build @font-face rules for every bundled family the template references. */
function buildFontFaces(templateObj) {
  const fams = new Set();
  const t = (templateObj && templateObj.template && templateObj.template.fonts) || {};
  for (const v of Object.values(t)) if (v) fams.add(v);
  const roles = (templateObj && templateObj.capabilities && templateObj.capabilities.font_roles) || {};
  for (const r of Object.values(roles)) if (r && r.font) fams.add(r.font);

  let css = "";
  for (const fam of fams) {
    for (const e of bundledFontFiles(fam)) {
      css +=
        `@font-face{font-family:"${fam}";` +
        (e.weight ? `font-weight:${e.weight};` : "") +
        `src:url("file://${e.abs}") format("opentype");}\n`;
    }
  }
  return css;
}

// Font role defaults (fallback if template capabilities not available)
const DEFAULT_FONT_ROLES = {
  cover_title: { font: "Pretendard", size: 33.45, color: "#000000", align: "left" },
  cover_metadata: { font: "Pretendard", size: 16.73, color: "#000000", align: "left" },
  section_title: { font: "Pretendard", size: 24, color: "#000000", align: "left" },
  section_header: { font: "Pretendard", size: 18, color: "#000000", align: "left" },
  body_text: { font: "Pretendard", size: 16, color: "#000000", align: "left" },
  body_text_toc: { font: "Pretendard", size: 18, color: "#000000", align: "left" },
  numbered_item: { font: "Pretendard", size: 16, color: "#000000", align: "left" },
  table_header: { font: "Pretendard", size: 14, color: "#000000", align: "left" },
  table_data: { font: "Pretendard", size: 14, color: "#000000", align: "left" },
  closing_title: { font: "Pretendard", size: 44, color: "#000000", align: "center" },
  disclaimer: { font: "Pretendard", size: 6, color: "#666666", align: "left" },
  confidential_mark: { font: "Pretendard", size: 14, color: "#C00000", align: "center" },
  kpi_value: { font: "Pretendard", size: 24, color: "#003087", align: "center" },
  kpi_label: { font: "Pretendard", size: 12, color: "#44546A", align: "center" },
};

/**
 * Build font role map from template capabilities, falling back to defaults.
 */
function buildFontRoles(templateObj) {
  if (!templateObj || !templateObj.capabilities || !templateObj.capabilities.font_roles) {
    return DEFAULT_FONT_ROLES;
  }
  const roles = {};
  for (const [name, def] of Object.entries(templateObj.capabilities.font_roles)) {
    roles[name] = {
      font: def.font,
      size: def.size,
      color: def.color || "#000000",
      align: def.align || "left",
      charSpacing: def.char_spacing,
      lineSpacing: def.line_spacing,
      bold: def.bold,
    };
  }
  return roles;
}

/**
 * Build CSS font shorthand from a font role definition.
 */
function fontCss(role) {
  if (!role) return "16px sans-serif";
  const size = role.size ? `${role.size}pt` : "16pt";
  const family = role.font ? `"${role.font}", sans-serif` : "sans-serif";
  return `${size} ${family}`;
}

/**
 * Escape HTML special characters.
 */
function esc(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render text content from a region. Handles both string content and structured content.
 */
function renderContent(content) {
  if (typeof content === "string") return esc(content);
  if (!content) return "";
  if (typeof content === "object" && !content.type) return "";

  // Body content
  if (typeof content === "object" && content.type === "body") {
    let html = "";
    for (const item of content.items) {
      if (item.type === "section") {
        html += `<div style="font-weight:bold;margin-top:4px;">${esc(item.heading)}</div>`;
        if (item.children) {
          html += '<div style="margin-left:20px;">';
          for (const child of item.children) {
            html += `<div>${esc(child.text)}</div>`;
          }
          html += '</div>';
        }
      } else if (item.type === "bullet") {
        html += `<div style="margin-left:10px;">• ${esc(item.text)}</div>`;
      } else if (item.type === "numbered") {
        html += `<div style="margin-left:10px;">${esc(item.text)}</div>`;
      } else if (item.type === "text") {
        html += `<div>${esc(item.text)}</div>`;
      } else if (item.type === "image") {
        html += `<img src="${esc(item.src)}" alt="${esc(item.alt || "")}" style="max-width:100%;margin:4px 0;">`;
      }
    }
    return html;
  }

  // KPI Table content
  if (typeof content === "object" && content.type === "kpi-table") {
    let html = '<table style="width:100%;border-collapse:collapse;margin:4px 0;">';
    if (content.headers && content.headers.length > 0) {
      html += '<thead><tr>';
      for (const h of content.headers) {
        html += `<th style="background:#E7E6E6;padding:4px 8px;border:1px solid #ccc;text-align:left;font-weight:bold;">${esc(h)}</th>`;
      }
      html += '</tr></thead>';
    }
    if (content.rows && content.rows.length > 0) {
      html += '<tbody>';
      for (const row of content.rows) {
        html += '<tr>';
        for (const cell of row) {
          html += `<td style="padding:4px 8px;border:1px solid #ccc;">${esc(cell)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';
    return html;
  }

  // Image content
  if (typeof content === "object" && content.type === "image") {
    return `<img src="${esc(content.src)}" alt="${esc(content.alt || "")}" style="max-width:100%;">`;
  }

  if (typeof content === "object" && content.type === "image-grid") {
    const images = Array.isArray(content.images) ? content.images : [];
    return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;width:100%;height:100%;">${images.map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt || "")}" style="width:100%;height:100%;object-fit:contain;">`).join("")}</div>`;
  }

  // Summary group content
  if (typeof content === "object" && content.type === "summary-group") {
    let html = esc(content.heading);
    if (content.items && Array.isArray(content.items)) {
      html += "<br>";
      for (const item of content.items) {
        if (item.type === "numbered" || item.type === "bullet") {
          html += `<span style="display:block;margin-left:20px;">${esc(item.text)}</span>`;
        } else if (item.type === "text") {
          html += `<span style="display:block;">${esc(item.text)}</span>`;
        } else if (item.type === "section" && item.heading) {
          html += `<span style="display:block;font-weight:bold;">${esc(item.heading)}</span>`;
          if (item.children) {
            for (const child of item.children) {
              html += `<span style="display:block;margin-left:20px;">${esc(child.text)}</span>`;
            }
          }
        }
      }
    }
    return html;
  }

  return "";
}

/**
 * Render a single region as a positioned div.
 */
function renderRegion(name, region, fontRoles) {
  if (!region) return "";
  const role = fontRoles[region.font_role] || fontRoles[region.heading_role] || fontRoles[region.sub_item_role];
  const x = region.x || 0;
  const y = region.y || 0;
  const w = region.w || 4;
  const h = region.h || 1;
  const align = region.align || (role && role.align) || "left";
  const color = (role && role.color) || "#000000";

  let borderCss = "";
  if (region.border) {
    const bw = region.border.width || 1;
    const bc = region.border.color || "#000000";
    borderCss = `border:${bw}px solid ${bc};`;
  }

  return [
    `<div class="region region-${esc(name)}" style="`,
    `position:absolute;`,
    `left:${x}in;top:${y}in;width:${w}in;`,
    h ? `height:${h}in;` : "",
    `font:${fontCss(role)};`,
    `color:${color};`,
    `text-align:${align};`,
    `overflow:hidden;`,
    borderCss,
    `">`,
    renderContent(region.content),
    `</div>`,
  ].join("");
}

/**
 * Render decoration elements for a slide.
 */
function renderDecorations(decorations) {
  if (!decorations || !Array.isArray(decorations)) return "";
  let html = "";
  for (const d of decorations) {
    if (d.type === "image") {
      html += `<img src="${esc(d.asset)}" style="position:absolute;left:${d.x}in;top:${d.y}in;` +
        `width:${d.w}in;height:${d.h}in;" alt="">`;
    } else if (d.type === "line") {
      html += `<div style="position:absolute;left:${d.x}in;top:${d.y}in;` +
        `width:${d.w}in;height:0;border-top:${d.width || 1}px solid ${d.color || "#000000"};"></div>`;
    } else if (d.type === "confidential_mark") {
      html += `<div class="decoration-confidential" style="position:absolute;left:${d.x}in;top:${d.y}in;` +
        `width:${d.w}in;height:${d.h}in;border:1px solid #C00000;` +
        `font:14pt 'Pretendard';color:#C00000;text-align:center;` +
        `display:flex;align-items:center;justify-content:center;">對 外 秘</div>`;
    } else if (d.type === "slide_number") {
      // Slide numbers rendered per-slide below
    } else if (d.type === "disclaimer") {
      html += `<div class="decoration-disclaimer" style="position:absolute;left:${d.x}in;top:${d.y}in;` +
        `width:${d.w}in;height:${d.h}in;font:6pt 'Pretendard';color:#666;">` +
        `${esc(d.text || "※ 본 문서는 대외비로, 권한이 없는 자에게 열람, 복사, 배포, 공개, 또는 사용이 금지됩니다.")}</div>`;
    }
  }
  return html;
}

/**
 * Render a slide number element.
 */
function renderSlideNumber(slideIdx, decorations) {
  if (!decorations) return "";
  for (const d of decorations) {
    if (d.type === "slide_number") {
      return `<div style="position:absolute;left:${d.x}in;top:${d.y}in;` +
        `width:${d.w}in;height:${d.h}in;font:10pt sans-serif;color:#999;` +
        `text-align:right;">${slideIdx + 1}</div>`;
    }
  }
  return "";
}

/**
 * Render the full resolved spec to an HTML string.
 *
 * @param {object} resolved - Resolved spec from layout-resolver
 * @param {object} templateObj - Template object from template-registry
 * @returns {string} Self-contained HTML document
 */
function render(resolved, templateObj) {
  const fontRoles = buildFontRoles(templateObj);
  const dims = (templateObj && templateObj.template && templateObj.template.dimensions) || {};
  const pageW = dims.width || 10.833;
  const pageH = dims.height || 7.5;
  const title = (resolved.deck && resolved.deck.title) || "Presentation";

  // Brand-neutral body font stack derived from the template (not hardcoded).
  const fontsObj = (templateObj && templateObj.template && templateObj.template.fonts) || {};
  const uniqueFonts = [...new Set([fontsObj.body, fontsObj.title, fontsObj.light].filter(Boolean))];
  const bodyFontFamily =
    (uniqueFonts.length ? uniqueFonts.map((f) => `"${f}"`).join(", ") + ", " : "") + "sans-serif";
  const fontFaces = buildFontFaces(templateObj);

  const slidesHtml = (resolved.slides || []).map((slide, idx) => {
    const regions = slide.regions || {};
    const decorations = slide.decorations || [];

    let slideContent = "";
    // Decorations first (behind regions)
    slideContent += renderDecorations(decorations);
    // Slide number
    slideContent += renderSlideNumber(idx, decorations);
    // Regions
    for (const [name, region] of Object.entries(regions)) {
      slideContent += renderRegion(name, region, fontRoles);
    }

    return `<div class="slide" style="position:relative;width:${pageW}in;height:${pageH}in;` +
      `margin:0 auto 20px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.15);overflow:hidden;">` +
      slideContent +
      `</div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
${fontFaces}  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${bodyFontFamily};
    background: #f0f0f0;
    padding: 20px;
  }
  .slide {
    page-break-after: always;
  }
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`;
}

module.exports = { render };

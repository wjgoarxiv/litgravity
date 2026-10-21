"use strict";

/**
 * font-map.js — apply a font SYSTEM to an azure-style template, decoupled from
 * which enrolled template was chosen. Lets a user pick AZURE design + any font.
 *
 * Two systems:
 *   pretendard — ONE weighted family "Pretendard" (bold via weight; bold:true OK)
 *   a2z        — 에이투지체, one family PER weight (bold:false; weight by name)
 *
 * Each font_role is reassigned by its INTENDED weight class (derived from the
 * role name, not the source template's possibly-flattened bold flag) so the
 * mapping is correct no matter which template you start from.
 */

// Per-weight family names for the per-weight font systems.
const FAMILIES = {
  a2z: { bold: "에이투지체 7 Bold", regular: "에이투지체 4 Regular", light: "에이투지체 3 Light", black: "에이투지체 9 Black", medium: "에이투지체 5 Medium" },
};

// Canonical weight class per role name (intended hierarchy weight).
const ROLE_WEIGHT = {
  cover_title: "bold", section_title: "bold", section_header: "bold",
  table_header: "bold", closing_title: "bold", divider_title: "bold",
  body_text_toc: "bold", kpi_value: "black",
  disclaimer: "light",
  cover_metadata: "regular", cover_date: "regular", body_text: "regular",
  numbered_item: "regular", table_data: "regular", kpi_label: "regular",
  figure_caption: "regular", table_caption: "regular", eyebrow: "bold",
};

function weightClass(roleName) {
  if (ROLE_WEIGHT[roleName]) return ROLE_WEIGHT[roleName];
  const n = roleName.toLowerCase();
  if (n.includes("kpi_value")) return "black";
  if (n.includes("title") || n.includes("header") || n.includes("eyebrow")) return "bold";
  if (n.includes("disclaimer") || n.includes("light") || n.includes("caption_small")) return "light";
  return "regular";
}

const KEYS = ["pretendard", "a2z"];

/**
 * Mutate templateObj in place to use the given font system. No-op for unknown key.
 * @param {object} templateObj  { template, capabilities, mapping }
 * @param {"pretendard"|"a2z"} key
 */
function applyFont(templateObj, key) {
  if (!key || !KEYS.includes(key)) return templateObj;
  const t = templateObj.template || (templateObj.template = {});
  const caps = templateObj.capabilities || {};

  if (key === "pretendard") {
    t.fonts = { title: "Pretendard", body: "Pretendard", light: "Pretendard" };
    t.global_typography = { ...(t.global_typography || {}), bullet_font: "Pretendard" };
    const roles = caps.font_roles || {};
    for (const [name, r] of Object.entries(roles)) {
      const cls = weightClass(name);
      r.font = "Pretendard";
      r.bold = cls === "bold" || cls === "black";
    }
    if (caps.constraints) caps.constraints.no_bold_on_bold_fonts = false;
    return templateObj;
  }

  const fam = FAMILIES[key];
  t.fonts = { title: fam.bold, body: fam.regular, light: fam.light };
  t.global_typography = { ...(t.global_typography || {}), bullet_font: fam.regular };
  const roles = caps.font_roles || {};
  for (const [name, r] of Object.entries(roles)) {
    const cls = weightClass(name);
    r.font = fam[cls] || fam.regular;
    r.bold = false; // per-weight families never take a bold flag (avoids faux-bold)
  }
  if (caps.constraints) caps.constraints.no_bold_on_bold_fonts = true;
  return templateObj;
}

module.exports = { applyFont, KEYS, FAMILIES, weightClass };

"use strict";

/**
 * template-registry.js — Load enrolled templates from YAML files.
 *
 * Reads template.yaml, layout-mapping.yaml, and capabilities.yaml from
 * enrolled template directories under templates/enrolled/<NAME>/.
 */

const fs = require("fs");
const path = require("path");

const ENROLLED_DIR = path.resolve(__dirname, "../../templates/enrolled");

/**
 * Where templates are looked up, first match wins: every directory in
 * LIT_PPTX_TEMPLATE_DIRS (path-delimiter separated), then .lit-pptx/templates
 * under the working directory (learn_template.py writes there by default),
 * then the templates bundled with the skill. The installed skill directory is
 * read-only, so a learned template never has to be written into it.
 */
function templateDirs() {
  const extra = (process.env.LIT_PPTX_TEMPLATE_DIRS || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.resolve(dir));
  return [...extra, path.resolve(process.cwd(), ".lit-pptx", "templates"), ENROLLED_DIR];
}

/**
 * Minimal YAML parser for the project's template files.
 * Handles nested mappings, lists, quoted strings, and numeric values.
 * @param {string} raw — YAML source text
 * @returns {object}
 */
function parseYaml(raw) {
  const lines = raw.split("\n");
  return parseBlock(lines, 0, 0).value;
}

/**
 * Parse a YAML block starting at `startLine` with indentation >= `minIndent`.
 * Returns { value, nextLine } where nextLine is the first line NOT consumed.
 */
function parseBlock(lines, startLine, minIndent) {
  // Determine if this is a mapping or a sequence
  let i = startLine;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    break;
  }

  if (i >= lines.length) {
    return { value: {}, nextLine: i };
  }

  const firstNonEmpty = lines[i];
  const firstIndent = firstNonEmpty.length - firstNonEmpty.trimStart().length;

  // Check if sequence or mapping
  const firstTrimmed = firstNonEmpty.trim();
  if (firstTrimmed.startsWith("- ") || firstTrimmed === "-") {
    return parseSequence(lines, i, firstIndent);
  }
  return parseMapping(lines, i, minIndent);
}

/**
 * Parse a YAML mapping (key: value pairs).
 */
function parseMapping(lines, startLine, minIndent) {
  const result = {};
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blanks and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) break;

    // Must be a key: value line
    const kvMatch = trimmed.match(/^([\w][\w.-]*):\s*(.*)$/);
    if (!kvMatch) {
      i++;
      continue;
    }

    const key = kvMatch[1];
    const valPart = kvMatch[2].trim();

    if (valPart === "") {
      // Value is on next indented lines — check if it's a sequence or mapping
      let nextI = i + 1;
      while (nextI < lines.length) {
        const t = lines[nextI].trim();
        if (t === "" || t.startsWith("#")) {
          nextI++;
          continue;
        }
        break;
      }
      if (nextI >= lines.length) {
        result[key] = null;
        i = nextI;
        continue;
      }

      const childIndent = lines[nextI].length - lines[nextI].trimStart().length;
      if (childIndent <= indent) {
        result[key] = null;
        i++;
        continue;
      }

      const childTrimmed = lines[nextI].trim();
      if (childTrimmed.startsWith("- ") || childTrimmed === "-") {
        const seq = parseSequence(lines, nextI, childIndent);
        result[key] = seq.value;
        i = seq.nextLine;
      } else {
        const sub = parseMapping(lines, nextI, childIndent);
        result[key] = sub.value;
        i = sub.nextLine;
      }
    } else {
      result[key] = parseScalar(valPart);
      i++;
    }
  }

  return { value: result, nextLine: i };
}

/**
 * Parse a YAML sequence (list of items starting with -).
 */
function parseSequence(lines, startLine, minIndent) {
  const result = [];
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) break;
    if (indent !== minIndent) break;

    if (trimmed.startsWith("- ")) {
      const itemPart = trimmed.slice(2).trim();
      if (itemPart === "") {
        i++;
        continue;
      }

      // Check if item is a key: value (inline mapping start)
      const kvMatch = itemPart.match(/^([\w][\w.-]*):\s*(.*)$/);
      if (kvMatch) {
        // This is an inline mapping as a list item
        const inlineObj = {};
        const k = kvMatch[1];
        const v = kvMatch[2].trim();

        if (v === "") {
          // Multi-line mapping value in a list item
          let nextI = i + 1;
          while (nextI < lines.length) {
            const t = lines[nextI].trim();
            if (t === "" || t.startsWith("#")) {
              nextI++;
              continue;
            }
            break;
          }

          if (nextI < lines.length) {
            const childIndent = lines[nextI].length - lines[nextI].trimStart().length;
            if (childIndent > indent + 2) {
              const sub = parseMapping(lines, nextI, childIndent);
              inlineObj[k] = sub.value;
              i = sub.nextLine;
              // Continue parsing more keys at indent + 2
              while (i < lines.length) {
                const tl = lines[i].trim();
                if (tl === "" || tl.startsWith("#")) { i++; continue; }
                const ci = lines[i].length - lines[i].trimStart().length;
                if (ci < childIndent) break;
                const km = tl.match(/^([\w][\w.-]*):\s*(.*)$/);
                if (!km) break;
                const ck = km[1];
                const cv = km[2].trim();
                if (cv === "") {
                  let nI = i + 1;
                  while (nI < lines.length) {
                    const tt = lines[nI].trim();
                    if (tt === "" || tt.startsWith("#")) { nI++; continue; }
                    break;
                  }
                  if (nI < lines.length) {
                    const cci = lines[nI].length - lines[nI].trimStart().length;
                    if (cci > ci) {
                      const sub2 = parseMapping(lines, nI, cci);
                      inlineObj[ck] = sub2.value;
                      i = sub2.nextLine;
                      continue;
                    }
                  }
                  inlineObj[ck] = null;
                  i++;
                  continue;
                }
                inlineObj[ck] = parseScalar(cv);
                i++;
              }
            } else {
              inlineObj[k] = null;
            }
          } else {
            inlineObj[k] = null;
          }
        } else {
          inlineObj[k] = parseScalar(v);
          i++;
        }

        // Check for more key: value pairs at the same continuation indent
        const contIndent = indent + 2;
        while (i < lines.length) {
          const cline = lines[i];
          const ct = cline.trim();
          if (ct === "" || ct.startsWith("#")) { i++; continue; }
          const ci = cline.length - cline.trimStart().length;
          if (ci < contIndent) break;
          // Must be at the continuation indent level
          const ckm = ct.match(/^([\w][\w.-]*):\s*(.*)$/);
          if (!ckm) break;
          const ck = ckm[1];
          const cv = ckm[2].trim();
          if (cv === "") {
            let nI = i + 1;
            while (nI < lines.length) {
              const tt = lines[nI].trim();
              if (tt === "" || tt.startsWith("#")) { nI++; continue; }
              break;
            }
            if (nI < lines.length) {
              const nci = lines[nI].length - lines[nI].trimStart().length;
              if (nci > ci) {
                const sub2 = parseMapping(lines, nI, nci);
                inlineObj[ck] = sub2.value;
                i = sub2.nextLine;
                continue;
              }
            }
            inlineObj[ck] = null;
            i++;
            continue;
          }
          inlineObj[ck] = parseScalar(cv);
          i++;
        }

        result.push(inlineObj);
      } else {
        result.push(parseScalar(itemPart));
        i++;
      }
    } else if (trimmed === "-") {
      i++;
    } else {
      break;
    }
  }

  return { value: result, nextLine: i };
}

/**
 * Drop a trailing YAML comment (whitespace, then `#`) from a scalar. A quoted
 * value ends at its closing quote, so a `#` inside the quotes stays. Without
 * this, `char_spacing: -0.5   # note` parsed as a string and every run of the
 * template was written with spc="NaN".
 */
function stripInlineComment(raw) {
  const quote = raw[0];
  if (quote === '"' || quote === "'") {
    const close = raw.indexOf(quote, 1);
    if (close > 0 && /^\s+#/.test(raw.slice(close + 1))) return raw.slice(0, close + 1);
    return raw;
  }
  return raw.replace(/\s+#.*$/, "");
}

/**
 * Parse a scalar YAML value (string, number, boolean, null).
 */
function parseScalar(raw) {
  raw = stripInlineComment(raw);
  if (raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;

  // Quoted string
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // Inline array: [a, b, c]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseScalar(s.trim()));
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return parseFloat(raw);
  }

  return raw;
}

/**
 * List available enrolled template names.
 * @returns {string[]}
 */
function listTemplates() {
  const names = new Set();
  for (const dir of templateDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (fs.statSync(path.join(dir, name)).isDirectory()) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Load an enrolled template by name.
 * @param {string} name — Template directory name (e.g. "MY-BRAND")
 * @returns {{ name: string, version: string, template: object, mapping: object, capabilities: object }}
 */
function loadTemplate(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(name))) {
    throw new Error(`Invalid template name: "${name}"`);
  }
  const dir = templateDirs()
    .map((base) => path.join(base, name))
    .find((candidate) => fs.existsSync(path.join(candidate, "template.yaml")));
  if (!dir) {
    throw new Error(`Unknown template: "${name}" not found in ${templateDirs().join(", ")}`);
  }

  const readFile = (basename) => {
    const fp = path.join(dir, basename);
    if (!fs.existsSync(fp)) {
      throw new Error(`Template "${name}" is missing ${basename}`);
    }
    return fs.readFileSync(fp, "utf-8");
  };

  const template = parseYaml(readFile("template.yaml"));
  const mapping = parseYaml(readFile("layout-mapping.yaml"));
  const capabilities = parseYaml(readFile("capabilities.yaml"));

  return {
    name: template.name || name,
    version: template.version || "0.0.0",
    template,
    mapping,
    capabilities,
    pack: legacyPack(template.name || name, template),
  };
}

// ── Tonality packs ──────────────────────────────────────────────────────────

const grid = require("./grid-resolver");

const TONALITY_DIR = path.resolve(__dirname, "../../templates/tonalities");

/** Pack lookup, first match wins, in the same order as templates. */
function tonalityDirs() {
  const extra = (process.env.LIT_PPTX_TONALITY_DIRS || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.resolve(dir));
  return [...extra, path.resolve(process.cwd(), ".lit-pptx", "tonalities"), TONALITY_DIR];
}

function listTonalities() {
  const names = new Set();
  for (const dir of tonalityDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (fs.existsSync(path.join(dir, name, "pack.yaml"))) names.add(name);
    }
  }
  return [...names].sort();
}

const PALETTE_ROLES = ["ground", "surface", "ink", "ink-muted", "line", "accent", "accent-deep", "accent-tint", "field", "on-field", "positive", "negative"];
const FACE_KEYS = ["display", "title", "body", "label", "numeral"];
const FACES = {
  "Pretendard Regular": { font: "Pretendard", bold: false },
  "Pretendard Bold": { font: "Pretendard", bold: true },
  "A2Z Light": { font: "에이투지체 3 Light", bold: false },
  "A2Z Regular": { font: "에이투지체 4 Regular", bold: false },
  "A2Z Medium": { font: "에이투지체 5 Medium", bold: false },
  "A2Z Bold": { font: "에이투지체 7 Bold", bold: false },
  "A2Z Black": { font: "에이투지체 9 Black", bold: false },
};
const DECORATIONS = ["accent-rule", "hairline-rule", "header-band", "rail-fill", "colour-field", "caption-band", "column-hairlines", "box-outline", "mark-underline", "numeral"];
const SLIDE_ROLES = ["content", "data", "data-takeaway", "sequence", "image", "statement", "reference", "definition"];
const FILL_POLICIES = ["distribute", "step-up", "anchor-visual", "change-family"];
// How a pack carries its display slides: the device on a type-led cover, around a statement,
// behind a big number and under a closing's next step (`display.index` adds the part index to
// section slides).
const DISPLAY_DEVICES = {
  cover: ["plain", "drench", "plate", "rail", "band", "figures", "rules", "numeral"],
  statement: ["open", "drench", "rules", "plate", "offset"],
  number: ["field", "tint", "outline"],
  closing: ["band", "box", "rules"],
};
// Contrast pairs every pack must meet (text pairs 4.5:1, large marks 3:1).
const CONTRAST_PAIRS = [["ink", "ground", 4.5], ["ink", "surface", 4.5], ["ink-muted", "ground", 4.5], ["ink-muted", "surface", 4.5],
  ["accent", "ground", 3.0], ["accent-deep", "accent-tint", 4.5], ["ink", "accent-tint", 4.5], ["on-field", "field", 4.5],
  ["positive", "ground", 4.5], ["negative", "ground", 4.5]];

function luminance(hexColour) {
  const v = String(hexColour).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Check a parsed pack against the pack schema; throws one message naming every problem. */
function validatePack(pack, file) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  const isList = (v) => Array.isArray(v);
  const hex = (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/u.test(v);
  need(typeof pack.id === "string" && /^[a-z][a-z0-9-]{2,23}$/u.test(pack.id), "id must be 3-24 lowercase letters, digits or hyphens");
  need(typeof pack.name === "string" && pack.name.length >= 1 && pack.name.length <= 24, "name must be 1-24 characters");
  need(typeof pack.version === "string" && /^\d+\.\d+\.\d+$/u.test(pack.version), "version must be semver");
  need(typeof pack.intent === "string" && pack.intent.length > 0, "intent is missing");
  need(isList(pack.canvas) && pack.canvas.length > 0 && pack.canvas.every((c) => grid.CANVAS[c]), "canvas must list 16:9 and/or 4:3");
  // `faces` is the deck's default and is Pretendard only; `faces-a2z` applies when the source asks.
  for (const key of ["faces", "faces-a2z"]) {
    if (key === "faces-a2z" && pack[key] == null) continue;
    const faces = pack[key] || {};
    for (const role of FACE_KEYS) {
      need(FACES[faces[role]] && (key === "faces-a2z" || /^Pretendard /u.test(faces[role])), `${key}.${role} must name a bundled face${key === "faces-a2z" ? "" : " (Pretendard Regular or Bold)"}`);
    }
    const distinct = new Set(FACE_KEYS.map((r) => faces[r]));
    need(distinct.size <= 3, `${key} uses ${distinct.size} faces; at most 3`);
    need(new Set([...distinct].map((f) => String(f).split(" ")[0])).size <= 2, `${key} mixes more than two families`);
  }
  const palette = pack.palette || {};
  for (const role of PALETTE_ROLES) need(hex(palette[role]), `palette.${role} is missing or not #RRGGBB`);
  need(isList(palette.series) && palette.series.length >= 2 && palette.series.length <= 4 && palette.series.every(hex),
    "palette.series must list 2-4 #RRGGBB colours");
  if (PALETTE_ROLES.every((r) => hex(palette[r]))) {
    for (const [a, b, min] of CONTRAST_PAIRS) {
      const got = contrast(palette[a], palette[b]);
      need(got >= min, `${a} on ${b} is ${got.toFixed(2)}:1, below ${min}:1`);
    }
    need(Math.abs(luminance(palette.line) - luminance(palette.ground)) >= 0.08, "line is not visible on ground (luminance difference below 0.08)");
    if (isList(palette.series) && palette.series.every(hex)) {
      need(palette.series[0].toUpperCase() === palette.accent.toUpperCase(), "palette.series must start with the accent");
      for (const s of palette.series) need(contrast(s, palette.ground) >= 3, `series colour ${s} is below 3:1 on ground`);
    }
  }
  need(["presented", "reading"].includes(pack.ramp), "ramp must be presented or reading");
  need(typeof pack.hero === "boolean", "hero must be true or false");
  need(Number.isInteger(pack.density) && pack.density >= 1 && pack.density <= 10, "density must be an integer 1-10");
  need(Number.isInteger(pack.variance) && pack.variance >= 4 && pack.variance <= 10, "variance must be an integer 4-10");
  need(pack.radius === 0 || pack.radius === 6, "radius must be 0 or 6");
  need(["border", "fill", "fill+border"].includes(pack.edge), "edge must be border, fill or fill+border");
  const treatments = isList(pack.treatments) ? pack.treatments : [];
  need(treatments.length >= 3 && treatments.length <= 5, "treatments must list 3-5 title treatments");
  for (const t of treatments) need(grid.TREATMENTS.includes(t), `unknown treatment "${t}" (known: ${grid.TREATMENTS.join(", ")})`);
  const roles = pack["role-defaults"] || {};
  for (const role of SLIDE_ROLES) need(treatments.includes(roles[role]), `role-defaults.${role} must be one of the pack's treatments`);
  // A family's own title in this pack, ahead of its role default: the structure the pack draws it with.
  const structure = pack.structure || {};
  need(typeof structure === "object" && !Array.isArray(structure), "structure must be a map of family to treatment");
  for (const [f, t] of Object.entries(structure)) {
    need(Boolean(grid.FAMILIES[f]), `structure names an unknown family "${f}"`);
    need(treatments.includes(t) && grid.FAMILIES[f] && grid.FAMILIES[f].allow.includes(t), `structure.${f} must be a treatment of the pack that the family allows`);
  }
  for (const d of pack.decoration || []) need(DECORATIONS.includes(d), `unknown decoration "${d}"`);
  need(pack.rail == null || ["surface", "field"].includes(pack.rail), "rail must be surface or field");
  const display = pack.display || {};
  need(typeof display === "object" && !Array.isArray(display), "display must be a map");
  for (const [key, devices] of Object.entries(DISPLAY_DEVICES)) {
    need(display[key] == null || devices.includes(display[key]), `display.${key} must be one of ${devices.join(", ")}`);
  }
  need(display.index == null || typeof display.index === "boolean", "display.index must be true or false");
  for (const key of Object.keys(display)) need(key === "index" || DISPLAY_DEVICES[key], `unknown display key "${key}"`);
  const families = pack["layout-families"] || [];
  need(families.length >= 6, "layout-families must list at least 6 families");
  for (const f of families) {
    need(Boolean(grid.FAMILIES[f]), `unknown layout family "${f}"`);
    if (grid.FAMILIES[f]) need(grid.FAMILIES[f].allow.some((t) => treatments.includes(t)), `the ${f} family allows none of the pack's treatments`);
  }
  for (const [key, kind, min] of [["covers", "cover", 3], ["sections", "section", 2], ["closings", "closing", 2]]) {
    const list = pack[key] || [];
    need(list.length >= min, `${key} must list at least ${min} variants`);
    for (const v of list) need(grid.VARIANTS[kind].includes(v), `unknown ${kind} variant "${v}"`);
  }
  for (const key of ["table", "chart", "image"]) need(pack[key] && typeof pack[key] === "object", `${key} settings are missing`);
  const order = pack["fill-order"] || [];
  need(order.length === FILL_POLICIES.length && FILL_POLICIES.every((p) => order.includes(p)), `fill-order must order ${FILL_POLICIES.join(", ")}`);
  if (problems.length) throw new Error(`Tonality pack ${file}: ${problems.join("; ")}`);
  return pack;
}

/** Load and check one tonality pack by id. */
function loadPack(name) {
  // Pack ids are lowercase; a display name such as "Ledger" names the same pack.
  const id = String(name).toLowerCase();
  const known = listTonalities();
  const dir = tonalityDirs()
    .map((base) => path.join(base, String(id)))
    .find((candidate) => /^[a-z][a-z0-9-]*$/u.test(String(id)) && fs.existsSync(path.join(candidate, "pack.yaml")));
  if (!dir) {
    throw new Error(`Unknown tonality "${name}". Tonalities: ${known.join(", ") || "(none)"}; legacy templates: ${listTemplates().join(", ")}`);
  }
  const file = path.join(dir, "pack.yaml");
  const pack = validatePack(parseYaml(fs.readFileSync(file, "utf-8")), file);
  if (pack.id !== path.basename(dir)) throw new Error(`Tonality pack ${file}: id "${pack.id}" must match its folder name`);
  return pack;
}

// Today's hand-tuned geometry, now a token set. A legacy template draws with these values unless
// its template.yaml overrides one under `pack: tokens:`; a tonality pack derives its own from the dials.
const LEGACY_TOKENS = {
  card: { pad: 0.30, chip: 0.52, minH: 1.6, gap: 0.28, radius: 0.16 },
  kpi: { minCardWidth: 1.9, blockHeight: 1.75, gap: 0.26 },
  bullet: { size: 16, x: 0.59, w: 8.8, h: 0.38, ySpacing: 0.42, lineSpacing: 1.25 },
  secHeader: { size: 18, x: 0.39, w: 9.0, h: 0.5 },
  summary: { headerW: 4.3, bulletW: 4.8, bulletSize: 14, bulletH: 0.34, ySpacing: 0.38, lineSpacing: 1.05 },
  toc: { size: 18, x: 0.39, w: 7.5, h: 0.55, yStart: 0.957, ySpacing: 0.65 },
  notice: { x: 0.45, h: 0.3, bottom: 0.14, size: 10.5 },
};
// Rich card, KPI and table rendering plus the accent, font and background switches, for a copy of
// an older template that still says `render_style: azure` instead of listing its capabilities.
const RICH_LEGACY_CAPABILITIES = ["rich-blocks", "recolor", "font-swap", "mesh-background"];

function mergeTokens(base, extra) {
  const out = {};
  for (const [group, values] of Object.entries(base)) out[group] = { ...values, ...((extra && extra[group]) || {}) };
  return out;
}

/**
 * A legacy template read as a pack: one title treatment, its own palette mapped onto the pack
 * roles, its capabilities, and today's geometry as tokens. It renders through the legacy path, so
 * a deck that names the template keeps its look.
 */
function legacyPack(name, template) {
  const pal = template.palette || {};
  const own = template.pack || {};
  const capabilities = Array.isArray(own.capabilities)
    ? own.capabilities
    : template.render_style === "azure" ? RICH_LEGACY_CAPABILITIES : [];
  const accent = pal.primary || `#${String((template.global_typography || {}).bullet_color || "3C3836").replace("#", "")}`;
  const palette = {
    ground: pal.ground || pal.paper || "#FFFFFF",
    surface: pal.tint || pal.paper_warm || pal.header_fill || "#F6F6F6",
    ink: pal.ink || "#000000",
    "ink-muted": pal.ink_muted || pal.muted || pal.ink || "#555555",
    line: pal.line || "#CCCCCC",
    accent,
    "accent-deep": pal.primary_deep || pal.ink || accent,
    "accent-tint": pal.tint || pal.paper_warm || "#F6F6F6",
    field: pal.primary_deep || pal.ink || accent,
    "on-field": "#FFFFFF",
  };
  const report = CONTRAST_PAIRS
    .filter(([a, b]) => palette[a] && palette[b])
    .map(([a, b, min]) => ({ pair: `${a} on ${b}`, ratio: +contrast(palette[a], palette[b]).toFixed(2), min }))
    .filter((r) => r.ratio < r.min);
  return {
    id: name,
    name,
    legacy: true,
    treatments: ["top-rule"],
    capabilities,
    palette,
    tokens: mergeTokens(LEGACY_TOKENS, own.tokens),
    contrast: report,
  };
}

function hasCapability(templateObj, capability) {
  return Boolean(templateObj && templateObj.pack && (templateObj.pack.capabilities || []).includes(capability));
}

/**
 * Load a tonality pack as the template object the resolver and renderer read. The dials come from
 * the deck (frontmatter or flags) or the pack defaults; the renderer never sees the pack's name.
 */
function loadTonality(id, options = {}) {
  const pack = loadPack(id);
  const density = grid.clampDial(options.density != null ? options.density : pack.density, pack.density);
  const variance = grid.clampDial(options.variance != null ? options.variance : pack.variance, pack.variance);
  const canvas = options.canvas || pack.canvas[0];
  if (!pack.canvas.includes(canvas)) {
    throw new Error(`Tonality "${pack.id}" supports ${pack.canvas.join(", ")}, not canvas ${canvas}`);
  }
  const tok = grid.densityTokens(density, pack.ramp);
  const g = grid.makeGrid(canvas, tok.grid);
  // Pretendard by default; the A2Z map only when the source asks for it (`faces: a2z`).
  const wantsA2z = String(options.faces || "").toLowerCase() === "a2z" && pack["faces-a2z"];
  const faceMap = wantsA2z ? pack["faces-a2z"] : pack.faces;
  const faces = Object.fromEntries(FACE_KEYS.map((role) => [role, FACES[faceMap[role]]]));
  const P = pack.palette;
  const template = {
    name: pack.name,
    label: `${pack.name} tonality`,
    version: pack.version,
    fonts: { title: faces.title.font, body: faces.body.font, light: faces.body.font },
    dimensions: { width: g.W / 72, height: g.H / 72, unit: "inches", format: canvas },
    palette: {
      ink: P.ink, ink_muted: P["ink-muted"], primary: P.accent, primary_deep: P["accent-deep"],
      azure: P.series[1] || P.accent, azure_soft: P["accent-tint"], tint: P.surface, line: P.line, ground: P.ground, paper: P.ground,
    },
    global_typography: { char_spacing: 0, bullet_color: P.accent.replace("#", ""), section_accent: P.accent.replace("#", "") },
  };
  const pt = (v) => v / 72;
  return {
    name: pack.id,
    version: pack.version,
    template,
    mapping: { layouts: {} },
    capabilities: { font_roles: {} },
    pack: {
      ...pack,
      legacy: false,
      capabilities: [],
      faces,
      dials: { density, variance, varianceMax: grid.varianceMax(variance, pack.treatments.length), canvas },
      tok,
      grid: g,
      tokens: mergeTokens(LEGACY_TOKENS, {
        card: { pad: pt(tok.pad), chip: 0, minH: 0, gap: pt(g.gutter), radius: pt(pack.radius) },
        kpi: { minCardWidth: pt(g.span(1, 2).w), blockHeight: pt(tok.pad * 2 + tok.sizes.display * 1.15 + 6 + tok.sizes.label * 1.3), gap: pt(g.gutter) },
      }),
    },
  };
}

module.exports = { loadTemplate, listTemplates, loadPack, listTonalities, loadTonality, hasCapability, validatePack, legacyPack, LEGACY_TOKENS };

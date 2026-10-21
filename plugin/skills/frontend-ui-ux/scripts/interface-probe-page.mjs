// In-page measurement module for scripts/interface-probe.mjs.
//
// `measureInterface` runs inside the page under test. The driver serialises it with
// Function.prototype.toString and evaluates it through the DevTools protocol, so the function stays
// self-contained: no imports, no closure over module scope, no network. It reads the live DOM,
// computed styles and same-origin stylesheets and returns plain JSON. It clicks, presses and
// submits nothing: dialogs are stubbed before the first read, and the only state it touches is the
// focus sample (CF-202, restored afterwards) and a data attribute naming the hover targets the
// driver hovers after this read (CF-506). Every rule id, severity and threshold arrives in
// `options.rules` from interface-probe-rules.mjs.
export function measureInterface(options) {
  const rules = options.rules;
  const limits = options.limits;
  const pass = options.pass;
  const touch = options.touch === true;
  const findings = [];
  const notVerified = [];
  const perRule = new Map();
  const t = (id) => rules[id]?.threshold ?? {};
  const on = (id) => Boolean(rules[id]);
  const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

  // MD-011: nothing the probe reads may block on a dialog.
  for (const name of ["alert", "confirm", "prompt"]) {
    try { window[name] = () => (name === "confirm" ? false : null); } catch { /* read-only global */ }
  }

  const counted = (id) => {
    const count = perRule.get(id) ?? 0;
    perRule.set(id, count + 1);
    return count < limits.findingsPerRule;
  };
  // A judgment rule's hit is a candidate for the reviewer, never a finding (MD-010: Inferred).
  const candidate = (id, finding) => {
    if (!on(id) || !counted(id)) return;
    const why = rules[id].judgment ?? "reviewer decides";
    notVerified.push({ rule: id, reason: `judgment: ${finding.value}${finding.selector ? ` at ${finding.selector}` : ""} (${why})`.slice(0, 220) });
  };
  const add = (id, finding) => {
    const rule = rules[id];
    if (!rule) return;
    if (rule.judgment) { candidate(id, finding); return; }
    if (!counted(id) || findings.length >= limits.findingsPerViewport) return;
    const note = [finding.note, rule.note].filter(Boolean).join("; ");
    findings.push({
      rule: id,
      severity: finding.severity ?? rule.severity,
      tier: finding.tier ?? rule.tier,
      selector: finding.selector ?? null,
      value: finding.value ?? null,
      threshold: finding.threshold ?? null,
      ...(note ? { note: note.slice(0, 160) } : {}),
    });
  };
  const skip = (id, reason) => { if (on(id) || id === "*") notVerified.push({ rule: id, reason }); };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const body = document.body;
  if (!body) return { viewport: { width: vw, height: vh }, ready: document.readyState, counts: {}, findings, notVerified: [{ rule: "*", reason: "page has no body" }], hoverTargets: [] };

  // ---- shared helpers -------------------------------------------------------------------------
  const selectorOf = (el) => {
    const part = (node) => {
      if (node.id && /^[A-Za-z][\w-]*$/u.test(node.id)) return `${node.tagName.toLowerCase()}#${node.id}`;
      const classes = typeof node.className === "string"
        ? node.className.trim().split(/\s+/u).filter((name) => /^[A-Za-z_-][\w-]*$/u.test(name)).slice(0, 2)
        : [];
      let text = node.tagName.toLowerCase() + classes.map((name) => `.${name}`).join("");
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((child) => child.tagName === node.tagName);
        if (same.length > 1) text += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      return text;
    };
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && parts.length < 3; node = node.parentElement) {
      parts.unshift(part(node));
      if (node.id || node === body) break;
    }
    return parts.join(" > ");
  };
  const snippet = (el, length = 40) => (el.innerText ?? el.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, length);
  const styleOf = (el) => getComputedStyle(el);
  const px = (value) => parseFloat(value) || 0;
  const classText = (el) => `${typeof el.className === "string" ? el.className : el.getAttribute?.("class") ?? ""} ${el.id ?? ""}`;
  const classTokens = (el) => classText(el).toLowerCase().split(/[\s_-]+/u).filter(Boolean);
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const ms = (value) => String(value).split(",").map((part) => (part.trim().endsWith("ms") ? px(part) : px(part) * 1000));

  // Visibility scope: rendered, not an accessibility-only span, not parked off canvas.
  const visible = (el) => {
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const style = styleOf(el);
    if (el.offsetParent === null && style.position !== "fixed" && el !== body) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height <= 4) return false;
    if (style.clipPath === "inset(50%)" || /^rect\(0[a-z]*[, ]+0/u.test(style.clip)) return false;
    if (el.matches(".sr-only, .visually-hidden, .visuallyhidden")) return false;
    if (rect.right < -9000 || rect.left > vw + 9000) return false;
    return true;
  };
  const all = [...body.querySelectorAll("*")]
    .filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD|META|LINK|BR)$/u.test(el.tagName))
    .slice(0, limits.nodes);
  const shown = all.filter(visible);
  const directText = (el) => [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim() !== "");
  const textElements = shown.filter((el) => !(el instanceof SVGElement) && directText(el).length > 0);
  const lineRects = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1);
  };
  const lines = (el) => {
    const byTop = new Map();
    for (const rect of lineRects(el)) {
      const top = Math.round(rect.top);
      byTop.set(top, (byTop.get(top) ?? 0) + rect.width);
    }
    return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, width]) => width);
  };
  const lineCount = (el) => lines(el).length;
  const cjkShare = (text) => {
    const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
    if (!letters.length) return 0;
    return (letters.match(/[぀-ヿ㐀-鿿가-힯]/gu)?.length ?? 0) / letters.length;
  };

  // Colour: every CSS colour syntax is normalised through a detached 1x1 canvas.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const colorCache = new Map();
  const parseColor = (value) => {
    if (colorCache.has(value)) return colorCache.get(value);
    let parsed = null;
    if (value && value !== "transparent" && value !== "none") {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      parsed = a === 0 ? null : { r: Math.round((r * 255) / a), g: Math.round((g * 255) / a), b: Math.round((b * 255) / a), a: a / 255 };
    }
    colorCache.set(value, parsed);
    return parsed;
  };
  const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const channel = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  // APCA-W3 0.0.98G lightness contrast, reported only as an advisory figure (CF-203).
  const apca = (text, background) => {
    const y = (c) => 0.2126729 * (c.r / 255) ** 2.4 + 0.7151522 * (c.g / 255) ** 2.4 + 0.072175 * (c.b / 255) ** 2.4;
    const clamp = (value) => (value < 0.022 ? value + (0.022 - value) ** 1.414 : value);
    const yt = clamp(y(text));
    const yb = clamp(y(background));
    if (Math.abs(yb - yt) < 0.0005) return 0;
    if (yb > yt) { const s = (yb ** 0.56 - yt ** 0.57) * 1.14; return s < 0.1 ? 0 : (s - 0.027) * 100; }
    const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
    return s > -0.1 ? 0 : (s + 0.027) * 100;
  };
  const hsl = (c) => {
    const r = c.r / 255; const g = c.g / 255; const b = c.b / 255;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
  };
  const spread = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const hueDistance = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const colorPattern = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/giu;
  const colorsIn = (value) => (value.match(colorPattern) ?? []).map(parseColor).filter(Boolean);
  const lengthsIn = (value) => value.replace(colorPattern, "").match(/-?[\d.]+px/gu)?.map(px) ?? [];
  const shadowsOf = (value) => (value === "none" ? [] : value.split(/,(?![^()]*\))/u)).map((shadow) => {
    const [x = 0, y = 0, blur = 0, spreadPx = 0] = lengthsIn(shadow);
    return { inset: /inset/u.test(shadow), x, y, blur, spread: spreadPx, lengths: lengthsIn(shadow).length, color: colorsIn(shadow)[0] ?? null };
  });

  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches && /dark/u.test(styleOf(doc).colorScheme);
  const canvasColor = darkScheme ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const isMedia = (el) => /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|SVG)$/iu.test(el.tagName);

  // Painted background behind an element, nearest layer first. In the viewport the paint stack at
  // the text's centre is walked, so a positioned sibling under the text counts; elsewhere the
  // ancestor chain is used. Returns { color }, { gradient: stops } (CF-204), { image: true } or
  // { overlap: true } when another element paints on top of the text (not verified).
  const paintBehind = (el, { skipSelf = false } = {}) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + Math.min(rect.width, 40) / 2;
    const cy = rect.top + rect.height / 2;
    let stack = null;
    if (cx >= 0 && cy >= 0 && cx < vw && cy < vh) {
      const hits = document.elementsFromPoint(cx, cy);
      if (!skipSelf && hits[0] && !related(hits[0], el)) return { overlap: true };
      const own = hits.findIndex((node) => node === el || el.contains(node));
      if (own >= 0) stack = hits.slice(own + 1).filter((node) => !el.contains(node));
    }
    if (!stack) {
      stack = [];
      for (let node = el.parentElement; node; node = node.parentElement) stack.push(node);
    }
    const layers = [];
    for (const node of skipSelf ? stack : [el, ...stack]) {
      if (isMedia(node)) return { image: true };
      const style = styleOf(node);
      if (style.backgroundImage !== "none") {
        if (/url\(/u.test(style.backgroundImage)) return { image: true };
        const stops = colorsIn(style.backgroundImage);
        if (stops.length) return { gradient: stops.map((stop) => blend(stop, canvasColor)) };
      }
      const color = parseColor(style.backgroundColor);
      const opacity = Number(style.opacity);
      if (color) layers.push({ ...color, a: color.a * opacity });
      if (color && color.a >= 0.999 && opacity >= 0.999) break;
    }
    let color = canvasColor;
    for (const layer of layers.reverse()) color = blend(layer, color);
    return { color };
  };
  const solidBehind = (el, options) => paintBehind(el, options).color ?? null;
  const opacityChain = (el) => {
    let value = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) value *= Number(styleOf(node).opacity);
    return value;
  };

  // Same-origin stylesheet rules, read once. Cross-origin sheets are listed as not verified.
  const styleRules = [];
  const keyframes = new Map();
  let unreadableSheets = 0;
  const collect = (list) => {
    for (const rule of list) {
      if (rule instanceof CSSKeyframesRule) keyframes.set(rule.name, rule);
      else if (rule instanceof CSSStyleRule) styleRules.push(rule);
      if (rule.cssRules && !(rule instanceof CSSKeyframesRule)) collect(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try { collect(sheet.cssRules); } catch { unreadableSheets += 1; }
  }
  if (unreadableSheets) skip("*", `cross-origin stylesheet (${unreadableSheets}); its rules were not read`);
  const safeMatches = (el, selector) => { try { return el.matches(selector); } catch { return false; } };
  const selectorParts = (rule) => (rule.selectorText ?? "").split(/,(?![^()]*\))/u).map((part) => part.trim());
  const stripPseudo = (selector, pseudo) => selector.replace(new RegExp(`:${pseudo}(?![\\w-])`, "gu"), "").trim() || "*";

  // Controls and their accessible names (enough of the accname rules for a presence check).
  const controlSelector = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem]";
  const controls = [...body.querySelectorAll(controlSelector)].slice(0, limits.nodes);
  const focusables = [...new Set([...controls, ...[...body.querySelectorAll("[tabindex]")].filter((el) => el.tabIndex >= 0)])].slice(0, limits.nodes);
  const accessibleName = (el) => {
    const byId = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/u).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
    if (byId) return byId;
    const aria = (el.getAttribute("aria-label") ?? "").trim();
    if (aria) return aria;
    if (el.matches("input[type=submit],input[type=reset],input[type=button]")) return el.value || el.type;
    if (el.matches("input[type=image]")) return el.alt ?? "";
    if (el.labels?.length) { const text = [...el.labels].map((label) => label.textContent).join(" ").trim(); if (text) return text; }
    const text = (el.innerText ?? "").trim();
    if (text) return text;
    const img = el.querySelector("img[alt]:not([alt='']), svg title");
    if (img) return (img.getAttribute("alt") ?? img.textContent ?? "").trim();
    return (el.getAttribute("title") ?? el.getAttribute("placeholder") ?? "").trim();
  };
  const filled = (el) => {
    const fill = parseColor(styleOf(el).backgroundColor);
    const behind = el.parentElement ? solidBehind(el, { skipSelf: true }) : null;
    return Boolean(fill && fill.a >= 0.9 && (!behind || ratio(blend(fill, behind), behind) > 1.1));
  };
  // CF-701 primary action: a form's sole submit button, or the first filled button or
  // button-styled link inside the first viewport.
  const primaries = new Set();
  for (const form of document.forms) {
    const submits = [...form.elements].filter((el) => el.matches("button,input[type=submit]") && el.type === "submit");
    if (submits.length === 1) primaries.add(submits[0]);
  }
  const firstFilled = controls.find((el) => el.matches("button,a[href],[role=button]") && visible(el) && el.getBoundingClientRect().top < vh && filled(el));
  if (firstFilled) primaries.add(firstFilled);
  const isPrimary = (el) => primaries.has(el) || /(^|[\s_-])(primary|cta)([\s_-]|$)/iu.test(classText(el)) || el.hasAttribute("data-primary");
  const destructive = (el) => /\b(delete|remove|discard|erase|clear all)\b|삭제|제거|지우기|비우기/iu.test(`${accessibleName(el)} ${classText(el)}`);
  const inProse = (el) => {
    if (el.tagName !== "A" || styleOf(el).display !== "inline") return false;
    const block = el.parentElement;
    return Boolean(block && [...block.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 0));
  };
  const standalone = controls.filter((el) => (visible(el) || (el.labels?.length && visible(el.labels[0]))) && !inProse(el)).slice(0, limits.pairControls);

  // MD-008: content behind closed disclosures and cross-origin frames is out of reach, not passed.
  const closed = body.querySelectorAll("details:not([open]), [aria-expanded=false], dialog:not([open]), [role=tabpanel][hidden]").length;
  if (closed) skip("*", `closed disclosures: ${closed}`);
  const foreignFrames = [...body.querySelectorAll("iframe[src]")].filter((frame) => { try { return new URL(frame.src, location.href).origin !== location.origin; } catch { return false; } }).length;
  if (foreignFrames) skip("*", `cross-origin iframes: ${foreignFrames}`);

  // ---- RS-006 / RS-004: page-level horizontal overflow --------------------------------------
  const overflowRule = pass === "zoom" ? "RS-004" : "RS-006";
  if (on(overflowRule)) {
    const width = Math.max(doc.scrollWidth, body.scrollWidth);
    if (width > vw + t(overflowRule).tolerancePx) {
      const scroller = (el) => {
        for (let node = el.parentElement; node && node !== body; node = node.parentElement) {
          if (/(auto|scroll|hidden|clip)/u.test(styleOf(node).overflowX)) return true;
        }
        return false;
      };
      const culprits = shown
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ el, rect }) => (rect.right > vw + 1 || rect.left < -1) && !scroller(el))
        .filter(({ el }, _index, list) => !list.some((other) => other.el !== el && other.el.contains(el)))
        .slice(0, 3);
      add(overflowRule, {
        selector: culprits.map(({ el }) => selectorOf(el)).join(" | ") || "html",
        value: `${width - vw}px wider than the viewport`,
        threshold: `≤ ${t(overflowRule).tolerancePx}px`,
      });
    }
  }

  // ---- RS-007 / RS-004: clipped, offscreen and overlapping text ------------------------------
  // At the zoom pass clipped and offscreen text is RS-004's; overlap stays RS-007 (MEDIUM).
  const clipRule = pass === "zoom" ? "RS-004" : "RS-007";
  if (on("RS-007")) {
    const th = t("RS-007");
    const clamped = (style) => style.textOverflow === "ellipsis" || [style.webkitLineClamp, style.lineClamp].some((value) => value && value !== "none");
    const inScroller = (el) => {
      for (let node = el.parentElement; node && node !== body; node = node.parentElement) if (/(auto|scroll)/u.test(styleOf(node).overflowX)) return true;
      return false;
    };
    for (const el of textElements) {
      const style = styleOf(el);
      if (clamped(style)) continue;
      let clippedBy = (/(hidden|clip)/u.test(style.overflowX) && el.scrollWidth > el.clientWidth + th.clipPx)
        || (/(hidden|clip)/u.test(style.overflowY) && el.scrollHeight > el.clientHeight + th.clipPx) ? el : null;
      const rects = lineRects(el);
      if (!clippedBy && rects.length) {
        const box = { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) };
        for (let node = el.parentElement; node && node !== body; node = node.parentElement) {
          const ancestor = styleOf(node);
          if (!/(hidden|clip)/u.test(`${ancestor.overflowX} ${ancestor.overflowY}`)) continue;
          if (clamped(ancestor)) break;
          const r = node.getBoundingClientRect();
          if (box.right > r.right + th.clipPx || box.bottom > r.bottom + th.clipPx || box.left < r.left - th.clipPx) clippedBy = node;
          break;
        }
      }
      if (clippedBy) {
        add(clipRule, { selector: selectorOf(el), value: `"${snippet(el)}" cut off by ${clippedBy === el ? "its own box" : selectorOf(clippedBy)}`, threshold: "no clipping without text-overflow or line-clamp" });
        continue;
      }
      const rect = el.getBoundingClientRect();
      if ((rect.right > vw + th.offscreenPx || rect.left < -th.offscreenPx) && !inScroller(el)) {
        add(clipRule, { selector: selectorOf(el), value: `"${snippet(el, 30)}" runs ${round(Math.max(rect.right - vw, -rect.left), 0)}px off screen`, threshold: `within ${th.offscreenPx}px of the viewport edge` });
      }
    }
    // Overlap: line boxes cut to the area their clipping ancestors leave visible.
    const clipBox = (el) => {
      let box = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
      for (let node = el; node && node !== body; node = node.parentElement) {
        const style = styleOf(node);
        if (!/(hidden|clip|auto|scroll)/u.test(`${style.overflowX} ${style.overflowY}`)) continue;
        const r = node.getBoundingClientRect();
        box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
      }
      return box;
    };
    const boxes = textElements.slice(0, 600).map((el) => {
      const clip = clipBox(el);
      const rects = lineRects(el).map((r) => {
        const left = Math.max(r.left, clip.left); const top = Math.max(r.top, clip.top);
        const right = Math.min(r.right, clip.right); const bottom = Math.min(r.bottom, clip.bottom);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      }).filter((r) => r.width > 1 && r.height > 1);
      return { el, rects };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]; const b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        let worst = 0;
        for (const ra of a.rects) for (const rb of b.rects) {
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > 0 && h > 0) worst = Math.max(worst, (w * h) / Math.min(ra.width * ra.height, rb.width * rb.height));
        }
        if (worst >= th.overlapRatio) {
          add("RS-007", { severity: th.overlapSeverity, selector: `${selectorOf(a.el)} × ${selectorOf(b.el)}`, value: `overlap ${round(worst)} of the smaller box ("${snippet(a.el, 24)}" / "${snippet(b.el, 24)}")`, threshold: `< ${th.overlapRatio}` });
        }
      }
    }
  }

  // ---- RS-008: mobile input font floor (text-entry controls, touch-primary widths) -----------
  if (on("RS-008") && touch) {
    const entry = "input:not([type]),input[type=text],input[type=email],input[type=number],input[type=password],input[type=search],input[type=tel],input[type=url],textarea,select,[contenteditable]:not([contenteditable=false])";
    for (const el of shown.filter((node) => node.matches(entry))) {
      const size = px(styleOf(el).fontSize);
      if (size + 0.01 < t("RS-008").minFontPx) add("RS-008", { selector: selectorOf(el), value: `${round(size, 1)}px`, threshold: `≥ ${t("RS-008").minFontPx}px` });
    }
  }

  // ---- RS-009: safe-area offsets, read from authored declarations -----------------------------
  if (on("RS-009") && /viewport-fit\s*=\s*cover/iu.test(document.querySelector("meta[name=viewport]")?.content ?? "")) {
    const edge = t("RS-009").edgePx;
    for (const el of shown.filter((node) => /^(fixed|sticky)$/u.test(styleOf(node).position) && (node.matches(controlSelector) || node.querySelector(controlSelector)))) {
      const r = el.getBoundingClientRect();
      const sides = [["top", r.top <= edge], ["bottom", r.bottom >= vh - edge], ["left", r.left <= edge], ["right", r.right >= vw - edge]].filter(([, touching]) => touching).map(([side]) => side);
      if (!sides.length) continue;
      const authored = styleRules.filter((rule) => safeMatches(el, rule.selectorText)).map((rule) => rule.style.cssText).concat(el.style.cssText).join(" ");
      const missing = sides.filter((side) => !authored.includes(`env(safe-area-inset-${side}`));
      if (!missing.length) continue;
      if (unreadableSheets) skip("RS-009", `${selectorOf(el)} may take its safe-area offset from a cross-origin stylesheet`);
      else add("RS-009", { selector: selectorOf(el), value: `pinned to ${missing.join(", ")} with no env(safe-area-inset-*)`, threshold: "env(safe-area-inset-<edge>) in its offset or padding" });
    }
  }

  // ---- RS-010: horizontal rail peek, only for rails with no other scroll cue ------------------
  if (on("RS-010")) {
    for (const rail of shown.filter((el) => el !== body && /(auto|scroll)/u.test(styleOf(el).overflowX) && el.scrollWidth > el.clientWidth + 4 && el.children.length >= 2)) {
      const controlled = rail.id && document.querySelector(`[aria-controls~="${CSS.escape(rail.id)}"]`);
      const scope = rail.parentElement ?? rail;
      const cue = controlled || rail.querySelector("button,[role=tab]") || /\b\d+\s*\/\s*\d+\b/u.test(snippet(scope, 400));
      if (cue) continue;
      const r = rail.getBoundingClientRect();
      const next = [...rail.children].map((child) => child.getBoundingClientRect()).find((c) => c.right > r.right + 1 && c.left < r.right);
      const peek = next ? r.right - next.left : 0;
      const faded = styleOf(rail).maskImage && styleOf(rail).maskImage !== "none";
      if (peek < t("RS-010").minPeekPx) {
        add("RS-010", {
          severity: peek === 0 && !faded ? "HIGH" : undefined,
          selector: selectorOf(rail),
          value: `${round(peek, 1)}px of the next item showing`,
          threshold: `${t("RS-010").minPeekPx}-${t("RS-010").maxPeekPx}px`,
          note: peek === 0 && !faded ? "hidden items with no cue at all (MD-011 #10)" : undefined,
        });
      }
    }
  }

  // ---- RS-002: the dark pass has a dark surface -----------------------------------------------
  if (on("RS-002") && pass === "dark") {
    const th = t("RS-002");
    const points = [[vw / 2, 8], [vw / 2, vh / 2], [12, vh / 2], [vw - 12, vh / 2], [vw / 2, vh - 8]];
    const values = points.map(([x, y]) => {
      const hit = document.elementFromPoint(x, y) ?? body;
      const own = parseColor(styleOf(hit).backgroundColor);
      return luminance(own && own.a >= 0.999 ? own : (solidBehind(hit) ?? canvasColor));
    });
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mean >= th.maxLuminance) {
      // Theme-control fallback: discover, never click (MD-011).
      const words = new RegExp(th.themeControlWords.map(escapeRegExp).join("|"), "iu");
      const toggle = [...body.querySelectorAll("[data-theme-toggle],button,[role=switch],[role=button]")].find((el) => el.matches("[data-theme-toggle]") || words.test(`${accessibleName(el)} ${el.getAttribute("title") ?? ""}`));
      if (toggle) skip("RS-002", `dark path may sit behind ${selectorOf(toggle)}; the probe activates no control`);
      else add("RS-002", { tier: "derived", selector: "html", value: `mean surface luminance ${round(mean)}; the dark media query did not darken the page and no theme control was found`, threshold: `< ${th.maxLuminance}` });
    }
  }

  // ---- RS-003: reduced motion honoured (motion properties only; progress motion exempt) ------
  if (on("RS-003") && pass === "reduced-motion") {
    const th = t("RS-003");
    const kebab = (name) => name.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
    const isMotion = (property) => th.motionProperties.some((name) => property === name || property.startsWith(`${name}-`));
    const essential = (el) => Boolean(el?.closest?.("progress,[role=progressbar],[role=status],[aria-busy=true]"));
    const framesOf = (name) => [...(keyframes.get(name)?.cssRules ?? [])].flatMap((frame) => [...frame.style]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) add("RS-003", { selector: "html", value: "prefers-reduced-motion did not match", threshold: "reduce" });
    let worst = null;
    for (const el of shown) {
      if (essential(el)) continue;
      const style = styleOf(el);
      const properties = style.transitionProperty.split(",").map((part) => part.trim());
      const durations = ms(style.transitionDuration);
      properties.forEach((property, index) => {
        const duration = durations[index % durations.length];
        if (property !== "none" && isMotion(property) && duration > th.maxMotionMs && (!worst || duration > worst.duration)) worst = { el, duration, what: `transition of ${property}` };
      });
      if (style.animationName !== "none") {
        const names = style.animationName.split(",").map((part) => part.trim());
        const animationDurations = ms(style.animationDuration);
        names.forEach((name, index) => {
          const duration = animationDurations[index % animationDurations.length];
          if (duration > th.maxMotionMs && framesOf(name).some(isMotion) && (!worst || duration > worst.duration)) worst = { el, duration, what: `animation ${name}` };
        });
      }
    }
    if (worst) add("RS-003", { selector: selectorOf(worst.el), value: `${round(worst.duration, 0)}ms ${worst.what} still moves`, threshold: `≤ ${th.maxMotionMs}ms of motion` });
    const running = document.getAnimations().filter((animation) => {
      if (animation.playState !== "running" || Number(animation.effect?.getTiming().duration) <= th.maxMotionMs || essential(animation.effect?.target)) return false;
      return (animation.effect?.getKeyframes?.() ?? []).some((frame) => Object.keys(frame).map(kebab).some(isMotion));
    });
    if (running.length) add("RS-003", { selector: running[0].effect?.target ? selectorOf(running[0].effect.target) : null, value: `${running.length} moving animation(s) running`, threshold: `≤ ${th.maxMotionMs}ms of motion` });
    const playing = [...document.querySelectorAll("video")].filter((video) => !video.paused);
    if (playing.length) add("RS-003", { selector: selectorOf(playing[0]), value: `${playing.length} video(s) playing`, threshold: "paused" });
  }

  // ---- CF-101..CF-105: measure, line-height, wrap ---------------------------------------------
  const lineHeightRatio = (el, style) => {
    const size = px(style.fontSize);
    if (style.lineHeight !== "normal") return px(style.lineHeight) / size;
    const tops = [...new Set(lineRects(el).map((rect) => Math.round(rect.top)))].sort((a, b) => a - b);
    return tops.length >= 2 ? (tops[1] - tops[0]) / size : t("CF-102").normalRatio;
  };
  const prose = textElements.filter((el) => el.matches("p, li, blockquote, dd, td") && !el.closest("nav, footer, header, marquee, button, label, [role=navigation], [role=contentinfo]"));
  const proseSet = new Set(prose);
  const sample = (el) => (el.innerText ?? "").slice(0, limits.textChars);
  const headings = shown.filter((node) => node.matches("h1,h2,h3,h4,h5,h6,[role=heading]"));
  if (on("CF-101")) {
    const th = t("CF-101");
    for (const el of prose) {
      const text = sample(el);
      const widths = lines(el);
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (widths.length < th.minLines || !total) continue;
      const longest = Math.max(...widths.map((width) => Math.round(text.length * (width / total))));
      const cjk = cjkShare(text) > th.cjkShare;
      const max = cjk ? th.cjkMaxCh : th.latinMaxCh;
      if (longest > max) add("CF-101", { selector: selectorOf(el), value: `~${longest} chars on the longest line${cjk ? " (CJK)" : ""}`, threshold: `≤ ${max} (target ${th.targetCh}ch)` });
    }
  }
  if (on("CF-102")) {
    for (const el of headings) {
      if (lineCount(el) < 2) continue;
      const style = styleOf(el);
      const value = lineHeightRatio(el, style);
      const min = px(style.fontSize) >= t("CF-102").displayFontPx ? t("CF-102").displayMin : t("CF-102").min;
      if (value < min - 0.01 || value > t("CF-102").max + 0.01) add("CF-102", { selector: selectorOf(el), value: `line-height ${round(value)}`, threshold: `${min}-${t("CF-102").max}` });
    }
  }
  for (const el of textElements) {
    if (el.matches("h1,h2,h3,h4,h5,h6,[role=heading]")) continue;
    const count = lineCount(el);
    if (count < 2) continue;
    const value = lineHeightRatio(el, styleOf(el));
    if (proseSet.has(el)) {
      if (!on("CF-103")) continue;
      const cjk = cjkShare(sample(el)) > t("CF-103").cjkShare;
      const min = cjk ? t("CF-103").cjkMin : t("CF-103").latinMin;
      if (value < min - 0.01) add("CF-103", { selector: selectorOf(el), value: `line-height ${round(value)}${cjk ? " (CJK)" : ""}`, threshold: `≥ ${min} (target ${t("CF-103").target})` });
    } else if (on("CF-104") && count >= t("CF-104").minLines && value < t("CF-104").min - 0.01) {
      add("CF-104", { selector: selectorOf(el), value: `line-height ${round(value)} over ${count} lines`, threshold: `≥ ${t("CF-104").min}` });
    }
  }
  if (on("CF-105")) {
    const th = t("CF-105");
    // Wrap mode only matters once a heading wraps; a single-line heading is not scored.
    for (const el of headings.filter((node) => lineCount(node) >= 2)) {
      const style = styleOf(el);
      const mode = `${style.textWrap ?? ""} ${style.textWrapStyle ?? ""}`;
      if (!th.headingWrap.some((value) => mode.includes(value))) add("CF-105", { selector: selectorOf(el), value: `wraps to ${lineCount(el)} lines with text-wrap ${mode.trim() || "wrap"}`, threshold: `text-wrap: ${th.headingWrap.join(" or ")}` });
    }
    // The orphan half has no sourced cutoff: a reviewer's call.
    for (const el of prose) {
      const widths = lines(el);
      if (widths.length < 2) continue;
      const before = widths.slice(0, -1);
      const share = widths[widths.length - 1] / (before.reduce((sum, width) => sum + width, 0) / before.length);
      if (share < th.orphanShare) candidate("CF-105", { selector: selectorOf(el), value: `last line ${Math.round(share * 100)}% of the lines before it (possible orphan)` });
    }
  }

  // ---- CF-106: tabular figures in numeric columns ---------------------------------------------
  if (on("CF-106")) {
    const numeric = (text) => /\d/u.test(text) && /^[\s+\-−±()$€£¥₩%.,:\d０-９]*\d[\s+\-−±()$€£¥₩%.,:\d０-９A-Za-z가-힣]{0,6}$/u.test(text.trim());
    for (const table of shown.filter((el) => el.matches("table,[role=table],[role=grid]"))) {
      const rows = [...table.querySelectorAll("tr,[role=row]")];
      const width = Math.max(0, ...rows.map((row) => row.children.length));
      for (let column = 0; column < width; column += 1) {
        const cells = rows.map((row) => row.children[column]).filter((cell) => cell && cell.matches("td,[role=cell],[role=gridcell]"));
        const numbers = cells.filter((cell) => numeric(cell.innerText ?? ""));
        if (numbers.length < t("CF-106").minCells || numbers.length / Math.max(1, cells.length) < t("CF-106").numericShare) continue;
        const plain = numbers.filter((cell) => {
          const style = styleOf(cell.querySelector("*") ?? cell);
          return !/tabular-nums/u.test(style.fontVariantNumeric) && !/tnum/u.test(style.fontFeatureSettings) && !/mono/iu.test(style.fontFamily);
        });
        if (plain.length) add("CF-106", { selector: `${selectorOf(table)} column ${column + 1}`, value: `${plain.length} numeric cell(s) without tabular-nums`, threshold: "tabular-nums" });
      }
    }
  }

  // ---- CF-107: sentence case for UI labels ----------------------------------------------------
  if (on("CF-107")) {
    const th = t("CF-107");
    const functionWords = new Set(th.functionWords);
    const [minAcronym, maxAcronym] = th.acronymLetters;
    const acronym = new RegExp(`^\\p{Lu}{${minAcronym},${maxAcronym}}$`, "u");
    const home = [...body.querySelectorAll("a[href]")].find((a) => { try { return new URL(a.href).pathname.replace(/index\.html?$/u, "") === "/" && new URL(a.href).origin === location.origin; } catch { return false; } });
    const brand = new Set([document.title, document.querySelector("meta[property='og:site_name']")?.content, home ? accessibleName(home) : ""]
      .flatMap((text) => (text ?? "").split(/\s+/u)).map((word) => word.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean));
    const labels = new Set([...controls.filter(visible).filter((el) => !el.matches("input,select,textarea")), ...shown.filter((node) => node.matches("label,legend,[role=tab]"))]);
    for (const el of labels) {
      const text = (el.innerText ?? "").trim();
      const letters = text.match(/\p{L}/gu) ?? [];
      const cased = letters.filter((letter) => letter.toUpperCase() !== letter.toLowerCase());
      if (!letters.length || cased.length / letters.length <= th.casedShare) continue;
      const words = text.split(/\s+/u).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((word) => /\p{L}/u.test(word));
      if (words.length < 2) continue;
      const content = words.slice(1).filter((word) => !functionWords.has(word.toLowerCase()) && !acronym.test(word) && !/\p{Ll}\p{Lu}/u.test(word) && !/\d/u.test(word) && !brand.has(word));
      if (!content.length || !content.every((word) => /^\p{Lu}/u.test(word))) continue;
      add("CF-107", { tier: content.length === 1 ? "derived" : undefined, selector: selectorOf(el), value: `"${text.slice(0, 40)}" (capitalised: ${content.join(", ")})`, threshold: "sentence case", note: content.length === 1 ? "one capitalised word may be a proper noun" : undefined });
    }
  }

  // ---- CF-108: type-role and family census at the representative width ------------------------
  if (on("CF-108") && pass === "base" && String(vw) === t("CF-108").censusViewport) {
    const th = t("CF-108");
    const bucket = (weight) => (weight <= th.weightBuckets[0] ? "regular" : weight <= th.weightBuckets[1] ? "medium" : "bold");
    const sizes = new Map();
    const families = new Set();
    for (const el of textElements.filter((node) => !node.matches("input,select,textarea"))) {
      const style = styleOf(el);
      const family = style.fontFamily.split(",")[0].replace(/["']/gu, "").trim().toLowerCase();
      families.add(family);
      const key = `${family}|${bucket(Number(style.fontWeight))}`;
      sizes.set(key, [...(sizes.get(key) ?? []), Math.round(px(style.fontSize))]);
    }
    let roles = 0;
    for (const list of sizes.values()) {
      const sorted = [...new Set(list)].sort((a, b) => a - b);
      roles += sorted.filter((size, index) => index === 0 || size - sorted[index - 1] > 1).length;
    }
    const mono = [...families].filter((family) => /mono|courier|consolas|menlo/u.test(family)).length;
    if (roles > th.maxRoles || families.size - mono > th.maxFamilies || mono > th.maxMono) {
      add("CF-108", { selector: "body", value: `${roles} type roles, ${families.size - mono} families + ${mono} mono (${[...families].join(", ").slice(0, 60)})`, threshold: `≤ ${th.maxRoles} roles, ≤ ${th.maxFamilies} families + ${th.maxMono} mono` });
    }
  }

  // ---- CF-201 / CF-204 / CF-807: contrast (APCA advisory in the note) -------------------------
  if (on("CF-201")) {
    const th = t("CF-201");
    let overlapped = 0;
    let overImage = 0;
    const seen = new Set();
    for (const el of textElements) {
      if (el.closest(":disabled,[aria-disabled='true'],[inert]")) continue;
      const style = styleOf(el);
      const fg = parseColor(style.color);
      if (!fg) continue;
      const behind = paintBehind(el);
      if (behind.overlap) { overlapped += 1; continue; }
      if (behind.image) { overImage += 1; continue; }
      const size = px(style.fontSize);
      const large = size >= th.largeFontPx || (size >= th.boldLargeFontPx && Number(style.fontWeight) >= th.boldWeight);
      const alpha = fg.a * opacityChain(el);
      if (behind.gradient) {
        if (!on("CF-204")) continue;
        const floor = large ? t("CF-204").large : t("CF-204").body;
        const worst = Math.min(...behind.gradient.map((stop) => ratio(blend({ ...fg, a: alpha }, stop), stop)));
        if (worst + 1e-9 < floor) add("CF-204", { severity: large ? th.largeSeverity : undefined, selector: selectorOf(el), value: `${round(worst)}:1 at the worst gradient stop "${snippet(el, 30)}"`, threshold: `≥ ${floor}:1` });
        continue;
      }
      const bg = behind.color;
      const text = blend({ ...fg, a: alpha }, bg);
      const floor = large ? th.large : th.body;
      const value = ratio(text, bg);
      const key = `${selectorOf(el)}|${Math.round(value * 100)}`;
      if (value + 1e-9 < floor && !seen.has(key)) {
        seen.add(key);
        add("CF-201", { severity: large ? th.largeSeverity : undefined, selector: selectorOf(el), value: `${round(value)}:1 "${snippet(el, 30)}"`, threshold: `≥ ${floor}:1`, note: `APCA Lc ${round(apca(text, bg), 1)} (advisory)` });
      }
    }
    if (overlapped) skip("CF-201", `${overlapped} text element(s) with another element painted on top; contrast not sampled`);
    if (overImage) skip("CF-204", `${overImage} text element(s) over an image or media box; not pixel-sampled`);
  }
  if (on("CF-807")) {
    for (const field of shown.filter((el) => el.matches("input[placeholder],textarea[placeholder]") && el.placeholder)) {
      const fg = parseColor(getComputedStyle(field, "::placeholder").color);
      const own = parseColor(styleOf(field).backgroundColor);
      const surface = own && own.a >= 0.999 ? own : solidBehind(field);
      if (!fg || !surface) continue;
      const value = ratio(blend(fg, surface), surface);
      if (value < t("CF-807").min) add("CF-807", { selector: selectorOf(field), value: `${round(value)}:1`, threshold: `≥ ${t("CF-807").min}:1` });
    }
  }

  // ---- CF-205: one accent per view (semantic status fills excluded) ---------------------------
  if (on("CF-205")) {
    const th = t("CF-205");
    const tokens = new Set(th.statusTokens);
    const statusLike = (el) => {
      if (el.closest("[role=status],[role=alert],[role=alertdialog],[role=log],[aria-live=polite],[aria-live=assertive],[aria-invalid=true]")) return true;
      for (let node = el; node && node !== body; node = node.parentElement) if (classTokens(node).some((token) => tokens.has(token))) return true;
      return false;
    };
    const clusters = [];
    for (const el of shown) {
      const rect = el.getBoundingClientRect();
      if (rect.width < th.minSurfacePx || rect.height < th.minSurfacePx || rect.width > vw * 0.9) continue;
      if (rect.height <= th.maxPillPx && px(styleOf(el).borderTopLeftRadius) >= rect.height / 2 - 1) continue;
      const fill = parseColor(styleOf(el).backgroundColor);
      if (!fill || fill.a < 0.9) continue;
      const tone = hsl(fill);
      if (tone.s < th.minSaturation || tone.l < th.minLightness || tone.l > th.maxLightness || statusLike(el)) continue;
      const cluster = clusters.find((entry) => hueDistance(entry.h, tone.h) <= th.hueToleranceDeg);
      if (cluster) cluster.count += 1; else clusters.push({ h: tone.h, count: 1, el });
    }
    if (clusters.length > th.maxClusters) {
      add("CF-205", { selector: clusters.map((entry) => selectorOf(entry.el)).slice(0, 3).join(" | "), value: `${clusters.length} saturated hue clusters (${clusters.map((entry) => `${Math.round(entry.h)}°`).join(", ")})`, threshold: `≤ ${th.maxClusters}` });
    }
  }

  // ---- CF-301: spacing on the 4px scale ----------------------------------------------------------
  if (on("CF-301")) {
    const th = t("CF-301");
    const off = new Map();
    for (const el of shown) {
      const style = styleOf(el);
      const values = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft, style.rowGap, style.columnGap, style.marginTop, style.marginBottom];
      const parent = el.parentElement;
      const centred = parent && Math.abs(px(style.marginLeft) - px(style.marginRight)) <= th.tolerancePx && el.getBoundingClientRect().width < parent.getBoundingClientRect().width - 1;
      if (!centred) values.push(style.marginLeft, style.marginRight);
      for (const raw of values) {
        const value = Math.abs(px(raw));
        if (value < th.minPx) continue;
        const rest = value % th.stepPx;
        if (Math.min(rest, th.stepPx - rest) > th.tolerancePx && !off.has(round(value, 1))) off.set(round(value, 1), el);
      }
    }
    if (off.size) {
      add("CF-301", {
        severity: off.size > th.lowMax ? th.manySeverity : undefined,
        selector: [...off.values()].slice(0, 3).map(selectorOf).join(" | "),
        value: `${off.size} off-scale value(s): ${[...off.keys()].sort((a, b) => a - b).slice(0, 8).map((value) => `${value}px`).join(", ")}`,
        threshold: `within ±${th.tolerancePx}px of a ${th.stepPx}px multiple`,
      });
    }
  }

  // ---- CF-304: heading rhythm (a clear inversion only) ------------------------------------------
  if (on("CF-304")) {
    const th = t("CF-304");
    const inFlow = (node) => visible(node) && !/(absolute|fixed)/u.test(styleOf(node).position);
    const bounded = (node) => { const style = styleOf(node); return (parseColor(style.backgroundColor)?.a ?? 0) > 0 || px(style.borderTopWidth) > 0 || style.boxShadow !== "none" || style.backgroundImage !== "none"; };
    const overlapsX = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left);
    for (const heading of headings) {
      const hr = heading.getBoundingClientRect();
      let next = heading.nextElementSibling;
      while (next && !inFlow(next)) next = next.nextElementSibling;
      if (!next) continue;
      const below = next.getBoundingClientRect().top - hr.bottom;
      let top = hr.top;
      let start = heading;
      const label = heading.previousElementSibling;
      if (label && inFlow(label)) {
        const lr = label.getBoundingClientRect();
        if (lr.height <= th.labelMaxPx && hr.top - lr.bottom < th.labelGapPx && lr.bottom <= hr.top + 1) { top = lr.top; start = label; }
      }
      let previous = null;
      for (let node = start; node && node !== body && !previous;) {
        for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
          if (inFlow(sibling) && overlapsX(sibling.getBoundingClientRect(), hr)) { previous = sibling; break; }
        }
        if (previous) break;
        const parent = node.parentElement;
        if (!parent || parent === body || bounded(parent)) break;
        node = parent;
      }
      if (!previous) continue;
      const above = top - previous.getBoundingClientRect().bottom;
      if (above < th.ratio * below && below - above >= th.deficitPx) add("CF-304", { selector: selectorOf(heading), value: `${round(above, 0)}px above, ${round(below, 0)}px below`, threshold: `above ≥ ${th.ratio} × below` });
    }
  }

  // ---- CF-401: concentric radius, compared per corner --------------------------------------------
  if (on("CF-401")) {
    const th = t("CF-401");
    const cap = (value, rect) => Math.min(value, Math.min(rect.width, rect.height) / 2);
    const corners = [["TopLeft", "Top", "Left"], ["TopRight", "Top", "Right"], ["BottomRight", "Bottom", "Right"], ["BottomLeft", "Bottom", "Left"]];
    for (const parent of shown) {
      const ps = styleOf(parent);
      if (corners.every(([corner]) => px(ps[`border${corner}Radius`]) <= 0)) continue;
      const pr = parent.getBoundingClientRect();
      for (const child of [...parent.children].filter(visible)) {
        const cs = styleOf(child);
        const cr = child.getBoundingClientRect();
        if (Math.min(cr.width, cr.height) <= th.minChildPx) continue;
        for (const [corner, v, h] of corners) {
          const outer = px(ps[`border${corner}Radius`]);
          const inner = px(cs[`border${corner}Radius`]);
          const padV = px(ps[`padding${v}`]);
          const padH = px(ps[`padding${h}`]);
          if (outer <= 0 || inner <= 0 || padV <= 0 || Math.abs(padV - padH) > 1 || padV > th.maxParentPaddingPx) continue;
          const edgeV = px(ps[`border${v}Width`]) + padV;
          const edgeH = px(ps[`border${h}Width`]) + padH;
          const reachV = v === "Top" ? Math.abs(cr.top - pr.top - edgeV) : Math.abs(pr.bottom - cr.bottom - edgeV);
          const reachH = h === "Left" ? Math.abs(cr.left - pr.left - edgeH) : Math.abs(pr.right - cr.right - edgeH);
          if (reachV > th.edgeTolerancePx || reachH > th.edgeTolerancePx) continue;
          const expected = Math.max(0, cap(outer, pr) - padV);
          if (Math.abs(cap(inner, cr) - expected) > th.tolerancePx) {
            add("CF-401", { selector: selectorOf(child), value: `${corner} inner ${round(inner, 1)}px in outer ${round(outer, 1)}px with ${round(padV, 1)}px padding`, threshold: `inner ≈ ${round(expected, 1)}px (±${th.tolerancePx})` });
            break;
          }
        }
      }
    }
  }

  // ---- CF-403: hard offset shadow outside an evidenced register ----------------------------------
  if (on("CF-403")) {
    const th = t("CF-403");
    const hard = shown.filter((el) => shadowsOf(styleOf(el).boxShadow).some((s) => !s.inset && s.blur === 0 && s.spread === 0 && (Math.abs(s.x) > th.hairlinePx || Math.abs(s.y) > th.hairlinePx) && s.color));
    const bordered = hard.filter((el) => { const style = styleOf(el); return style.borderTopStyle === "solid" && px(style.borderTopWidth) >= th.registerBorderPx; });
    if (hard.length && bordered.length < th.registerCount) {
      for (const el of hard) add("CF-403", { selector: selectorOf(el), value: `hard offset shadow ${styleOf(el).boxShadow.slice(0, 40)}`, threshold: `soft shadow, or ≥ ${th.registerCount} bordered elements sharing it (a register)` });
    }
  }

  // ---- CF-404 / SLOP-010: one glow test, each glowing element reported once -------------------
  const glowOf = (el) => {
    const th = t("CF-404");
    const style = styleOf(el);
    const passes = (s) => s.color && Math.abs(s.x) <= th.maxOffsetPx && Math.abs(s.y) <= th.maxOffsetPx && s.blur >= th.minBlurPx && hsl(s.color).s > th.minSaturation && s.color.a >= th.minAlpha;
    const shadow = shadowsOf(style.boxShadow).find((s) => !s.inset && passes(s));
    if (shadow) return `${round(shadow.blur, 0)}px coloured blur`;
    const drop = /drop-shadow\((.*)\)/u.exec(style.filter);
    if (drop) {
      const [x = 0, y = 0, blur = 0] = lengthsIn(drop[1]);
      if (passes({ x, y, blur, color: colorsIn(drop[1])[0] ?? null })) return `${round(blur, 0)}px coloured drop-shadow`;
    }
    return null;
  };
  if (on("CF-404") || on("SLOP-010")) {
    const glowing = [...new Set([...controls.filter(visible), ...shown.filter((el) => el.matches("h1,h2,h3"))])]
      .map((el) => ({ el, glow: glowOf(el) }))
      .filter((entry) => entry.glow);
    const unrelated = glowing.filter((entry, index) => !glowing.some((other, otherIndex) => otherIndex < index && related(other.el, entry.el)));
    if (unrelated.length >= t("SLOP-010").recurCount) {
      for (const { el, glow } of unrelated) add("SLOP-010", { selector: selectorOf(el), value: `${glow} (on ${unrelated.length} unrelated elements)`, threshold: `< ${t("SLOP-010").recurCount} glowing elements` });
    } else {
      for (const { el, glow } of unrelated.filter((entry) => isPrimary(entry.el) || entry.el.matches("h1,h2,h3"))) add("CF-404", { selector: selectorOf(el), value: glow, threshold: `no chromatic blur ≥ ${t("CF-404").minBlurPx}px` });
    }
  }

  // ---- CF-406: blurred scrim -----------------------------------------------------------------
  if (on("CF-406")) {
    for (const el of shown) {
      const style = styleOf(el);
      if (!/blur\(/u.test(`${style.backdropFilter ?? ""} ${style.webkitBackdropFilter ?? ""}`) || !/(fixed|absolute)/u.test(style.position)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width >= vw * t("CF-406").minCover && rect.height >= vh * t("CF-406").minCover) add("CF-406", { selector: selectorOf(el), value: style.backdropFilter, threshold: "solid scrim" });
    }
  }

  // ---- motion: CF-502 / CF-503 / CF-505 / CF-507 / CF-508 / SLOP-061 ---------------------------
  const scaleStart = (transform, scaleProp) => {
    if (scaleProp && scaleProp !== "none") {
      const values = scaleProp.split(/\s+/u).map(Number).filter(Number.isFinite);
      if (values.length) return Math.min(...values);
    }
    const match = /scale(?:3d|X|Y)?\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?/u.exec(transform ?? "");
    if (!match) return null;
    return Math.min(Number(match[1]), match[2] === undefined ? Number(match[1]) : Number(match[2]));
  };
  const overshoots = (timing) => {
    const { minControl, maxControl } = t("CF-505");
    const out = (value) => value < minControl || value > maxControl;
    for (const curve of timing.matchAll(/cubic-bezier\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/gu)) {
      if (out(Number(curve[1])) || out(Number(curve[2]))) return true;
    }
    for (const curve of timing.matchAll(/linear\(([^()]*)\)/gu)) {
      if (curve[1].split(",").map((stop) => parseFloat(stop.trim())).some((value) => Number.isFinite(value) && out(value))) return true;
    }
    return false;
  };
  const nameTokens = (name) => name.split(/[-_\s,]+|(?<=\p{Ll})(?=\p{Lu})/u).map((token) => token.toLowerCase());
  const animationNamesOf = (el) => styleOf(el).animationName.split(",").map((name) => name.trim());
  const runningNames = new Set(document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target && visible(a.effect.target)).map((a) => a.animationName).filter(Boolean));
  const usedNames = new Set(shown.flatMap(animationNamesOf));
  for (const [name, rule] of keyframes) {
    if (!usedNames.has(name)) continue;
    for (const frame of rule.cssRules) {
      if (on("CF-503") && /^(0%|from)$/u.test(frame.keyText.trim())) {
        const start = scaleStart(frame.style.transform, frame.style.scale);
        if (start !== null && start < t("CF-503").minScale) {
          const running = runningNames.has(name);
          const target = shown.find((el) => animationNamesOf(el).includes(name));
          const icon = target && target.getBoundingClientRect().width <= t("CF-503").iconMaxPx && (target.matches("svg,i,img") || target.querySelector("svg"));
          if (!icon) add("CF-503", { severity: running ? undefined : t("CF-503").declaredSeverity, tier: running ? "measured" : "derived", selector: `@keyframes ${name}`, value: `starts at scale ${start}${running ? " (running)" : " (applied, not running now)"}`, threshold: `≥ ${t("CF-503").minScale}` });
        }
      }
      if (on("CF-508")) {
        const moved = t("CF-508").properties.filter((property) => [...frame.style].some((prop) => prop === property || prop.startsWith(`${property}-`)));
        if (moved.length) add("CF-508", { selector: `@keyframes ${name}`, value: `animates ${moved.join(", ")}`, threshold: "transform/opacity only" });
      }
      if (on("SLOP-061") && /translateX\(\s*-?(100|50)%/u.test(frame.style.transform ?? "")) {
        const target = shown.find((el) => animationNamesOf(el).includes(name) && styleOf(el).animationIterationCount === "infinite" && (el.innerText ?? "").trim());
        if (target && !document.querySelector("[aria-label*=pause i],[aria-label*=정지]")) add("SLOP-061", { selector: selectorOf(target), value: `@keyframes ${name} loops text sideways`, threshold: "static row or a pause control" });
      }
    }
  }
  if (on("CF-505")) {
    const tokens = new Set(t("CF-505").nameTokens);
    for (const rule of [...styleRules, ...[...keyframes.values()].flatMap((kf) => [...kf.cssRules])]) {
      const timing = `${rule.style.animationTimingFunction ?? ""} ${rule.style.transitionTimingFunction ?? ""}`;
      const where = rule.selectorText ?? `@keyframes ${rule.parentRule?.name ?? ""} ${rule.keyText ?? ""}`;
      if (overshoots(timing)) add("CF-505", { selector: where, value: timing.trim().replace(/\s+/gu, " ").slice(0, 60), threshold: `y control points within ${t("CF-505").minControl}..${t("CF-505").maxControl}` });
      const name = rule.style.animationName ?? "";
      const hit = name && name !== "none" && nameTokens(name).find((token) => tokens.has(token));
      if (hit) add("CF-505", { tier: "derived", selector: where, value: `animation-name ${name}`, threshold: "no bounce or spring on feedback" });
    }
    for (const animation of document.getAnimations()) {
      const easing = animation.effect?.getTiming?.().easing ?? "";
      if (overshoots(easing) && animation.effect?.target) add("CF-505", { selector: selectorOf(animation.effect.target), value: `running easing ${easing.slice(0, 50)}`, threshold: `y control points within ${t("CF-505").minControl}..${t("CF-505").maxControl}` });
    }
  }
  if (on("CF-503")) {
    for (const animation of document.getAnimations()) {
      if (typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation) continue;
      const target = animation.effect?.target;
      const first = animation.effect?.getKeyframes?.()[0];
      const start = first ? scaleStart(first.transform, first.scale) : null;
      if (target && start !== null && start < t("CF-503").minScale && visible(target)) add("CF-503", { tier: "measured", selector: selectorOf(target), value: `script animation starts at scale ${start}`, threshold: `≥ ${t("CF-503").minScale}` });
    }
  }
  if (on("CF-508")) {
    for (const el of shown) {
      const style = styleOf(el);
      if (style.transitionProperty === "none" || style.transitionProperty === "all" || Math.max(...ms(style.transitionDuration)) === 0) continue;
      if (el.matches("details,[aria-expanded],[class*=accordion],[class*=collapse]") || el.closest("details,[aria-expanded]")) continue;
      const moved = style.transitionProperty.split(",").map((part) => part.trim()).filter((property) => t("CF-508").properties.some((name) => property === name || property.startsWith(`${name}-`) || property === `max-${name}`));
      if (moved.length) add("CF-508", { selector: selectorOf(el), value: `transitions ${moved.join(", ")}`, threshold: "transform/opacity only" });
    }
  }
  if (on("CF-502")) {
    const th = t("CF-502");
    const active = styleRules.filter((rule) => /:active(?![\w-])/u.test(rule.selectorText ?? ""));
    let unread = 0;
    for (const el of standalone.filter((node) => node.matches("button,a[href],[role=button]")).slice(0, th.sample)) {
      const rule = active.find((candidateRule) => selectorParts(candidateRule).some((part) => part.includes(":active") && safeMatches(el, stripPseudo(part, "active"))));
      if (!rule) { unread += 1; continue; }
      const scale = scaleStart(rule.style.transform, rule.style.scale);
      const style = styleOf(el);
      const properties = style.transitionProperty.split(",").map((part) => part.trim());
      const durations = ms(style.transitionDuration);
      const duration = Math.max(0, ...properties.map((property, index) => (/^(all|transform|scale)$/u.test(property) ? durations[index % durations.length] : 0)));
      if (scale !== null && (scale < th.minScale - 1e-6 || scale > th.maxScale + 1e-6)) add("CF-502", { selector: selectorOf(el), value: `:active scale ${scale}`, threshold: `${th.minScale}-${th.maxScale}` });
      if (duration > th.maxMs) add("CF-502", { selector: selectorOf(el), value: `press transition ${round(duration, 0)}ms`, threshold: `≤ ${th.maxMs}ms` });
    }
    if (unread) skip("CF-502", `${unread} sampled control(s) have no readable :active rule`);
  }
  if (on("CF-507")) {
    const th = t("CF-507");
    const wrongOf = (value) => value.split(",").map((part) => part.trim()).filter((part) => part && part !== "auto" && !th.allowed.includes(part));
    // Resting pass only: a hint set on hover or focus is never "left on at rest".
    const animated = new Set(document.getAnimations().filter((a) => a.playState === "running").map((a) => a.effect?.target).filter(Boolean));
    for (const el of shown) {
      const value = styleOf(el).willChange;
      if (!value || value === "auto") continue;
      const wrong = wrongOf(value);
      if (wrong.length) add("CF-507", { selector: selectorOf(el), value: `will-change: ${value}`, threshold: th.allowed.join("/") });
      else if (!animated.has(el)) add("CF-507", { severity: th.atRestSeverity, selector: selectorOf(el), value: `will-change: ${value} with no animation running`, threshold: "only while animating" });
    }
    for (const rule of styleRules.filter((candidateRule) => /:(hover|focus|focus-within)(?![\w-])/u.test(candidateRule.selectorText ?? "") && candidateRule.style.willChange)) {
      const wrong = wrongOf(rule.style.willChange);
      if (wrong.length) add("CF-507", { selector: rule.selectorText, value: `will-change: ${rule.style.willChange} in a state rule`, threshold: th.allowed.join("/") });
    }
  }

  // ---- CF-202: focus indicator (in-page focus, confirmed :focus-visible) ------------------------
  if (on("CF-202")) {
    const th = t("CF-202");
    const snapshot = (el) => {
      const s = styleOf(el);
      return {
        outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`,
        shadow: s.boxShadow,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor} ${s.borderRightColor} ${s.borderBottomColor} ${s.borderLeftColor}`,
        background: s.backgroundColor,
        outlineStyle: s.outlineStyle, outlineWidth: px(s.outlineWidth), outlineColor: s.outlineColor, outlineOffset: px(s.outlineOffset),
        borderWidth: px(s.borderTopWidth), borderColor: s.borderTopColor,
      };
    };
    const before = document.activeElement;
    const [sx, sy] = [window.scrollX, window.scrollY];
    let unverified = 0;
    let sampled = 0;
    for (const el of focusables.filter(visible)) {
      if (sampled >= th.sample) break;
      try { el.focus({ preventScroll: true }); } catch { continue; }
      if (document.activeElement !== el) continue;
      sampled += 1;
      const visibleFocus = el.matches(":focus-visible");
      const focused = snapshot(el);
      el.blur();
      if (!visibleFocus) { unverified += 1; continue; }
      const rest = snapshot(el);
      const changed = ["outline", "shadow", "border", "background"].filter((key) => focused[key] !== rest[key]);
      if (!changed.length) {
        add("CF-202", { selector: selectorOf(el), value: "focus changes no outline, shadow, border or background", threshold: "a visible focus change" });
        continue;
      }
      if (focused.outlineStyle === "auto") continue;
      let width = 0;
      let color = null;
      if (changed.includes("outline") && focused.outlineStyle !== "none") { width = focused.outlineWidth; color = parseColor(focused.outlineColor); }
      else if (changed.includes("shadow")) {
        const rings = shadowsOf(focused.shadow).filter((s) => s.color);
        width = Math.max(0, ...rings.map((s) => s.spread + (s.inset ? 0 : s.blur / 4)));
        color = rings[0]?.color ?? null;
      } else if (changed.includes("border")) { width = focused.borderWidth; color = parseColor(focused.borderColor); }
      else continue;
      const outside = solidBehind(el, { skipSelf: true }) ?? canvasColor;
      const surfaces = focused.outlineOffset <= 0 && changed.includes("outline") ? [outside, solidBehind(el) ?? outside] : [outside];
      const contrast = color ? Math.min(...surfaces.map((surface) => ratio(blend(color, surface), surface))) : 0;
      if (width < th.minWidthPx || contrast < th.minContrast) {
        add("CF-202", { severity: th.weakSeverity, selector: selectorOf(el), value: `custom ring ${round(width, 1)}px at ${round(contrast)}:1`, threshold: `≥ ${th.minWidthPx}px and ≥ ${th.minContrast}:1` });
      }
    }
    try { if (before && before !== body && typeof before.focus === "function") before.focus({ preventScroll: true }); else document.activeElement?.blur?.(); } catch { /* focus restore is best effort */ }
    window.scrollTo(sx, sy);
    if (unverified) skip("CF-202", `${unverified} control(s) did not reach :focus-visible from in-page focus`);
  }

  // ---- CF-603 / CF-701 / CF-702 / CF-703 / CF-806: controls -------------------------------------
  if (on("CF-603")) {
    for (const el of focusables) {
      if (!visible(el) && !(el.labels?.length && visible(el.labels[0]))) continue;
      if (!accessibleName(el)) add("CF-603", { selector: selectorOf(el), value: "no accessible name", threshold: "text, aria-label or aria-labelledby" });
    }
  }
  const targetRect = (control) => {
    const el = !visible(control) && control.labels?.length && visible(control.labels[0]) ? control.labels[0] : control;
    let rect = el.getBoundingClientRect();
    if (control.matches("input[type=checkbox],input[type=radio]") && control.labels?.length) {
      const label = control.labels[0].getBoundingClientRect();
      const left = Math.min(rect.left, label.left); const top = Math.min(rect.top, label.top);
      const right = Math.max(rect.right, label.right); const bottom = Math.max(rect.bottom, label.bottom);
      rect = { left, top, right, bottom, width: right - left, height: bottom - top };
    }
    return { el, rect };
  };
  const targets = standalone.map((control) => ({ control, ...targetRect(control) }));
  const spacedOut = (target) => {
    const d = t("CF-701").spacingCirclePx;
    const cx = target.rect.left + target.rect.width / 2;
    const cy = target.rect.top + target.rect.height / 2;
    return targets.every((other) => {
      if (other === target || related(other.control, target.control)) return true;
      const r = other.rect;
      const nx = Math.max(r.left, Math.min(cx, r.right));
      const ny = Math.max(r.top, Math.min(cy, r.bottom));
      const toBox = Math.hypot(cx - nx, cy - ny);
      const toCircle = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
      return toBox >= d / 2 && (Math.min(r.width, r.height) >= d || toCircle >= d);
    });
  };
  for (const target of targets) {
    const { control, el, rect } = target;
    if (on("CF-806") && control.matches("input[placeholder],textarea[placeholder]") && !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby") && !control.getAttribute("title")) {
      add("CF-806", { selector: selectorOf(control), value: `only a placeholder ("${control.placeholder.slice(0, 30)}")`, threshold: "a real label" });
    }
    const size = Math.min(rect.width, rect.height);
    const dims = `${round(rect.width, 1)}×${round(rect.height, 1)}px "${snippet(el, 24)}"`;
    if (on("CF-703") && destructive(control) && size + 0.5 < t("CF-703").minPx) {
      add("CF-703", { selector: selectorOf(el), value: dims, threshold: `≥ ${t("CF-703").minPx}px` });
      continue;
    }
    if (!on("CF-701")) continue;
    const th = t("CF-701");
    const spaced = size + 0.5 < th.floorPx && spacedOut(target);
    if (size + 0.5 < th.floorPx && !spaced) add("CF-701", { selector: selectorOf(el), value: dims, threshold: `≥ ${th.floorPx}px (no spacing exception)` });
    else if (touch && size + 0.5 < th.touchPx) add("CF-701", { severity: isPrimary(control) ? "HIGH" : th.touchSeverity, selector: selectorOf(el), value: `${dims} on a touch width${isPrimary(control) ? " (primary action)" : ""}`, threshold: `≥ ${th.touchPx}px`, note: spaced ? "under 24px; WCAG 2.5.8 spacing exception holds" : undefined });
  }
  if (on("CF-702")) {
    const gapFloor = touch ? t("CF-702").touchGapPx : t("CF-702").fineGapPx;
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        const a = targets[i]; const b = targets[j];
        if (related(a.control, b.control) || related(a.el, b.el)) continue;
        const ra = a.rect; const rb = b.rect;
        const dx = Math.max(rb.left - ra.right, ra.left - rb.right);
        const dy = Math.max(rb.top - ra.bottom, ra.top - rb.bottom);
        const gap = dx >= 0 && dy < 0 ? dx : dy >= 0 && dx < 0 ? dy : null;
        if (gap !== null && gap + 0.5 < gapFloor) add("CF-702", { selector: `${selectorOf(a.el)} × ${selectorOf(b.el)}`, value: `${round(gap, 1)}px apart`, threshold: `≥ ${gapFloor}px` });
      }
    }
  }

  // ---- CF-704: controls revealed only by an ancestor :hover (stylesheet scan) ------------------
  if (on("CF-704")) {
    const shownBy = (style) => (style.opacity && Number(style.opacity) > 0) || style.visibility === "visible" || (style.display && style.display !== "none");
    const hidden = (el) => { const style = styleOf(el); return Number(style.opacity) === 0 || style.visibility === "hidden" || style.display === "none"; };
    const focusRules = styleRules.filter((rule) => /:(focus-within|focus-visible|focus)(?![\w-])/u.test(rule.selectorText ?? ""));
    const reported = new Set();
    for (const rule of styleRules) {
      if (!shownBy(rule.style)) continue;
      for (const part of selectorParts(rule).filter((text) => /:hover(?![\w-])\s*[>~+ ]\s*\S/u.test(text))) {
        const target = stripPseudo(part, "hover");
        let matches = [];
        try { matches = [...body.querySelectorAll(target)].slice(0, 50); } catch { continue; }
        for (const el of matches) {
          if (reported.has(el) || !hidden(el) || !(el.matches(controlSelector) || el.querySelector(controlSelector))) continue;
          const alsoOnFocus = focusRules.some((focusRule) => shownBy(focusRule.style) && selectorParts(focusRule).some((focusPart) => safeMatches(el, focusPart.replace(/:(focus-within|focus-visible|focus)(?![\w-])/gu, ""))));
          if (alsoOnFocus) continue;
          reported.add(el);
          add("CF-704", { selector: selectorOf(el), value: `shown only by "${part.slice(0, 60)}"`, threshold: "also revealed on :focus-within or :focus-visible" });
        }
      }
    }
  }

  // ---- CF-506: repeated controls the driver hovers after this read ---------------------------
  const hoverTargets = [];
  if (options.hoverSample > 0) {
    const listLike = (node) => node.matches("ul,ol,table,tbody,[role=list],[role=grid],[role=listbox],[role=table]") || /(auto|scroll)/u.test(`${styleOf(node).overflowX} ${styleOf(node).overflowY}`);
    const groups = new Map();
    for (const el of standalone) {
      let container = null;
      for (let node = el.parentElement; node && node !== body; node = node.parentElement) if (listLike(node)) { container = node; break; }
      if (!container) continue;
      const key = `${el.tagName}|${classTokens(el).sort().join(".")}`;
      groups.set(key, [...(groups.get(key) ?? []), el]);
    }
    const repeated = [...groups.values()].filter((list) => list.length >= t("CF-506").minRepeats).flat();
    repeated.slice(0, options.hoverSample).forEach((el, index) => {
      el.setAttribute("data-litgravity-probe-hover", String(index));
      hoverTargets.push({ selector: `[data-litgravity-probe-hover="${index}"]`, name: selectorOf(el) });
    });
  }

  // ---- slop register: surfaces and type ---------------------------------------------------------
  const clippedToText = (style) => /text/u.test(`${style.backgroundClip} ${style.webkitBackgroundClip ?? ""}`);
  if (on("SLOP-009")) {
    for (const el of textElements) {
      const style = styleOf(el);
      if (clippedToText(style) && /gradient\(/u.test(style.backgroundImage)) add("SLOP-009", { selector: selectorOf(el), value: `"${snippet(el, 30)}" filled with a gradient`, threshold: "solid text colour" });
    }
  }
  let bannedHue = false;
  if (on("SLOP-008")) {
    const th = t("SLOP-008");
    const inBand = (c) => { const tone = hsl(c); return spread(c) >= th.minChannelSpread && tone.h >= th.hueMin && tone.h <= th.hueMax; };
    const brandRegions = new Set(controls.filter(visible).filter((el) => { const fill = parseColor(styleOf(el).backgroundColor); return fill && fill.a > 0.9 && inBand(fill); }).map((el) => el.closest("header,nav,main,section,footer,aside") ?? body));
    if (brandRegions.size < 2) {
      for (const el of shown) {
        const style = styleOf(el);
        if (/gradient\(/u.test(style.backgroundImage)) {
          const stops = colorsIn(style.backgroundImage);
          if (stops.some(inBand)) { bannedHue = true; add("SLOP-008", { selector: selectorOf(el), value: `gradient stops ${stops.map((c) => `${Math.round(hsl(c).h)}°`).join(" → ")}`, threshold: `no stop in ${th.hueMin}-${th.hueMax}° with channel spread ≥ ${th.minChannelSpread}` }); }
        }
        const heading = el.matches("h1,h2,h3") || (directText(el).length && px(style.fontSize) >= th.headingFontPx);
        const ink = parseColor(style.color);
        if (heading && ink && ink.a > 0.5 && inBand(ink)) { bannedHue = true; add("SLOP-008", { selector: selectorOf(el), value: `heading text ${Math.round(hsl(ink).h)}°`, threshold: `outside ${th.hueMin}-${th.hueMax}°` }); }
      }
    }
  }
  let blob = false;
  if (on("SLOP-011")) {
    for (const el of shown) {
      const style = styleOf(el);
      if (!/(absolute|fixed)/u.test(style.position) || !/radial-gradient/u.test(style.backgroundImage)) continue;
      if ((el.innerText ?? "").trim() || el.querySelector("img,svg,video,canvas,input,select,textarea,button,a[href]")) continue;
      const faint = Number(style.opacity) < t("SLOP-011").maxOpacity || colorsIn(style.backgroundImage).every((c) => c.a < t("SLOP-011").maxOpacity);
      if (faint) { blob = true; candidate("SLOP-011", { selector: selectorOf(el), value: "unbound faint radial gradient" }); }
    }
  }
  if (on("SLOP-012") && (blob || bannedHue)) {
    const th = t("SLOP-012");
    for (const el of shown) {
      const style = styleOf(el);
      const layers = style.backgroundImage.split(/,(?![^()]*\))/u).filter((layer) => /gradient\(/u.test(layer));
      const cells = style.backgroundSize.split(",").map((size) => size.trim().split(/\s+/u).map(px));
      const cell = cells.find((pair) => pair.length && pair.every((value) => value > 0 && value <= th.maxCellPx) && /px/u.test(style.backgroundSize));
      const pattern = (layers.filter((layer) => /linear-gradient/u.test(layer)).length >= 2 || layers.some((layer) => /radial-gradient/u.test(layer))) && cell;
      if (!pattern) continue;
      const scope = el.closest("section,main,header,footer,aside,nav,article,[role=region]") ?? body;
      const data = scope.querySelector("canvas,table,[role=table],[role=grid],[role=img]") || [...scope.querySelectorAll("svg")].some((svg) => { const r = svg.getBoundingClientRect(); return r.width > th.dataSvgPx && r.height > th.dataSvgPx; });
      if (!data) add("SLOP-012", { selector: selectorOf(el), value: `${cell.join("×")}px pattern cell beside other decoration`, threshold: "no decorative grid without a data referent" });
    }
  }
  if (on("SLOP-015")) {
    const th = t("SLOP-015");
    const status = "[role=status],[role=alert],[role=alertdialog],[role=log],[aria-live=polite],[aria-live=assertive],[role=note]";
    const callout = /(callout|admonition|alert|notice)/iu;
    const chromatic = (c) => c && hsl(c).s > th.minSaturation;
    const scopes = new Map();
    const count = (el, variant) => { const key = el.parentElement ?? body; const entry = scopes.get(key) ?? { a: [], b: [], c: [] }; entry[variant].push(el); scopes.set(key, entry); };
    for (const el of shown) {
      const style = styleOf(el);
      if (el.closest(status) || callout.test(classText(el))) continue;
      const rounded = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].some((corner) => px(style[`border${corner}Radius`]) > 0);
      if (rounded) {
        const sides = ["Top", "Right", "Bottom", "Left"].map((side) => ({ width: px(style[`border${side}Width`]), color: parseColor(style[`border${side}Color`]) }));
        const accents = sides.filter((side) => side.width >= th.minStripePx && chromatic(side.color));
        const quiet = sides.filter((side) => side.width === 0 || (side.width <= th.neutralSidePx && !chromatic(side.color)));
        if (accents.length === 1 && quiet.length === 3) count(el, "a");
        if (shadowsOf(style.boxShadow).some((s) => s.inset && s.blur === 0 && s.spread === 0 && Math.max(Math.abs(s.x), Math.abs(s.y)) >= th.barMinPx && Math.max(Math.abs(s.x), Math.abs(s.y)) <= th.barMaxPx && chromatic(s.color))) count(el, "b");
      }
      const tabLike = el.matches("a,button,summary,li,tr,td,th,[aria-selected=true],[aria-current]");
      for (const pseudo of ["::before", "::after"]) {
        const bar = getComputedStyle(el, pseudo);
        if (!bar.content || bar.content === "none" || !/(absolute|fixed)/u.test(bar.position)) continue;
        const fill = parseColor(bar.backgroundColor);
        if (!fill || fill.a < th.minAlpha || spread(fill) < th.minChannelSpread) continue;
        const [w, h] = [px(bar.width), px(bar.height)];
        const edge = (value) => bar[value] !== "auto" && px(bar[value]) === 0;
        const vertical = w >= th.barMinPx && w <= th.barMaxPx && (edge("left") || edge("right")) && ((edge("top") && edge("bottom")) || (px(bar.top) <= th.barInsetPx && px(bar.bottom) <= th.barInsetPx && bar.top !== "auto" && bar.bottom !== "auto"));
        const horizontal = h >= th.barMinPx && h <= th.barMaxPx && (edge("top") || edge("bottom")) && edge("left") && edge("right") && !tabLike;
        if (vertical || horizontal) { count(el, "c"); break; }
      }
    }
    for (const entry of scopes.values()) {
      const hit = entry.b.length >= 1 ? entry.b : entry.a.length >= th.minCount ? entry.a : entry.c.length >= th.minCount ? entry.c : null;
      if (hit) add("SLOP-015", { selector: selectorOf(hit[0]), value: `${hit.length} rounded element(s) with a coloured accent stripe`, threshold: `< ${th.minCount} per scope (inset form: none)` });
    }
  }
  const declaredFaces = new Map();
  for (const face of document.fonts ?? []) declaredFaces.set(face.family.replace(/["']/gu, "").trim().toLowerCase(), face.status);
  const firstLoadedFamily = (stack) => {
    for (const raw of stack.split(",")) {
      const family = raw.replace(/["']/gu, "").trim().toLowerCase();
      if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|emoji|math|fangsong)$/u.test(family)) return family;
      if (declaredFaces.has(family) && declaredFaces.get(family) !== "loaded") continue;
      return family;
    }
    return "";
  };
  const families = new Map();
  for (const el of textElements) {
    const text = (el.innerText ?? "").trim();
    if (text.length <= 1 || el.getAttribute("aria-hidden") === "true" || /(icon|material|fa-)/iu.test(`${classText(el)} ${styleOf(el).fontFamily}`)) continue;
    const family = styleOf(el).fontFamily.split(",")[0].replace(/["']/gu, "").trim().toLowerCase();
    families.set(family, [...(families.get(family) ?? []), el]);
  }
  if (on("SLOP-016")) {
    const loaded = new Map();
    for (const el of textElements) {
      const family = firstLoadedFamily(styleOf(el).fontFamily);
      if (family && !el.matches("input,button,select,textarea,option") && !/^geist/u.test(family) && t("SLOP-016").families.includes(family)) loaded.set(family, el);
    }
    for (const [family, el] of loaded) candidate("SLOP-016", { selector: selectorOf(el), value: `${family} is the first loaded face` });
  }
  if (on("SLOP-019") && families.size > t("SLOP-019").max) add("SLOP-019", { selector: "body", value: `${families.size} families: ${[...families.keys()].join(", ").slice(0, 80)}`, threshold: `≤ ${t("SLOP-019").max}` });
  if (on("SLOP-020")) {
    for (const el of textElements) {
      const text = directText(el).map((node) => node.textContent).join(" ").trim();
      if (styleOf(el).textTransform === "uppercase" && text.length > t("SLOP-020").maxChars && cjkShare(text) <= 0.5) add("SLOP-020", { selector: selectorOf(el), value: `${text.length} chars in uppercase`, threshold: `≤ ${t("SLOP-020").maxChars}` });
    }
  }
  if (on("SLOP-021")) {
    const th = t("SLOP-021");
    for (const el of textElements) {
      const fg = parseColor(styleOf(el).color);
      const bg = fg ? solidBehind(el) : null;
      if (!fg || !bg) continue;
      const tone = hsl(fg);
      const surface = hsl(bg);
      if (tone.l >= th.minLightness && tone.l <= th.maxLightness && tone.s < th.maxTextSaturation && surface.s >= th.minSurfaceSaturation && surface.l > th.surfaceLightness[0] && surface.l < th.surfaceLightness[1]) {
        add("SLOP-021", { selector: selectorOf(el), value: `gray text L${Math.round(tone.l * 100)}% on a ${Math.round(surface.h)}° surface`, threshold: "text tinted from the surface hue" });
      }
    }
  }
  if (on("SLOP-023")) {
    const base = parseColor(styleOf(body).backgroundColor) ?? parseColor(styleOf(doc).backgroundColor);
    const ink = parseColor(styleOf(body).color);
    const pure = (c) => c && c.a >= 0.999 && ((c.r === 0 && c.g === 0 && c.b === 0) || (c.r === 255 && c.g === 255 && c.b === 255));
    if (pure(base) && !(darkScheme && base.r === 0)) add("SLOP-023", { selector: "body", value: `background rgb(${base.r}, ${base.g}, ${base.b})`, threshold: "an off-white or off-black base" });
    if (pure(ink)) add("SLOP-023", { selector: "body", value: `text rgb(${ink.r}, ${ink.g}, ${ink.b})`, threshold: "an off-black or off-white ink" });
  }
  if (on("SLOP-027")) {
    for (const el of shown) {
      const style = styleOf(el);
      if (style.animationName === "none" || !/infinite/u.test(style.animationIterationCount)) continue;
      const bound = [...el.attributes].some((attr) => attr.name.startsWith("data-")) || el.closest("[aria-busy=true]") || /(skeleton|shimmer|loading|spinner)/iu.test(classText(el));
      const pulse = document.getAnimations().some((a) => a.effect?.target === el && a.effect.getKeyframes().some((frame) => "opacity" in frame || "boxShadow" in frame));
      if (pulse && !bound) add("SLOP-027", { selector: selectorOf(el), value: `endless ${style.animationName}`, threshold: "bound to a live state" });
    }
  }

  // ---- slop register: structure and copy --------------------------------------------------------
  if (on("SLOP-002")) {
    const th = t("SLOP-002");
    const shape = (node) => [...node.children].map((child) => child.tagName).join(",");
    const tile = (node) => node.querySelector("img,svg,picture,[role=img],[class*=icon]") && node.querySelector("h1,h2,h3,h4,h5,h6,[role=heading]") && node.querySelector("p,span,div:not(:has(*))");
    for (const grid of shown.filter((el) => !el.matches("ul,ol,table,tbody,thead,tr,dl"))) {
      const kids = [...grid.children].filter(visible);
      if (kids.length < th.minTiles || !kids.every(tile)) continue;
      const first = kids[0].getBoundingClientRect();
      const same = kids.every((kid) => {
        const r = kid.getBoundingClientRect();
        return Math.abs(r.width - first.width) <= th.sizeTolerancePx && Math.abs(r.height - first.height) <= th.sizeTolerancePx && shape(kid) === shape(kids[0]);
      });
      if (same) add("SLOP-002", { selector: selectorOf(grid), value: `${kids.length} identical icon + heading + text tiles`, threshold: `< ${th.minTiles} per grid` });
    }
  }
  if (on("SLOP-029")) {
    const th = t("SLOP-029");
    const eyebrows = shown.filter((el) => el.matches("h1,h2,h3")).map((heading) => {
      let prev = heading.previousElementSibling;
      while (prev && !visible(prev)) prev = prev.previousElementSibling;
      if (!prev) return null;
      const style = styleOf(prev);
      const text = (prev.innerText ?? "").trim();
      const words = text.split(/\s+/u).filter(Boolean);
      const caps = style.textTransform === "uppercase" || (/[A-Z]/u.test(text) && text === text.toUpperCase());
      const tracked = px(style.letterSpacing) / Math.max(1, px(style.fontSize)) >= th.minTrackingEm;
      const small = px(style.fontSize) <= th.maxSizeRatio * px(styleOf(heading).fontSize);
      return words.length > 0 && words.length <= th.maxWords && caps && tracked && small ? prev : null;
    }).filter(Boolean);
    const sections = shown.filter((el) => el.matches("h2")).length;
    const allowed = Math.ceil(sections / th.sectionShare);
    if (eyebrows.length > allowed) add("SLOP-029", { selector: selectorOf(eyebrows[0]), value: `${eyebrows.length} eyebrow label(s) over ${sections} section heading(s)`, threshold: `≤ ${allowed}` });
  }
  if (on("SLOP-030")) {
    const labels = shown.filter((el) => /^0\d\b/u.test((el.innerText ?? "").trim()) && (el.innerText ?? "").trim().length <= 24 && el.nextElementSibling?.matches("h1,h2,h3,h4"));
    const indices = new Set(labels.map((el) => el.innerText.trim().slice(0, 2)));
    if (indices.size >= t("SLOP-030").minDistinct) candidate("SLOP-030", { selector: selectorOf(labels[0]), value: `section labels ${[...indices].join(", ")}` });
  }
  // Authored copy: visible text nodes of the top document, outside code and form values.
  const copyNodes = textElements.filter((el) => !el.closest("code,pre,kbd,samp,textarea,select,option,script,style"));
  const leaf = copyNodes.map((el) => ({ el, text: directText(el).map((node) => node.textContent).join(" ") }));
  const copy = leaf.map((entry) => entry.text).join("\n").slice(0, limits.textChars * 4);
  if (on("SLOP-033")) {
    for (const { el, text } of leaf) {
      const dots = text.match(/·/gu)?.length ?? 0;
      if (dots > t("SLOP-033").maxDots) add("SLOP-033", { selector: selectorOf(el), value: `${dots} middle dots on one line`, threshold: `≤ ${t("SLOP-033").maxDots}` });
    }
  }
  const phraseRule = (list) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "iu");
  const phraseRules = [
    ["SLOP-036", on("SLOP-036") ? phraseRule(t("SLOP-036").phrases) : null, "stock phrase", copyNodes.filter((el) => !el.closest("blockquote"))],
    ["SLOP-037", on("SLOP-037") ? new RegExp(`\\b(?:${t("SLOP-037").names.map(escapeRegExp).join("|")})\\b`, "u") : null, "placeholder brand"],
    ["SLOP-038", /\b(?:John|Jane) (?:Doe|Smith)\b|홍길동|김철수|이영희/u, "filler name"],
    ["SLOP-060", /lorem ipsum|dolor sit amet|\[placeholder\]|placeholder text|\bTODO\b|\bTBD\b/iu, "filler text"],
  ];
  for (const [id, pattern, label, scope] of phraseRules) {
    if (!on(id) || !pattern) continue;
    const pool = scope ? leaf.filter((entry) => scope.includes(entry.el)) : leaf;
    const hit = pool.find((entry) => pattern.test(entry.text));
    if (hit) add(id, { selector: selectorOf(hit.el), value: `${label}: "${pattern.exec(hit.text)[0]}"`, threshold: "none" });
  }
  if (on("SLOP-039")) {
    const shapes = [/\bNot an? \p{Ll}[^.!]{1,40}[.!]\s+\p{Lu}[^.!]{0,59}[.!]/gu, /\p{Lu}[^.!]{3,79}[.!]\s+(?:No|Just) \p{Ll}[^.!]{1,59}[.!]/gu];
    const count = shapes.reduce((sum, pattern) => sum + (copy.match(pattern)?.length ?? 0), 0);
    if (count >= t("SLOP-039").min) add("SLOP-039", { selector: "body", value: `${count} rebuttal-cadence sentence pairs`, threshold: `< ${t("SLOP-039").min}` });
  }
  if (on("SLOP-040")) {
    const th = t("SLOP-040");
    const han = (text) => { const letters = text.replace(/[\s\p{P}\p{S}\d]/gu, ""); return letters.length ? (letters.match(/[一-鿿]/gu)?.length ?? 0) / letters.length : 0; };
    const quotedAway = (el) => { const quote = el.closest("blockquote[cite],q[cite]"); if (!quote) return false; try { return new URL(quote.getAttribute("cite"), location.href).origin !== location.origin; } catch { return false; } };
    let main = 0;
    let first = null;
    for (const { el, text } of leaf) {
      const em = text.match(/—/gu)?.length ?? 0;
      const en = [...text.matchAll(/(\S)\s+–\s+(\S)/gu)].filter((match) => !(/\d/u.test(match[1]) && /\d/u.test(match[2]))).length;
      if (!em && !en) continue;
      if (quotedAway(el) || (han(text) > th.hanShare && /——/u.test(text))) {
        add("SLOP-040", { severity: th.carveOutSeverity, selector: selectorOf(el), value: `${em + en} dash(es) in a quoted or Han-majority passage`, threshold: `< ${th.min}` });
        continue;
      }
      main += em + en;
      first = first ?? el;
    }
    if (main >= th.min) add("SLOP-040", { selector: selectorOf(first), value: `${main} dash(es), first in "${snippet(first, 30)}"`, threshold: `< ${th.min}` });
  }
  if (on("SLOP-041")) {
    const stat = /(?<![\p{L}\d.,])(\d+(?:[.,]\d+)?\s?%|\d+(?:\.\d+)?\s?[×x](?!\p{L})|\d+(?:\.\d+)?\s?[kKMB]\+?(?!\p{L})|\d{1,3}(?:,\d{3})+\+?|\d+\+(?!\d)|\d+(?:\.\d+)?\s?(?:mm|cm|km|kg|lb|GB|TB)\b|\d+(?:\.\d+)?\s?\p{L}+\/(?:day|week|month|hr|hour))/u;
    const excluded = /[$€£¥₩]\s?\d|\d\s?(?:원|USD|EUR|KRW)\b|\b(?:19|20)\d{2}\b|\d{1,2}:\d{2}|\bv\d+\.\d+/u;
    const sourced = /\b(source|according to|as of|example|sample|mock|illustrative)\b|출처|예시/iu;
    for (const { el, text } of leaf) {
      const hit = stat.exec(text);
      if (!hit || excluded.test(text) || el.closest("time,td,th,form,[role=cell]")) continue;
      const block = el.closest("p,li,section,article,div,figure") ?? el;
      if (block.querySelector("cite,sup,a[href^='#fn']") || sourced.test(block.innerText ?? "")) continue;
      candidate("SLOP-041", { selector: selectorOf(el), value: `"${hit[0]}" with no source or mock marker` });
    }
  }
  const media = "img,picture,video,canvas,iframe,object";
  if (on("SLOP-043")) {
    const th = t("SLOP-043");
    for (const el of shown) {
      const r = el.getBoundingClientRect();
      if (r.width < th.minWidthPx || r.height < th.minHeightPx || el.matches("main,body") || el.querySelector(media) || el.querySelector(controlSelector)) continue;
      const inside = el.querySelectorAll("*");
      if (inside.length > limits.pairControls) continue;
      const dots = [...inside].filter((node) => { const b = node.getBoundingClientRect(); return b.width > 0 && b.width <= th.dotMaxPx && Math.abs(b.width - b.height) <= 1 && px(styleOf(node).borderTopLeftRadius) >= b.width / 2 - 0.5 && b.top - r.top <= th.chromeBandPx; });
      const chrome = dots.length >= 3 && new Set(dots.map((node) => Math.round(node.getBoundingClientRect().top))).size <= 2;
      const tilted = /(rotate|perspective|matrix3d)/u.test(styleOf(el).transform) || (() => { const scale = scaleStart(styleOf(el).transform, styleOf(el).scale); return scale !== null && scale < 1; })();
      if (chrome || tilted) candidate("SLOP-043", { selector: selectorOf(el), value: chrome ? "window-chrome dots over div-built content" : "tilted div-built mockup" });
    }
  }
  if (on("SLOP-045")) {
    const th = t("SLOP-045");
    const statBlock = (kid) => {
      const texts = [...kid.querySelectorAll("*")].filter((node) => directText(node).length);
      const figure = texts.find((node) => /^[\s$€£¥₩+−\d.,%×xkKMB]+$/u.test(node.innerText ?? "") && /\d/u.test(node.innerText ?? ""));
      return figure && texts.some((node) => node !== figure && px(styleOf(figure).fontSize) >= th.sizeRatio * px(styleOf(node).fontSize));
    };
    for (const parent of shown) {
      const kids = [...parent.children].filter(visible);
      if (kids.length < th.ctaSiblings || kids.length > limits.findingsPerRule || !kids.every(statBlock)) continue;
      const h = kids[0].getBoundingClientRect().height;
      if (!kids.every((kid) => Math.abs(kid.getBoundingClientRect().height - h) <= th.heightTolerancePx)) continue;
      const section = parent.closest("section,header,main") ?? body;
      const cta = [...section.querySelectorAll("a[href],button")].some((el) => isPrimary(el));
      if (kids.length >= th.minSiblings || cta) candidate("SLOP-045", { selector: selectorOf(parent), value: `${kids.length} same-shape stat blocks${cta ? " beside a call to action" : ""}` });
    }
  }
  if (on("SLOP-046")) {
    const th = t("SLOP-046");
    const gauges = shown.filter((el) => el.matches("progress,meter,[role=progressbar],[role=meter]")
      || (el.matches("svg") && [...el.querySelectorAll("circle")].some((circle) => { const dash = getComputedStyle(circle).strokeDasharray; return dash && dash !== "none"; }))
      || (el.matches("svg") && el.getBoundingClientRect().height <= th.sparklineMaxPx && el.querySelectorAll("polyline,path").length === 1 && !el.querySelector("text")));
    for (const el of gauges) {
      const named = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.querySelector("title");
      const around = snippet(el.parentElement ?? el, 200);
      if (!named && !/\d/u.test(around)) candidate("SLOP-046", { selector: selectorOf(el), value: "gauge or sparkline with no value, axis or name" });
    }
  }
  if (on("SLOP-047") && String(vw) === t("SLOP-047").viewport && pass === "base") {
    const th = t("SLOP-047");
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (!target || animation.effect.getTiming().iterations !== Infinity) continue;
      if (!(animation.effect.getKeyframes?.() ?? []).some((frame) => /translate/u.test(frame.transform ?? ""))) continue;
      const logos = [...target.querySelectorAll("img,svg,[style*=background-image]")].filter(visible);
      const sources = new Set(logos.map((logo) => logo.currentSrc || styleOf(logo).backgroundImage || logo.outerHTML.slice(0, 200)));
      const heights = logos.map((logo) => logo.getBoundingClientRect().height).sort((a, b) => a - b);
      const median = heights[Math.floor(heights.length / 2)] ?? 0;
      if (logos.length && sources.size <= th.maxLogos && median < th.minLogoPx) add("SLOP-047", { selector: selectorOf(target), value: `${sources.size} logos looping at a median ${round(median, 1)}px`, threshold: `≥ ${th.minLogoPx}px, or a static row` });
    }
  }
  if (on("SLOP-048")) {
    const th = t("SLOP-048");
    const dot = (el) => { const r = el.getBoundingClientRect(); return (r.width <= th.dotMaxPx && r.height <= th.dotMaxPx && px(styleOf(el).borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 0.5) || /(^|[\s_-])(dot|dots|bullet|indicator)s?([\s_-]|$)/iu.test(classText(el)); };
    for (const group of shown.filter((el) => { const kids = [...el.children].filter(visible); return kids.length >= th.minDots && kids.every(dot); })) {
      let root = group.parentElement;
      for (let depth = 0; root && depth < 3 && root.querySelectorAll("[class*=slide],[aria-roledescription=slide]").length < 2; depth += 1) root = root.parentElement;
      if (!root || root.querySelectorAll("[class*=slide],[aria-roledescription=slide]").length < 2) continue;
      const kids = [...group.children];
      const bound = kids.every((el) => el.tabIndex >= 0 && el.matches("button,[role=button],[role=tab]") && accessibleName(el)) || kids.some((el) => el.hasAttribute("aria-controls") || el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("aria-current"));
      if (bound) continue;
      const autoplay = root.closest("[data-autoplay],[data-bs-ride=carousel],[autoplay]");
      if (autoplay) add("SLOP-048", { selector: selectorOf(group), value: `${kids.length} autoplay dots with no accessible binding`, threshold: "named, focusable dot controls" });
      else skip("SLOP-048", `${selectorOf(group)}: unbound dots with no declared autoplay; the timed read is not run`);
    }
  }
  if (on("SLOP-051")) {
    const th = t("SLOP-051");
    for (const svg of shown.filter((el) => el.matches("svg"))) {
      const r = svg.getBoundingClientRect();
      if (r.width < th.minSizePx || r.height < th.minSizePx || svg.querySelector("pattern")) continue;
      const shapes = [...svg.querySelectorAll("rect,circle,ellipse,polygon")];
      const fills = new Set(shapes.map((shape) => getComputedStyle(shape).fill).filter((fill) => fill && !/^(none|transparent|rgba\(0, 0, 0, 0\))$/u.test(fill)));
      if (shapes.length >= th.minShapes && fills.size >= th.minFills && svg.querySelectorAll("text,tspan").length <= th.maxText) candidate("SLOP-051", { selector: selectorOf(svg), value: `${shapes.length} primitives in ${fills.size} fills` });
    }
  }
  if (on("SLOP-052")) {
    const th = t("SLOP-052");
    for (const el of shown) {
      const clip = styleOf(el).clipPath;
      if (!clip || clip === "none") continue;
      const polygon = /^polygon\((.*)\)$/u.exec(clip);
      if (polygon) {
        const vertices = polygon[1].split(",");
        const coordinates = vertices.flatMap((vertex) => vertex.trim().split(/\s+/u).map(parseFloat)).filter(Number.isFinite);
        const offGrid = coordinates.filter((value) => Math.abs(value - Math.round(value / th.grid) * th.grid) > th.gridTolerance).length;
        if (vertices.length >= th.minVertices && offGrid * 2 >= coordinates.length) add("SLOP-052", { selector: selectorOf(el), value: `polygon with ${vertices.length} off-grid vertices`, threshold: `< ${th.minVertices} vertices, or on the ${th.grid}% grid` });
      }
      const path = /^path\((.*)\)$/u.exec(clip);
      if (path && (path[1].match(/[CcSsQqTtAa]/gu)?.length ?? 0) >= th.minCurves) add("SLOP-052", { selector: selectorOf(el), value: "curved path() mask", threshold: `< ${th.minCurves} curves` });
    }
  }
  if (on("SLOP-053")) {
    const emoji = /\p{Extended_Pictographic}/u;
    const candidates = new Set([...controls.filter(visible), ...shown.filter((node) => node.matches("nav a, nav li, [class*=badge], [class*=icon], h2, h3, h4, li"))]);
    for (const el of candidates) {
      const text = (el.innerText ?? "").trim();
      if (!emoji.test(text)) continue;
      const rect = el.getBoundingClientRect();
      const sole = text.replace(/[\p{Extended_Pictographic}️‍\s]/gu, "") === "" && Math.max(rect.width, rect.height) <= t("SLOP-053").maxControlPx * 2;
      const leading = /^\p{Extended_Pictographic}/u.test(text) && text.length <= 60;
      if (sole || leading) candidate("SLOP-053", { selector: selectorOf(el), value: `"${text.slice(0, 24)}"` });
    }
  }

  // ---- slop register: broken or fake controls ---------------------------------------------------
  if (on("SLOP-057")) {
    let lazy = 0;
    const blank = (value) => value !== null && ["", "#", "undefined"].includes(value.trim());
    for (const img of body.querySelectorAll("img")) {
      const src = img.getAttribute("src");
      const bad = blank(src) || blank(img.getAttribute("srcset"));
      const loader = [...img.attributes].some((attr) => /^data-(src|srcset|lazy)/u.test(attr.name));
      if (bad && loader) { lazy += 1; continue; }
      if (bad) { add("SLOP-057", { selector: selectorOf(img), value: `src="${(src ?? "").trim()}"`, threshold: "an image that loads" }); continue; }
      if (!img.complete) { lazy += 1; continue; }
      if (img.naturalWidth === 0) add("SLOP-057", { selector: selectorOf(img), value: `"${(img.currentSrc || src || "").slice(0, 40)}" failed to load`, threshold: "an image that loads" });
    }
    if (lazy) skip("SLOP-057", `lazy image not fetched at capture (${lazy})`);
  }
  if (on("SLOP-058")) {
    for (const el of body.querySelectorAll("a[href]")) {
      const href = el.getAttribute("href").trim();
      if (href !== "#" && !/^javascript:/iu.test(href)) continue;
      const decorative = !(el.innerText ?? "").trim() || el.closest("[class*=logo],[class*=social]");
      add("SLOP-058", { severity: decorative ? t("SLOP-058").decorativeSeverity : undefined, selector: selectorOf(el), value: `href="${href}" "${snippet(el, 24)}"`, threshold: "a real destination" });
    }
  }
  if (on("SLOP-059")) {
    for (const el of body.querySelectorAll("button:not([type])")) {
      const owner = el.form;
      if (!owner) continue;
      const submits = [...owner.elements].filter((node) => node.matches("button,input[type=submit]") && node.type === "submit");
      if (submits.length >= t("SLOP-059").minSubmitButtons) add("SLOP-059", { selector: selectorOf(el), value: `"${snippet(el, 24)}" defaults to submit beside ${submits.length - 1} other submit button(s)`, threshold: "explicit type" });
    }
  }
  if (on("SLOP-061")) {
    for (const el of body.querySelectorAll("marquee")) add("SLOP-061", { selector: selectorOf(el), value: "<marquee>", threshold: "static row or a pause control" });
  }

  return {
    viewport: { width: vw, height: vh, dpr: window.devicePixelRatio, dark: window.matchMedia("(prefers-color-scheme: dark)").matches, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches },
    ready: document.readyState,
    counts: { elements: all.length, visible: shown.length, text: textElements.length, controls: controls.length },
    findings,
    notVerified,
    hoverTargets,
  };
}

// Read after the driver hovers one CF-506 target: is it really :hover, and how long is its
// transition. Self-contained for the same reason as measureInterface.
export function readHover(selector) {
  const el = document.querySelector(selector);
  if (!el) return { found: false };
  const style = getComputedStyle(el);
  const seconds = (value) => value.split(",").map((part) => (part.trim().endsWith("ms") ? parseFloat(part) : parseFloat(part) * 1000) || 0);
  return { found: true, hover: el.matches(":hover"), durationMs: Math.max(0, ...seconds(style.transitionDuration)), property: style.transitionProperty };
}

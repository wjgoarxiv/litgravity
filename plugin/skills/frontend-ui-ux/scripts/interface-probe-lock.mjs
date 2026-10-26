// In-page design-lock conformance (DS-001..DS-008). interface-probe.mjs serialises this function
// into the page, so it may not import anything or close over module scope; every threshold comes
// from the rule table through `options.rules`, and the lock arrives as `options.lock`.
export function measureLock(options) {
  const { rules, limits, lock } = options;
  const findings = [];
  const notVerified = [];
  const push = (rule, selector, value, threshold, severity) => {
    if (findings.filter((f) => f.rule === rule).length >= limits.findingsPerRule) return;
    findings.push({ rule, severity: severity ?? rules[rule].severity, tier: rules[rule].tier, selector, value, threshold });
  };
  const describe = (el) => {
    if (el.id) return `#${el.id}`;
    const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("");
    return `${el.tagName.toLowerCase()}${cls}`;
  };
  const exempt = (el) => Boolean(el.closest("[data-lock-exempt], img, video, canvas, iframe, picture, object"));
  const visible = (el) => {
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const box = el.getBoundingClientRect();
    return box.width >= 1 && box.height >= 1;
  };

  // DS-001: the generated tokens.css carries the lock id on :root.
  const applied = getComputedStyle(document.documentElement).getPropertyValue(rules["DS-001"].threshold.property).trim().replace(/^["']|["']$/gu, "");
  if (applied !== lock.style) {
    push("DS-001", ":root", applied ? `${rules["DS-001"].threshold.property}: ${applied}` : `${rules["DS-001"].threshold.property} missing`, `"${lock.style}" from design.lock.json`);
    return { findings, notVerified };
  }

  const parse = (value) => {
    let match = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/u.exec(value);
    if (match) return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: match[4] === undefined ? 1 : Number(match[4]) };
    match = /^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)$/u.exec(value);
    if (match) return { rgb: [match[1], match[2], match[3]].map((n) => Math.round(Number(n) * 255)), alpha: match[4] === undefined ? 1 : Number(match[4]) };
    return null;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const palette = [...Object.values(lock.colors.light), ...Object.values(lock.colors.dark)].map(hex);
  const tolerance = rules["DS-003"].threshold.channelTolerance;
  const onPalette = (rgb) => palette.some((p) => Math.abs(p[0] - rgb[0]) <= tolerance && Math.abs(p[1] - rgb[1]) <= tolerance && Math.abs(p[2] - rgb[2]) <= tolerance);
  const toHex = (rgb) => `#${rgb.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`;
  const families = new Set(lock.fonts.map((f) => f.toLowerCase()));
  const sizes = lock.type.scale_px;
  const display = lock.type.display_px;
  // Inside the declared signature moment type may run past the display range up to the lock's ceiling.
  const momentMax = lock.type.moment_px?.max ?? display.max;
  const momentAttr = rules["DS-008"].threshold.attribute;
  const sizeTolerance = rules["DS-004"].threshold.tolerancePx;
  const radii = lock.radius_px;
  const radiusTolerance = rules["DS-005"].threshold.tolerancePx;

  const offColours = new Map();
  const offFamilies = new Map();
  const offSizes = new Map();
  const offRadii = new Map();
  const offShadows = new Map();
  let unparsed = 0;
  // DS-007: the lock names an elevation grammar. "flat" allows only rings (no blur, no offset past a
  // hairline); "offset" allows hard offsets but no blur; "soft" is left to CF-403. Insets never count.
  const elevation = lock.elevation ?? "soft";
  const hairline = rules["DS-007"].threshold.hairlinePx;
  const shadowLengths = (value) => (value === "none" ? [] : value.split(/,(?![^()]*\))/u)).filter((part) => !/\binset\b/u.test(part))
    .map((part) => part.replace(/\b(?:rgba?|color|hsla?|oklch|lab|lch)\([^)]*\)/gu, "").match(/-?[\d.]+px/gu)?.map(Number.parseFloat) ?? []);
  const noteColour = (value, el, where) => {
    const colour = parse(value);
    if (!colour) { if (value !== "transparent" && value !== "none") unparsed += 1; return; }
    if (colour.alpha < rules["DS-003"].threshold.minAlpha || onPalette(colour.rgb)) return;
    const key = toHex(colour.rgb);
    if (!offColours.has(key)) offColours.set(key, `${describe(el)} ${where}`);
  };

  const elements = [...document.body.querySelectorAll("*")].slice(0, limits.nodes);
  for (const el of elements) {
    if (exempt(el) || !visible(el)) continue;
    const style = getComputedStyle(el);
    const isSvgShape = el instanceof SVGElement && !(el instanceof SVGSVGElement);
    if (isSvgShape) {
      if (["rect", "path", "circle", "ellipse", "polygon", "polyline", "line"].includes(el.tagName.toLowerCase())) {
        if (style.fill !== "none") noteColour(style.fill, el, "fill");
        if (style.stroke !== "none") noteColour(style.stroke, el, "stroke");
      }
      continue;
    }
    const ownText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (ownText) {
      noteColour(style.color, el, "text");
      const family = style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/gu, "").toLowerCase();
      if (!families.has(family) && !offFamilies.has(family)) offFamilies.set(family, describe(el));
      const px = Number.parseFloat(style.fontSize);
      const ceiling = el.closest(`[${momentAttr}]`) ? momentMax : display.max;
      const onScale = sizes.some((s) => Math.abs(s - px) <= sizeTolerance) || (px >= display.min - sizeTolerance && px <= ceiling + sizeTolerance);
      if (!onScale && !offSizes.has(px)) offSizes.set(px, describe(el));
    }
    noteColour(style.backgroundColor, el, "background");
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none") noteColour(style[`border${side}Color`], el, "border");
    }
    if (elevation !== "soft") {
      for (const [x = 0, y = 0, blur = 0] of shadowLengths(style.boxShadow)) {
        const offset = Math.abs(x) > hairline || Math.abs(y) > hairline;
        if ((blur > 0 || (elevation === "flat" && offset)) && !offShadows.has(describe(el))) offShadows.set(describe(el), `${x}px ${y}px ${blur}px`);
      }
    }
    const box = el.getBoundingClientRect();
    for (const corner of ["TopLeft", "TopRight", "BottomRight", "BottomLeft"]) {
      const raw = style[`border${corner}Radius`];
      if (!raw || raw.includes(" ") || raw.includes("%")) continue;
      const r = Number.parseFloat(raw);
      if (!(r > 0)) continue;
      const round = r >= Math.min(box.width, box.height) / 2 - radiusTolerance;
      if (!round && !radii.some((v) => Math.abs(v - r) <= radiusTolerance) && !offRadii.has(r)) offRadii.set(r, describe(el));
    }
  }

  for (const [family, where] of offFamilies) push("DS-002", where, `font-family "${family}"`, `one of ${lock.fonts.join(", ")}`);
  if (offColours.size) {
    const list = [...offColours.entries()];
    const severity = list.length >= rules["DS-003"].threshold.highCount ? "HIGH" : rules["DS-003"].threshold.lowSeverity;
    push("DS-003", list.slice(0, 4).map(([, where]) => where).join(" | "), `${list.length} off-palette colour(s): ${list.slice(0, 8).map(([c]) => c).join(", ")}`, `the ${lock.style} palette (light and dark roles)`, severity);
  }
  if (offSizes.size) push("DS-004", [...offSizes.values()].slice(0, 3).join(" | "), `${offSizes.size} size(s) off scale: ${[...offSizes.keys()].slice(0, 8).map((n) => `${n}px`).join(", ")}`, `${sizes.join("/")}px or display ${display.min}–${display.max}px`);
  if (offRadii.size) push("DS-005", [...offRadii.values()].slice(0, 3).join(" | "), `${offRadii.size} radius value(s) off lock: ${[...offRadii.keys()].slice(0, 6).map((n) => `${n}px`).join(", ")}`, `${radii.join("/")}px or fully round`);
  if (offShadows.size) push("DS-007", [...offShadows.keys()].slice(0, 3).join(" | "), `${offShadows.size} element(s) with ${[...offShadows.values()].slice(0, 3).join(", ")} shadows`, elevation === "flat" ? "flat lock: rings only, no blur or offset" : "offset lock: zero-blur offsets only");
  if (unparsed) notVerified.push({ rule: "DS-003", reason: `${unparsed} colour value(s) in a format the probe cannot compare` });

  // DS-006: a starter-layout slot such as {{Product}} left in visible text or a labelling attribute.
  const slot = new RegExp(rules["DS-006"].threshold.pattern, "u");
  const textHit = slot.exec(document.body.innerText.slice(0, limits.textChars * 10));
  if (textHit) push("DS-006", "page text", textHit[0], "no {{slot}} from the kit layouts");
  for (const el of document.querySelectorAll("[title], [aria-label], [alt], [placeholder]")) {
    for (const attr of ["title", "aria-label", "alt", "placeholder"]) {
      const value = el.getAttribute(attr);
      const hit = value && slot.exec(value);
      if (hit) push("DS-006", `${describe(el)}[${attr}]`, hit[0], "no {{slot}} from the kit layouts");
    }
  }
  const title = slot.exec(document.title);
  if (title) push("DS-006", "title", title[0], "no {{slot}} from the kit layouts");

  // DS-008: the one signature moment the lock declares. It must be declared, marked, big enough to
  // read, in the first screen on a read-once page, hold what its kind promises, and not be the
  // generic gradient-and-centred-text hero.
  const m = rules["DS-008"].threshold;
  const declared = lock.moment;
  if (!declared) {
    push("DS-008", "design.lock.json", "the lock predates signature moments and records none", "a moment recorded with design-lock.mjs moment");
    return { findings, notVerified };
  }
  if (!declared.kind) {
    push("DS-008", "design.lock.json", "the lock declares no signature moment", `a ${declared.scale} moment recorded with design-lock.mjs moment`);
    return { findings, notVerified };
  }
  const marked = [...document.querySelectorAll(`[${m.attribute}]`)].filter(visible);
  if (!marked.length) {
    push("DS-008", "page", `no [${m.attribute}] element for the declared ${declared.kind}`, `one element marked ${m.attribute}="${declared.kind}"`);
    return { findings, notVerified };
  }
  if (marked.length > 1) push("DS-008", marked.slice(0, 3).map(describe).join(" | "), `${marked.length} elements claim the signature moment`, "one moment per page", "MEDIUM");
  const el = marked.find((node) => node.getAttribute(m.attribute) === declared.kind) ?? marked[0];
  const where = describe(el);
  const kind = el.getAttribute(m.attribute);
  if (kind !== declared.kind) push("DS-008", where, `marked "${kind}" but the lock declares "${declared.kind}"`, "the declared kind");
  const box = el.getBoundingClientRect();
  const area = box.width * box.height;
  const minArea = declared.scale === "bold" ? m.boldMinAreaPx : m.smallMinAreaPx;
  if (area < minArea) push("DS-008", where, `${Math.round(box.width)}×${Math.round(box.height)} px moment is too small to read as one`, `≥ ${minArea} px²`);
  const base = options.pass === "base";
  if (declared.scale === "small" && base && innerWidth >= m.foldMinViewportPx && area > m.smallMaxViewportShare * innerWidth * innerHeight) push("DS-008", where, `a work-surface moment covering ${Math.round((100 * area) / (innerWidth * innerHeight))}% of the screen`, `≤ ${m.smallMaxViewportShare * 100}%: work surfaces stay calm`, "MEDIUM");
  if (declared.above_fold && base) {
    const top = box.top + scrollY;
    const wide = innerWidth >= m.foldMinViewportPx;
    const limit = wide ? innerHeight - m.foldMinVisiblePx : innerHeight * m.phoneScreens;
    if (top > limit) push("DS-008", where, `moment starts ${Math.round(top)} px down, below the fold`, wide ? `starts by ${Math.round(limit)} px (first screen)` : `starts within ${m.phoneScreens} screens (${Math.round(limit)} px)`);
  }
  const has = (selector) => el.matches(selector) || [...el.querySelectorAll(selector)].some(visible);
  const media = has(m.media);
  const inside = [el, ...el.querySelectorAll("*")].filter(visible);
  const texts = inside.filter((node) => [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim()));
  const need = m.needs[declared.kind];
  const wants = {
    media: ["an image, drawing, figure, frame or product view", () => media],
    data: ["chart, table, figure or readout", () => has(m.data)],
    control: ["control a reader can operate", () => has(m.control)],
    "display-type": ["type at display size or above", () => texts.some((node) => Number.parseFloat(getComputedStyle(node).fontSize) >= display.min - sizeTolerance)],
    motion: ["animation or transition", () => options.pass === "reduced-motion" || inside.some((node) => { const cs = getComputedStyle(node); return cs.animationName !== "none" || cs.transitionDuration.split(",").some((d) => Number.parseFloat(d) > 0); })],
  }[need];
  if (wants && !wants[1]()) push("DS-008", where, `declared ${declared.kind} but it holds no ${wants[0]}`, `a ${declared.kind} built from the page's content`);
  const gradient = (node) => /gradient\(/u.test(getComputedStyle(node).backgroundImage) && !node.matches(".ui-scan, .ui-ruler");
  const chain = [];
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) chain.push(node);
  const behind = chain.some(gradient) || inside.some((node) => { const b = node.getBoundingClientRect(); return gradient(node) && b.width * b.height >= m.coverShare * area; });
  const biggest = texts.reduce((best, node) => (Number.parseFloat(getComputedStyle(node).fontSize) > (best ? Number.parseFloat(getComputedStyle(best).fontSize) : 0) ? node : best), null);
  if (behind && !media && biggest && getComputedStyle(biggest).textAlign === "center") push("DS-008", where, "a generic gradient-and-centred-text hero", "a moment built from this page's content (composition, set piece, data, diagram, motion or object)");
  return { findings, notVerified };
}

// The one rule table the interface probe measures against. Every id, severity, tier, threshold
// and fix lives here as data; interface-probe-page.mjs reads its numbers from `threshold` and
// interface-probe-static.mjs from the same table, so a threshold change is one edit in this file.
// references/craft-floor.md (CF-*, RS-*) and references/slop-register.md (SLOP-*) describe the same
// ids in prose. Ids and numbers follow the family rule spec of 2026-09-26 (SPEC STATUS: FINAL) with
// its Delta 1 of 2026-09-27.

// `tier` is the default claim tier: `measured` is read straight off the render, `derived` is
// computed from measured values or relies on an approximation the finding names. The probe never
// emits an inferred claim. A rule with `judgment` is DET-assist plus a reviewer's verdict: its hits
// are listed as judgment candidates under "Not verified", never as findings, and its severity
// applies only once a reviewer confirms the hit.
export const RULES = Object.freeze({
  // Responsive matrix. RS-001 (every width ran) is a run-completeness condition, not a finding.
  "RS-002": { title: "No dark path at the dark pass", severity: "MEDIUM", tier: "measured", threshold: { maxLuminance: 0.35, themeControlWords: ["dark", "theme", "night", "다크", "테마", "야간"] }, fix: "Give the page a prefers-color-scheme: dark path (or honour its own theme toggle) and re-check contrast there." },
  "RS-003": { title: "Reduced motion not honoured", severity: "HIGH", tier: "measured", threshold: { maxMotionMs: 250, motionProperties: ["transform", "translate", "scale", "rotate", "top", "right", "bottom", "left", "inset", "width", "height", "margin", "offset", "background-position", "all"] }, fix: "Wrap motion in @media (prefers-reduced-motion: reduce) so movement stops (a cross-fade may stay) and videos stay paused." },
  "RS-004": { title: "Breaks at 200 % zoom (720 CSS px)", severity: "HIGH", tier: "derived", threshold: { tolerancePx: 8 }, fix: "Let the layout reflow at 720 px: wrap rows, drop fixed widths, keep every control reachable without sideways scrolling." },
  "RS-006": { title: "Page scrolls sideways", severity: "HIGH", tier: "measured", threshold: { tolerancePx: 8 }, fix: "Find the element wider than the viewport; let it wrap, shrink (min-width: 0) or scroll inside its own container." },
  "RS-007": { title: "Text clipped, offscreen or overlapping", severity: "HIGH", tier: "measured", threshold: { clipPx: 3, offscreenPx: 8, overlapRatio: 0.45, overlapSeverity: "MEDIUM" }, fix: "Remove the fixed height, width or offset that cuts or stacks the text; truncate only with a declared text-overflow or line-clamp." },
  "RS-008": { title: "Mobile input text under 16 px", severity: "MEDIUM", tier: "measured", threshold: { minFontPx: 16 }, fix: "Set text-entry controls to at least 16px on touch widths so the phone does not zoom on focus." },
  "RS-009": { title: "Edge-fixed control ignores the safe area", severity: "MEDIUM", tier: "derived", threshold: { edgePx: 1 }, fix: "With viewport-fit=cover, add env(safe-area-inset-*) to the offset or padding of every control pinned to that edge." },
  "RS-010": { title: "Scroll rail ends flush", severity: "LOW", tier: "measured", threshold: { minPeekPx: 16, maxPeekPx: 32 }, fix: "Size the rail so 16 to 32 px of the next item shows, or give it prev/next controls, which tell people there is more." },

  // Craft floor: typography
  "CF-101": { title: "Body line too long", severity: "MEDIUM", tier: "derived", threshold: { latinMaxCh: 90, cjkMaxCh: 60, cjkShare: 0.3, minLines: 2, targetCh: "60-75" }, fix: "Cap the prose container near 65ch (max-width in ch) so a line stays readable." },
  "CF-102": { title: "Heading line-height off band", severity: "MEDIUM", tier: "measured", threshold: { min: 1.2, max: 1.35, displayMin: 1.05, displayFontPx: 40, normalRatio: 1.15 }, fix: "Set wrapped headings to a line-height of about 1.2 to 1.3 (large display type may go to 1.05)." },
  "CF-103": { title: "Body line-height too tight", severity: "MEDIUM", tier: "measured", threshold: { latinMin: 1.4, cjkMin: 1.5, cjkShare: 0.3, target: "1.5 Latin, 1.6 CJK" }, fix: "Give wrapped body text a line-height of 1.5 (1.6 for Korean and other CJK text)." },
  "CF-104": { title: "Wrapped row line-height too tight", severity: "MEDIUM", tier: "measured", threshold: { min: 1.4, minLines: 3 }, fix: "Any text that wraps to three or more lines needs a line-height of at least 1.4, even in dense layouts." },
  "CF-105": { title: "Wrapped heading without balanced wrap", severity: "LOW", tier: "measured", threshold: { headingWrap: ["balance"], orphanShare: 0.2 }, fix: "Add text-wrap: balance to headings (text-wrap: pretty suits body copy)." },
  "CF-106": { title: "Numeric column without tabular figures", severity: "LOW", tier: "measured", threshold: { numericShare: 0.7, minCells: 2 }, fix: "Add font-variant-numeric: tabular-nums to numeric columns and KPI values so digits line up." },
  "CF-107": { title: "Title Case UI label", severity: "LOW", tier: "measured", threshold: { casedShare: 0.5, functionWords: ["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "of", "off", "on", "or", "over", "per", "the", "to", "up", "via", "with"], acronymLetters: [2, 5] }, fix: "Use sentence case for buttons, links and labels: capitalise only the first word and proper nouns." },
  "CF-108": { title: "Too many type roles or families", severity: "MEDIUM", tier: "measured", threshold: { maxRoles: 7, maxFamilies: 2, maxMono: 1, censusViewport: "390", weightBuckets: [400, 600] }, fix: "Fold near-duplicate sizes and weights into the type scale; keep two families plus one mono.", judgment: "a recorded exception for the extra role or family clears it" },

  // Craft floor: colour and contrast
  "CF-201": { title: "Text contrast below WCAG 2", severity: "HIGH", tier: "derived", threshold: { body: 4.5, large: 3, largeFontPx: 24, boldLargeFontPx: 18.5, boldWeight: 700, largeSeverity: "MEDIUM" }, fix: "Darken or lighten the text or its surface until the ratio clears 4.5:1 (3:1 for large text)." },
  "CF-202": { title: "Focus indicator missing or weak", severity: "HIGH", tier: "measured", threshold: { minWidthPx: 2, minContrast: 3, weakSeverity: "MEDIUM", sample: 5 }, fix: "Give :focus-visible a visible change; a custom ring needs 2px or more and 3:1 against the colour just outside it." },
  "CF-204": { title: "Text over a gradient below WCAG 2", severity: "HIGH", tier: "derived", threshold: { body: 4.5, large: 3 }, fix: "Put the text on a solid scrim or move it off the gradient's light end until the worst stop clears the floor." },
  "CF-205": { title: "More than one accent colour", severity: "MEDIUM", tier: "measured", threshold: { maxClusters: 1, hueToleranceDeg: 15, minSaturation: 0.4, minSurfacePx: 24, maxPillPx: 32, minLightness: 0.15, maxLightness: 0.85, statusTokens: ["success", "warning", "warn", "error", "danger", "destructive", "info", "critical"] }, fix: "Keep one saturated accent for actions in a view; move the other filled surfaces to neutrals." },

  // Craft floor: spacing and surfaces
  "CF-301": { title: "Spacing off the 4px scale", severity: "LOW", tier: "measured", threshold: { stepPx: 4, tolerancePx: 1, minPx: 4, lowMax: 3, manySeverity: "MEDIUM" }, fix: "Snap padding, gaps and margins to the 4px scale (4, 8, 12, 16, 24, 32 …)." },
  "CF-304": { title: "Heading sits closer to the block above", severity: "LOW", tier: "measured", threshold: { ratio: 0.75, deficitPx: 12, labelMaxPx: 60, labelGapPx: 28 }, fix: "Give the heading more space above than below so it binds to the content it introduces." },
  "CF-401": { title: "Nested radius not concentric", severity: "LOW", tier: "measured", threshold: { tolerancePx: 2, maxParentPaddingPx: 24, edgeTolerancePx: 2, minChildPx: 32 }, fix: "Set the inner radius to the outer radius minus the padding between them." },
  "CF-403": { title: "Hard offset shadow outside a register", severity: "MEDIUM", tier: "measured", threshold: { hairlinePx: 1, registerCount: 3, registerBorderPx: 2 }, fix: "Use a soft neutral shadow or none, unless the direction records a neo-brutalist register.", note: "clears when the recorded direction names a neo-brutalist register" },
  "CF-404": { title: "Glow on the primary action", severity: "LOW", tier: "measured", threshold: { minBlurPx: 16, minSaturation: 0.4, maxOffsetPx: 2, minAlpha: 0.2 }, fix: "Replace the coloured halo with a small neutral shadow or a border; the button's fill already carries the emphasis." },
  "CF-406": { title: "Blurred modal scrim", severity: "LOW", tier: "measured", threshold: { minCover: 0.9 }, fix: "Use a solid or near-solid scrim (for example rgb(0 0 0 / 0.5)) instead of backdrop-filter: blur." },

  // Craft floor: motion
  "CF-502": { title: "Press feedback off band", severity: "LOW", tier: "derived", threshold: { minScale: 0.95, maxScale: 0.96, maxMs: 150, sample: 5 }, fix: "On :active scale to 0.96 over at most 150ms with ease-out; never below 0.95." },
  "CF-503": { title: "Entrance starts below 0.95 scale", severity: "MEDIUM", tier: "measured", threshold: { minScale: 0.95, declaredSeverity: "LOW", iconMaxPx: 32 }, fix: "Start entrances at scale(0.95) with opacity 0, not from nothing." },
  "CF-505": { title: "Bouncy easing on feedback", severity: "MEDIUM", tier: "measured", threshold: { minControl: -0.1, maxControl: 1.1, nameTokens: ["bounce", "elastic", "wobble", "jiggle", "spring"] }, fix: "Use an ease-out curve whose y control points stay inside -0.1..1.1; feedback should settle once, not overshoot." },
  "CF-506": { title: "Slow hover on a repeated control", severity: "LOW", tier: "measured", threshold: { maxMs: 150, minRepeats: 5, sample: 5, viewport: "1440" }, fix: "Make hover feedback on list rows and repeated controls instant or 150ms at most." },
  "CF-507": { title: "will-change misuse", severity: "LOW", tier: "measured", threshold: { allowed: ["transform", "opacity", "filter"], atRestSeverity: "MEDIUM" }, fix: "Limit will-change to transform, opacity or filter and set it only while the animation runs." },
  "CF-508": { title: "Layout property animated", severity: "MEDIUM", tier: "measured", threshold: { properties: ["width", "height", "padding", "margin", "top", "left", "right", "bottom"] }, fix: "Animate transform and opacity instead of width, height, margins or offsets." },

  // Craft floor: icons, targets, microcopy
  "CF-603": { title: "Control has no accessible name", severity: "HIGH", tier: "measured", threshold: null, fix: "Give the control visible text or an aria-label that says what it does." },
  "CF-701": { title: "Target too small", severity: "HIGH", tier: "measured", threshold: { floorPx: 24, touchPx: 44, touchSeverity: "MEDIUM", touchMaxViewportPx: 768, spacingCirclePx: 24 }, fix: "Grow the hit area to 44px on touch (24px minimum everywhere) with padding or a pseudo-element; do not only enlarge the glyph." },
  "CF-702": { title: "Targets crowd each other", severity: "MEDIUM", tier: "measured", threshold: { touchGapPx: 8, fineGapPx: 4 }, fix: "Keep 8px of clear space between touch targets (4px on desktop) with gap or margin." },
  "CF-703": { title: "Destructive control under 44 px", severity: "HIGH", tier: "measured", threshold: { minPx: 44 }, fix: "Keep delete, remove and discard controls at 44px or larger on every pointer type." },
  "CF-704": { title: "Control revealed only on hover", severity: "HIGH", tier: "measured", threshold: null, fix: "Reveal the control on :focus-within as well (or keep it visible), so keyboard and touch users can reach it." },
  "CF-806": { title: "Placeholder is the only label", severity: "MEDIUM", tier: "measured", threshold: null, fix: "Add a real <label> (or aria-label) and keep the placeholder as an example value." },
  "CF-807": { title: "Placeholder contrast below 4.5:1", severity: "MEDIUM", tier: "derived", threshold: { min: 4.5 }, fix: "Darken the placeholder colour until it reaches 4.5:1 against the field." },

  // Slop register. Only SLOP-057, SLOP-058 and SLOP-059 can be HIGH.
  "SLOP-002": { title: "Identical icon-heading-text tiles", severity: "MEDIUM", tier: "measured", threshold: { minTiles: 4, sizeTolerancePx: 4 }, fix: "Vary tile size or structure, or present the items as a list or table." },
  "SLOP-008": { title: "Reflex violet accent", severity: "MEDIUM", tier: "measured", threshold: { hueMin: 260, hueMax: 310, minChannelSpread: 50, headingFontPx: 20 }, fix: "Swap the violet for a neutral surface plus one hue from the actual brand." },
  "SLOP-009": { title: "Gradient-filled text", severity: "MEDIUM", tier: "measured", threshold: null, fix: "Use a solid colour and a weight or size change for emphasis." },
  "SLOP-010": { title: "Glow halo repeated across elements", severity: "MEDIUM", tier: "measured", threshold: { recurCount: 2 }, fix: "Drop the coloured halo; use a neutral offset shadow or none." },
  "SLOP-011": { title: "Floating blob decoration", severity: "MEDIUM", tier: "derived", threshold: { maxOpacity: 0.3 }, fix: "Remove the blob or tie it to a real focal point.", judgment: "keep only with a stated atmospheric or focal purpose" },
  "SLOP-012": { title: "Decorative dot or grid background", severity: "MEDIUM", tier: "measured", threshold: { maxCellPx: 48, hairlinePx: 2, dataSvgPx: 48 }, fix: "Remove the pattern unless it stands in for a real chart or map." },
  "SLOP-015": { title: "Accent stripe on rounded cards", severity: "MEDIUM", tier: "measured", threshold: { minStripePx: 2, neutralSidePx: 1, minSaturation: 0.3, minCount: 2, barMinPx: 3, barMaxPx: 12, barInsetPx: 20, minChannelSpread: 30, minAlpha: 0.1 }, fix: "Drop the coloured stripe; carry emphasis with the card fill or an icon." },
  "SLOP-016": { title: "Reflex default font", severity: "MEDIUM", tier: "measured", threshold: { families: ["inter", "roboto", "open sans", "lato", "montserrat", "arial", "helvetica", "fraunces", "mona sans", "plus jakarta sans", "space grotesk", "recoleta", "instrument sans", "instrument serif"] }, fix: "Choose a face that suits the product, or record why the common one was kept.", judgment: "not a finding when the design records a reason for the font" },
  "SLOP-019": { title: "Too many font families", severity: "MEDIUM", tier: "measured", threshold: { max: 3 }, fix: "Cut the page back to at most three families." },
  "SLOP-020": { title: "Long all-caps text", severity: "LOW", tier: "measured", threshold: { maxChars: 40 }, fix: "Keep uppercase for short labels; sentence-case the rest." },
  "SLOP-021": { title: "Mid-gray text on a coloured surface", severity: "MEDIUM", tier: "measured", threshold: { minLightness: 0.4, maxLightness: 0.7, maxTextSaturation: 0.1, minSurfaceSaturation: 0.25, surfaceLightness: [0.1, 0.95] }, fix: "Tint the secondary text from the surface's own hue instead of neutral gray." },
  "SLOP-023": { title: "Pure black or white base", severity: "LOW", tier: "measured", threshold: null, fix: "Shift the base a few percent toward the brand's neutral (off-white, off-black)." },
  "SLOP-027": { title: "Endless pulse with no state", severity: "LOW", tier: "measured", threshold: null, fix: "Remove the pulse or bind it to the live status it claims to show." },
  "SLOP-029": { title: "Eyebrow above most headings", severity: "MEDIUM", tier: "measured", threshold: { maxWords: 4, minTrackingEm: 0.05, maxSizeRatio: 0.75, sectionShare: 3 }, fix: "Drop the eyebrow labels; the heading already names the section." },
  "SLOP-030": { title: "Decorative section numbering", severity: "MEDIUM", tier: "derived", threshold: { minDistinct: 2 }, fix: "Remove the 01/02/03 labels unless the order is a real sequence.", judgment: "keep when the numbers describe real steps" },
  "SLOP-033": { title: "Middle-dot strip", severity: "LOW", tier: "measured", threshold: { maxDots: 2 }, fix: "Break long metadata strips into lines or columns instead of chaining middle dots." },
  "SLOP-036": { title: "Marketing stock phrase", severity: "MEDIUM", tier: "measured", threshold: { phrases: ["unleash the power", "unleash your", "supercharge your", "seamless experience", "seamlessly integrate", "next-gen", "next-generation platform", "cutting-edge", "game-changing", "game changer", "best-in-class", "world-class", "state-of-the-art", "unlock the power", "harness the power", "leverage the power", "to the next level", "elevate your", "empower your", "revolutionize the way", "revolutionize your", "transform the way you", "all-in-one platform", "one-stop shop", "end-to-end solution", "industry-leading", "future-proof", "effortlessly manage", "차세대 플랫폼", "혁신적인 솔루션", "원스톱 솔루션"] }, fix: "Replace the phrase with a specific claim about what the product does." },
  "SLOP-037": { title: "Placeholder brand name", severity: "MEDIUM", tier: "measured", threshold: { names: ["Acme", "Globex", "Initech", "Contoso", "NovaCore", "Flowbit", "Quantumly", "Nexus"] }, fix: "Name the product from the brief.", judgment: "not a finding when it is the product's real name" },
  "SLOP-038": { title: "Placeholder person name", severity: "MEDIUM", tier: "measured", threshold: null, fix: "Use a specific, locale-appropriate name." },
  "SLOP-039": { title: "Repeated 'Not X. Y.' cadence", severity: "LOW", tier: "measured", threshold: { min: 3 }, fix: "Vary the sentence rhythm; keep the device to one use at most." },
  "SLOP-040": { title: "Em dash in copy", severity: "MEDIUM", tier: "measured", threshold: { min: 1, carveOutSeverity: "LOW", hanShare: 0.3 }, fix: "Rewrite with a period, comma or parentheses." },
  "SLOP-041": { title: "Unsourced stat-shaped number", severity: "MEDIUM", tier: "derived", threshold: null, fix: "Cite the real figure, label it as an example, or cut the number.", judgment: "clears when the figure comes from the brief, brand guidelines or public metrics" },
  "SLOP-043": { title: "Div-built product screenshot", severity: "MEDIUM", tier: "derived", threshold: { minWidthPx: 240, minHeightPx: 160, dotMaxPx: 14, chromeBandPx: 48 }, fix: "Use a real screenshot, an image, or a real component preview.", judgment: "a real component preview renders the same shape; decide whether it is a stand-in" },
  "SLOP-045": { title: "Identical stat blocks", severity: "MEDIUM", tier: "derived", threshold: { minSiblings: 4, ctaSiblings: 3, sizeRatio: 1.5, heightTolerancePx: 4 }, fix: "Remove the stat row unless the brief asked for it, and back each figure with a source.", judgment: "clears when the brief asked for the figures and each has a real source" },
  "SLOP-046": { title: "Decorative gauge or sparkline", severity: "MEDIUM", tier: "derived", threshold: { sparklineMaxPx: 64 }, fix: "Remove it unless it encodes a real, current data point; then label the value.", judgment: "clears when it encodes a real data point" },
  "SLOP-047": { title: "Illegible logo ticker", severity: "MEDIUM", tier: "measured", threshold: { maxLogos: 6, minLogoPx: 20, viewport: "1440" }, fix: "Slow it down, enlarge the logos, or show them as a static row." },
  "SLOP-048": { title: "Autoplay dots with no binding", severity: "LOW", tier: "derived", threshold: { dotMaxPx: 16, minDots: 2 }, fix: "Remove the dots or make each one a named, focusable button that picks its slide." },
  "SLOP-051": { title: "Illustration stacked from primitives", severity: "MEDIUM", tier: "derived", threshold: { minShapes: 8, minSizePx: 200, minFills: 3, maxText: 2 }, fix: "Use a drawn or licensed illustration, or simplify it.", judgment: "a data graphic or diagram with an honest shape count clears it" },
  "SLOP-052": { title: "Organic clip-path mask", severity: "LOW", tier: "measured", threshold: { minVertices: 10, grid: 25, gridTolerance: 0.5, minCurves: 3 }, fix: "Use a real photographic crop or a simple deliberate shape." },
  "SLOP-053": { title: "Emoji used as an icon", severity: "LOW", tier: "measured", threshold: { maxControlPx: 32 }, fix: "Use the project's icon set instead of emoji.", judgment: "not a finding when the brief asks for emoji" },
  "SLOP-057": { title: "Broken image", severity: "HIGH", tier: "measured", threshold: null, fix: "Fix the image source or remove the element." },
  "SLOP-058": { title: "Link goes nowhere", severity: "HIGH", tier: "derived", threshold: { decorativeSeverity: "MEDIUM" }, fix: "Point the link at a real destination, or make it a button that does something." },
  "SLOP-059": { title: "Typeless button beside another submit", severity: "HIGH", tier: "derived", threshold: { minSubmitButtons: 2 }, fix: "Add type=\"button\" (or type=\"submit\" when it really submits)." },
  "SLOP-060": { title: "Placeholder or lorem text", severity: "LOW", tier: "measured", threshold: null, fix: "Replace filler with real copy for this product." },
  "SLOP-061": { title: "Scrolling marquee text", severity: "LOW", tier: "measured", threshold: null, fix: "Use a static row, or add a real pause control." },
});

// Responsive matrix (RS-001..RS-004). Widths up to CF-701's touchMaxViewportPx are touch-primary,
// including the zoom row. The zoom row is the 1440 px desktop at 200 %, emulated by halving the
// CSS viewport at double device scale.
const touchMax = RULES["CF-701"].threshold.touchMaxViewportPx;
export const MATRIX = Object.freeze([
  { id: "320", width: 320, height: 640, pass: "base" },
  { id: "390", width: 390, height: 844, pass: "base" },
  { id: "768", width: 768, height: 1024, pass: "base" },
  { id: "1440", width: 1440, height: 900, pass: "base" },
  { id: "390-dark", width: 390, height: 844, pass: "dark", media: "dark" },
  { id: "390-reduced-motion", width: 390, height: 844, pass: "reduced-motion", reducedMotion: true },
  { id: "1440-zoom200", width: 720, height: 450, scale: 2, pass: "zoom" },
].map((viewport) => Object.freeze({ ...viewport, touch: viewport.width <= touchMax })));

export const LIMITS = Object.freeze({
  findingsPerRule: 12,
  findingsPerViewport: 150,
  nodes: 3000,
  textChars: 4000,
  pairControls: 300,
  settleMs: 1200,
  viewportBudgetMs: 20_000,
  totalBudgetMs: 180_000,
});

export const SEVERITY_ORDER = Object.freeze(["HIGH", "MEDIUM", "LOW"]);

// Exit 0 needs all seven matrix rows and no measured or derived HIGH; exit 1 wins over an
// incomplete matrix; everything else that stops the contract is exit 2.
export const EXIT = Object.freeze({ clean: 0, high: 1, blocked: 2 });

// Fixed BLOCKED reasons, keyed by the chrome-driver blocker they come from.
export const BLOCKED_REASON = Object.freeze({
  BLOCKED_BROWSER_DRIVER_UNAVAILABLE: "browser unavailable",
  BLOCKED_BROWSER_IDENTITY_UNVERIFIED: "browser identity unverified",
  BLOCKED_BROWSER_DRIVER_CLEANUP_FAILED: "browser cleanup failed",
  noEntry: "no entry page found",
  matrixIncomplete: "matrix incomplete",
});

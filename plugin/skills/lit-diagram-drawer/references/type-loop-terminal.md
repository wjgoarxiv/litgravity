# Loop in terminal frame

Catalog ID: loop-terminal

## Purpose and selection

Choose this variant when a loop is presented as a command-line or developer-tool concept and a restrained terminal window helps signal that context. The diagram inside stays the canonical Loop: a genuine clockwise cycle, one shared-state hub, and optional dashed write-backs. The terminal chrome wraps the same diagram and adds no grammar of its own.

## Exclusions

Pick the plain [Loop](type-loop.md) for reports, slides, or audiences that gain nothing from the terminal metaphor. The frame is a visual setting only, so it never suggests that a command ran, a log was captured, or the output is executable. Use the terminal primitive for real short command/output excerpts, and keep technical diagrams free of imitation shell transcripts.

## Content schema

Accept the Loop schema as it stands: five to eight ordered stations, exactly one hub, a true closing transition, optional station-to-hub write-backs, and at most one focal station. Add a short window title or filename-like context string and an optional single prompt line describing the diagram concept. The prompt is decorative framing text that nobody should copy or execute.

## Deterministic layout recipe

Build a dark terminal frame with a 12px outer corner radius, a 1px border, and a narrow title bar. Place three small neutral window marks at the leading edge as decoration, and center a compact terminal-title string in the header. In the content area, stack one subdued prompt line, then the diagram title, then the Loop SVG at its original 1040 × 680 size. At a 1200px maximum frame width, keep the SVG's 900px minimum width and give its container local horizontal scrolling on narrow screens. The title bar, prompt, heading, and diagram keep that fixed vertical order. [Loop](type-loop.md) produces the diagram geometry, and its labels scale only with the whole SVG.

## Encoding rules

Use the shared dark semantic tokens in place of a neon terminal palette. The shell frame takes restrained borders, and the diagram keeps the Loop's neutral ring, dashed write-backs, single hub, and optional single focal station. Use a monospace face for the prompt and window label only. Prose and station labels stay in the sans role, with Pretendard for Korean. The prompt glyph and window marks are decorative and sit outside the graph's meaning.

## Korean behavior

Keep all station and hub text in Hangul when requested, in its original spelling even if a transliteration would look more technical. The window label can remain a product name or become a short Korean topic label. Remove the prompt line if it makes the Korean title wrap awkwardly. Use Pretendard for the title and graph labels, with mono reserved for the brief frame metadata.

## Light, dark, and full variants

This is a dark-frame presentation variant by intent. When a light deliverable is required, drop the shell and apply the plain Loop in the requested skin. The full version may add outside framing text and a source note; the terminal window remains a single frame and the internal graph is unchanged. Hide the terminal window dots and prompt ornament from assistive technology.

## Accessibility

Give the inner SVG its own title and description. The document title describes the subject and leaves out any pretend command. Mark decorative window dots and prompt glyphs as hidden from screen readers. Keep a linear station list after the graph, and make the local scrolling keyboard-accessible with a visible focus indicator. An explicit diagram description carries the meaning, so the frame's color and monospace face play only a decorative role.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for frame bounds, inner SVG clipping, mobile overflow, contrast, semantic title/description, reading order, and visible-text checks. Run scripts/verify-type.mjs --type=loop-terminal to confirm the inner loop satisfies the Loop contract and the frame leaves the geometry unchanged. Inspect desktop and narrow viewport screenshots, and run humanizer checks over the prompt, title, and diagram text. When the user requested a light skin, verify that the shell is omitted and the plain Loop tokens are in use.

## Anti-patterns

- A glowing cyan/purple shell or a fake syntax-highlighted log.
- An invented command presented as though it ran.
- Terminal controls or a caret inside the graph's semantics.
- Loop stations reflowed to fit the frame, which breaks the base geometry.
- A light terminal theme where the plain light Loop reads clearer.
- Monospace on every text role.
- Frame ornament that alters the screen-reader reading order.

## Related references

[Loop](type-loop.md) · [Terminal primitive](primitive-terminal.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Motion guide](motion.md)

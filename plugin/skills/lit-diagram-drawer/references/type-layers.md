# Layer stack

Catalog ID: layers

## Purpose and selection

Pick a layer stack for ordered abstractions that rest on one another: protocol stacks, application layers, system boundaries, memory levels, or policy layers. A single shared width makes the hierarchy and its direction easy to compare.

## Exclusions

Choose swimlane when groups perform concurrent work, architecture for components linked across zones, nested when containment is the meaning, and a table for a flat list. Stack only items that have a parent/child or ordered relationship, so the stack never serves as decoration.

## Content schema

Provide a title and one explicit ordering principle, such as higher-level to lower-level or request to physical storage. Supply 4–6 ordered layers. Each layer has a short name, an optional index or stable ID, and a concise note or technical detail. Name zero or one focal layer and state why it deserves emphasis. Declare the direction in words.

## Deterministic layout recipe

Center the stack at 800–880px wide inside a 1000px viewBox. Place 4–6 full-width horizontal bands, each 56–72px high, stacked with no vertical gap, and give every layer the same x and width. Allocate a 56px left gutter for a direction marker and 24px of internal side padding for text. Each row holds a mono index at the left, a 14–16px semibold layer name near the left-center, and a muted sublabel aligned right. A 1px hairline separates rows, and a stronger outline bounds the whole stack. Snap band edges to the 4px grid. When sublabels overflow, shorten them or move them to a separate key, and keep row heights uniform whatever the prose length.

## Encoding rules

Choose one fill strategy for the whole stack: paper with hairline separators, or two alternating near-paper tones. Give one focal layer a restrained accent tint and outline, and leave every other layer neutral. Place an up/down arrow with a short label outside the stack to declare the ordering. The vertical arrangement already communicates sequence, so reserve inter-layer arrows for a transfer relation that is separate from the layer order.

## Korean behavior

Write layer names in Hangul for a Korean audience, and keep common protocol names such as TCP/IP and HTTP as authored. Add English expansions in a note when they materially help. Use Pretendard for Korean names and keep mono indices short. Allow a two-line note when every layer follows the same rule. Keep lettering horizontal and preserve a generous line height for Hangul.

## Light, dark, and full variants

Light and dark variants keep layer order, the focal layer, band height, and labels. Swap semantic fills and strokes while the direction arrow keeps its meaning. The full editorial version can add a small context sentence and a source note above or below the stack. Cards that repeat each layer's name add nothing. Embedded slide versions look best on a plain background.

## Accessibility

Use the SVG title and description to state what is layered and which direction to read. Keep the direction phrase in text so it survives without the arrow. Provide a numbered text list for screen readers and grayscale print. Contrast must hold on both the focal tint and the alternating row fills.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for bounds, row overlap, clipping, contrast, skin inversion, SVG semantics, and visible text. Run scripts/verify-type.mjs --type=layers to check 4–6 rows, a common width, ordered IDs, one focal layer at most, a consistent fill mode, and the direction marker. Inspect a render at the final size and run humanizer checks on the title, labels, and notes.

## Anti-patterns

- Layers that lack a real hierarchy.
- Skipped numbering with no explanation.
- A different strong hue on every layer.
- Unequal heights that carry no meaning.
- Arrow clutter between adjacent bands.
- A focal stripe that the title or description never names.
- Rotated Hangul labels or unreadably small detail.
- Extra framing that pushes the useful stack below the fold.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md)

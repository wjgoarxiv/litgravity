# Medallion data tiers

Catalog ID: medallion

## Purpose and selection

Pick this type for a governed data pipeline with ordered quality and access tiers, such as landing, raw, cleaned, curated, and archive. Each tier card states the container, the format, the accountable writer, and a concrete sample payload. Promotion arcs describe the transformation from one adjacent tier to the next, and optional path cards describe write methods.

## Exclusions

Choose High-Level for a full platform topology, data-flow for role-by-step responsibilities, and Marimekko for measured composition. Reserve medallion for pipelines with real data-quality promotion, so a plain row of services or an ungoverned process belongs elsewhere. Describe only the promotion and access policy that the source establishes.

## Content schema

Provide 3–5 ordered tiers. Each has a stable name, a storage bucket or location, fields for tool, format, writer, and one or two example payloads, and exactly one focal flag across the whole diagram. Provide one promotion label for every adjacent pair and declare normal, focal, or lifecycle semantics. Include a sample-data caption. Add zero to two optional write-path cards, each with a tag, a method title, and a short description. Choose exactly one focal tier; when none is supplied, ask which analytical or policy pivot should lead.

## Deterministic layout recipe

Lay out a horizontal tier strip of 172 × 380px cards with 16px gaps, a 16px left inset, and an 80px arc band above the cards. Place cards at y=80 with centers evenly spaced across the strip. The canonical five-tier SVG is 1040px wide; derive the width from the tier count and gaps, and retain a 100px right legend margin. Below the tiers, reserve a 16px gap and a 56px height for each path card. Promotion arrows are cubic curves arching over the top from the center of one tier to the next, with control points at y=0 and labels at y=50. This arc is the defining connector and a specific exception to orthogonal routing. The total height covers the arc band, the cards, the optional path row, the legend, and the bottom margin. Use a deterministic 4px grid for card and frame geometry.

## Encoding rules

Use quiet neutral cards with a 40px header band and four labeled information fields, and keep the example payload visibly separate near the bottom. Styles distinguish the outer input, the ordinary tier, the one focal tier, and the cold archive. The focal tier gets a restrained accent outline and tint, its incoming arc may use accent, and a terminal lifecycle arc stays dashed. Outside the focal tier, use at most two justified custom colors. Promotion runs left to right only. Path cards name how data moves, while tier fields describe what each tier contains, so transformations belong in the promotion labels.

## Korean behavior

Use concise Hangul names for stages and field headings, and keep storage identifiers and format names as authored. Hold the field order constant across every card so Korean readers can compare the same slot from tier to tier. Wrap long tool, format, and writer strings to two lines within the field width, and add an adjacent expanded description when more room is needed. Use Pretendard for Korean text and mono for technical formats, bucket paths, and abbreviated tags. State every transformation in the language the audience uses.

## Light, dark, and full variants

Light and dark variants share card size, order, fields, arcs, sample payloads, and the focal tier. In dark mode, invert the surface roles, keep the dashed archive treatment, and lighten custom colors only as far as contrast requires. The full editorial variant adds an outer framing title, a subtitle, and optional summary cards outside the tier strip, with every tier and the transformation order intact. Export to slides with the Office guide's safe margins and a table fallback for field-level detail.

## Accessibility

Add an SVG title and description stating the number and order of tiers, the promotion meaning, the focal tier, and the terminal archive semantics. Give every card field a visible heading, and mark the focal tier and lifecycle with more than color. Provide a linear text list or table of tier fields, particularly when the figure will be inserted in Office. Keep arc labels clear of the curve and the card text.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for card bounds, overlaps, arc-label spacing, clipping, contrast, skin polarity, SVG semantics, and visible text. Run scripts/verify-type.mjs --type=medallion to confirm tier count and order, four fields per tier, one sample payload per tier, exactly one focal tier, adjacent left-to-right promotions, the path-card cap, and marker landing. Compare the visible data with the source before export, inspect the screenshot, and run humanizer checks on all text.

## Anti-patterns

- A tier with no unique payload example.
- More than one focal tier, or a guessed focal policy.
- Bidirectional or non-adjacent promotion arcs.
- Straight through-gap arrows in place of top arcs.
- A cold dashed treatment on a tier that is not the archive.
- More than two custom-colored components, or color-coded connector semantics.
- Path cards that explain what a tier stores in place of how data is written.
- Text too long for the fixed tier card and hidden behind an export crop.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md)

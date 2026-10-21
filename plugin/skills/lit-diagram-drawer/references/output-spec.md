# Diagram output specification

The editable source is one self-contained HTML file whose primary content is one inline SVG. Text stays text. A standalone SVG is a supported source too when no editorial header or control surrounds it.

## Canvas presets

| Preset | ViewBox | Safe inset | Typical use |
|---|---:|---:|---|
| slide-16x9 | 1280 × 720 | 64px horizontal, 48px vertical | Widescreen presentation |
| slide-4x3 | 960 × 720 | 48px | Standard presentation |
| doc-inline | 960 × 600 | 40px | Word body column |
| doc-wide | 1200 × 675 | 48px | Landscape report or wide page |
| social-square | 1080 × 1080 | 64px | Square post |
| fit | Content-derived, then snapped to 4px | 5% of each edge | One-off canvas |

These are pixel-space SVG coordinates and carry no physical print size. For print, choose the page ratio first and render at a resolution that suits the final page.

Use a fixed viewBox and keep its ratio. Titles and captions stay inside the safe inset. An overloaded layout gets split, and the full SVG stays at its size.

## Content contract

- The root SVG has a unique id, a viewBox, `role="img"`, `aria-labelledby`, a first-child `<title>` and a useful `<desc>`.
- Title, description, marker, clip and filter ids start with the diagram slug and variant.
- Title, groups, connectors, nodes, labels and legend appear in reading order. Connectors come before the nodes they join.
- A visible key accompanies any line type, symbol, color or abbreviation that needs explaining.
- Units, signs, date range, uncertainty and source meaning carry over from the brief. Data stays real, and precision matches what the brief supplied.
- The diagram carries its own accessible description, so no neighboring paragraph has to name it.

## Variants

- light: paper canvas, dark ink, neutral marks and a restrained warm accent.
- dark: dark paper, light ink, theme-specific rule and connector values and a readable accent.
- full: a title, concise context, an optional key and a takeaway around the same layout, within the selected canvas.

The full variant is still a single diagram. It is a framing choice, and density stays the same.

## File expectations

- The HTML holds inline CSS and SVG. A script element appears only for a requested motion example that uses the one documented controller.
- Font URLs point at the bundled local files. Static review examples work offline.
- Office export uses SVG 1.1-compatible shapes and attributes. Filters, CSS variables in presentation attributes, blend modes, external images, external stylesheets and network fonts have no place in it.
- The source SVG stays accessible when a PNG is delivered.
- PNG scale is 1×, 2× or 3×. A 3× export is the default for placing the canvas at native size in a slide or document.
- Review and example PNGs stay small enough to inspect and share; the eight pair exports are capped at 400 KB each.

## Layout admission

When labels collide, trim wording only where the meaning survives; otherwise widen the layout or make a second diagram. When a long connector hides the reading path, reroute it or introduce a labeled boundary. Every fact is visible without hover, and sequence reads without motion.

# Korean and mixed-script labels

Sans text and Hangul use the bundled Pretendard variable font. Code-like values keep their own monospace role. The font is pinned and licensed under `assets/fonts`, and a render never fetches a web font.

## Weight and size

- Weights: 400 for supporting text, 500 for ordinary node labels, 600 for emphasis, 700 for the diagram title.
- Hangul node names start at 12px; the comfortable working range is 14 to 18px.
- Hangul line-height sits around 1.45 to 1.55. A node may hold two lines before it needs widening or a shorter label.
- When a Korean label will not fit, rewrite it with the concept intact, widen the layout or split the diagram. The legibility floor stays where it is.

## Mixed Hangul and Latin

- Keep an ordinary word space where Korean prose meets a Latin name, version or acronym: 결제 API v2.
- Official identifiers, endpoints, ports, field names and commands keep their exact Latin form in the mono role.
- Set `word-break: keep-all` with `overflow-wrap: anywhere` as the safety fallback. Hangul takes no letter-spacing.
- A Korean noun phrase keeps its own spacing; adding spaces only to make a label fit changes the text.
- Mark Korean-only text with `lang="ko"`, and wrap mixed passages in a language span when speech output benefits.

## Numbers and dates

- Group large counts with commas: 12,500건. Decimal points and signs stay exact.
- Put a nonbreaking space between a value and a Latin unit where a wrap would split them: 18 ms, 2.4 GB.
- Pick one Korean date style, such as 2026. 9. 25., or a full ISO date when machine ordering matters, and use it throughout the diagram.
- Comparable quantities align with tabular numerals. Units live on axis ticks or labels once, not in every cell.
- A number format supplied by the user stays as supplied when it carries source meaning.

## Measure labels per glyph

Hangul syllables and wide punctuation take about one em. Latin letters and digits take narrower advances, and spaces and punctuation take width too. Estimate a mixed string from its real characters, then confirm the rendered label in a browser. Counting by script alone drops digits and punctuation from the total.

## Review

Look at uncommon syllables, 받침, Latin acronyms, numbers and punctuation in light and dark. Watch for missing-glyph boxes, fallback-font jumps, baseline shifts, clipping and line wraps. The bundled full variable font keeps the whole Hangul repertoire available offline.

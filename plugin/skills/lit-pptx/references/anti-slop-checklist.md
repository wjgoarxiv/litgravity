# Anti-Slop Checklist for PPTX Outputs

Run after building any deck. Palette, faces, radius and decoration come from the chosen tonality pack (or the named legacy template); this checklist holds for all of them.

## Automated checks
- `python3 "$SKILL_ROOT/scripts/qa_deck.py" output.pptx` — honest gate: overflow/overlap/off-slide + WCAG contrast + anti-slop terms + objective executive/research OOXML checks (exit non-zero = FAIL).
- `python3 "$SKILL_ROOT/scripts/layout_inventory.py" output.pptx --issues-only` — geometry issues only.
- A clean gate means **no known defects, not that the deck looks good** — render and eyeball every slide (next section).

## Human-eye checks

### Slide-level
- Every slide has a real, specific title (not placeholder text).
- Accent colors are semantic, not decorative.
- No slide looks like a spreadsheet pasted without editing.

### Table-level
- Header row visually distinct; numeric columns right-aligned.
- Units in headers, not repeated per row; totals obvious but not over-decorated.

### KPI / metrics
- Primary metric is the largest element; delta color is consistent deck-wide; labels are secondary. ≤ 1 accent + optional delta color.

### Text hygiene
- No `TBD`/`TODO`/placeholder/AI-hype wording (gated by `scripts/forbidden-terms.json`).
- Source notes exist for external numbers/charts. Headers are specific (avoid bare "Value"/"Metric"/"Score").

### Executive/research copy: hard fail vs review-only

- **Hard fail:** authoring/process trace (`본 슬라이드는…`, `슬라이드 7은…`, `최종본에서 걸러냈다`) and unresolved placeholders (`[자사 확인 필요]`, `[출처 확인 필요]`, `[작성 중]`).
- **Review-only:** unsupported absolutes (`논문이 없다`, `없다는 것이 발견`), empty rhetoric (`판이 굳었다`, `전제로 깐다`), command-like planning (`닫아야 할 게이트`, `역전 금지`), unexplained RAM/FTO/CNKI/코퍼스/전이원, and arbitrary dates or day counts without an approved source.
- Review-only findings must be recorded and rewritten where warranted, but they do not become brittle automated failures. Prefer “검토한 데이터베이스 범위에서는 확인되지 않았다” and expand specialist terms on first use.

## Visual design laws

These are judged by eye on the rendered pages, after the automated checks pass. They hold for every
tonality; where a law depends on the direction (radius, display size, which decoration is allowed),
the tonality pack sets the value and the law says where to look.

### Bans that hold in every direction
- [ ] A coloured stripe down one edge of a card is never an accent. Mark the item with a hairline
  above it, a flat tint, or a real numeral beside it instead.
- [ ] One surface gets one edge: an outline or a soft shadow, never both. An outlined box with
  nothing in it is clutter, not structure. The one exception is a pack that draws a hard offset
  shadow (`shadow:` in the pack, Neo-Brutalism): every surface there takes the border and the
  shadow together, with no blur, and no other shadow appears in the deck.
- [ ] Corners follow the pack (`radius` 0 or 6) on every surface of the deck; fully rounded shapes
  are for small tags only.
- [ ] A row of identical cards is a filler pattern. Vary the span, let one element lead, or set the
  points as a list or a comparison.
- [ ] Ordinals (`01 · 02 · 03`) and small labels above titles appear only where the order is real.
- [ ] A large number appears only when it is the slide's evidence, sourced and labelled.
- [ ] No card inside a card and no card around everything; group with space and hairlines.
- [ ] Flat grounds only: no gradients, blobs, glows, mesh or noise textures, no hand-drawn marks.
  Bands, rails and colour fields come from the pack's decoration list, plus any kinds the deck adds
  from the shared set with `decoration:` in its front matter.

### Colour inside the pack
- [ ] Body text and captions reach 4.5:1 on the fill they actually sit on; large text and structural
  lines reach 3:1 (`qa_deck.py` measures the pairs).
- [ ] Grey text never sits on a coloured fill; use the fill's own `on-field` or `accent-deep` role.
  A colour never carries meaning alone: deltas also carry ▲/▼ and a sign.
- [ ] Each accent hue means one thing across the deck; a slide carries at most four accent hue
  families (OF-101 fails at five). Every colour comes from the pack's roles; no one-off hex per slide.

### Type
- [ ] Pretendard Regular and Bold by default; A2Z only when the user or the source asks
  (`faces: a2z`), then at most three faces from two families, A2Z weights chosen by family name.
- [ ] One ramp per deck (presented or reading), at most four sizes on a slide, no near-equal pairs.
  Cover, section and statement titles take the hero step when they fit (`hero: false` turns it off);
  a figure is set at title size at most, with its label, unit, basis and source.
- [ ] Titles and subtitles are topic labels, never declarative sentences (OF-114); the claim opens
  the body.
- [ ] Headings at 1.1-1.2 line height, body at 1.3-1.45 (Korean at the loose end).
- [ ] No single word alone on a title's last line; break by hand at a 어절 boundary.

### Layout and hierarchy
- [ ] At a squint each slide shows one primary element and its groups.
- [ ] One primary element per slide, about twice the next level; a long group splits into labelled
  sub-groups rather than losing items.
- [ ] Gaps come from one scale (6, 12, 18, 24, 36, 48, 72 pt), smaller inside a group than between
  groups; one alignment edge per region.
- [ ] Every line, box and field carries information or structure; anything else goes.
- [ ] The title treatment matches the slide's job, and every title sits in the slide grid's one
  title zone whatever its treatment or tonality (`title-treatments.md`).
- [ ] The body reaches toward the floor on content slides (`density-and-fill.md`).

### Craft-floor checks (enforced by `scripts/craft_extras.py` through `qa_deck.py`)

- [ ] OF-101: at most four accent hue families on a slide; five fail, with no advisory step below.
- [ ] OF-102: wrapped body lines stay at or under 90 characters (38 for Korean); a column under 10 characters over 3+ lines is advisory.
- [ ] OF-103: every numeric table column is right-aligned; an inherited alignment is advisory.
- [ ] OF-104: a symmetric nested frame keeps inner radius = outer radius minus padding.
- [ ] OF-105: the gap between cards is at least twice the smallest gap between two shapes inside a card (a shape's inset to its own card edge is padding and does not count). Advisory (MEDIUM) until the family's calibration re-run promotes it.
- [ ] OF-106 / OF-107 / OF-108: no gradient-filled text, no glow, no emoji bullets.
- [ ] OF-109: no single empty band over 35% of the content area or of a card (25 to 35% is advisory); in a row of equal-height cards the row counts its smallest trailing band. Fill it, shrink the region, or merge slides.
- [ ] OF-110: a deck of eight or more slides uses at least three title treatments and no more than its variance allows; every title is one of the eight treatments and is drawn as the treatment its name says.
- [ ] OF-111: content slides do not share one composition (title zone × body partition × dominant content) on more than 40 % of them, and show at least ceil(0.6 × content slides) distinct ones, capped at 5.
- [ ] OF-112: the median empty band under the body's last block stays at or under 0.20; a slide over its density cap is an advisory.
- [ ] OF-113: every content title sits on the slide grid's one title frame and every statement on the display frame, within 1 pt, whatever the treatment.
- [ ] OF-116 (with `--sibling`): the same source under another tonality puts each slide's title and body in the same places.
- [ ] OF-115: no region stands empty: a takeaway column that runs as long as the chart, table or picture beside it (its largest empty band, not its last block: a source strip at the foot does not hide the band above it, and a chart's values table under the takeaways belongs to the column), a picture drawn as tall as its column allows, a title panel as tall as its text, and no plate under an empty page.
- [ ] OF-116: run `qa_deck.py deck.pptx --sibling other.pptx` when two tonalities of one source are offered; their skeletons (title zone and partition per content slide) must differ on at least two content slides (one on a deck of fewer than four).
- [ ] OF-117: no mostly-white figure picture on a dark tonality; give it a `.dark` variant or draw it as a native chart.
- [ ] OF-118: a bold run-in label is followed by its separator ("**요약:** …"); the engine adds the colon when the source leaves it out, so a finding means the label was set by hand.
- [ ] OF-119: an agenda title stands without a numeral beside it; the agenda's rows carry the numbers.
- [ ] OF-120: a hard offset shadow (an outer shadow with no blur) appears only in a pack whose `qa:` block sets `offset-shadow: true`, and such a pack never mixes a soft shadow in.

### Pack allowances (`qa:` in pack.yaml)

A direction may need one rule widened, and only through its own pack. The gate reads the `qa:`
block of the pack the deck stamp names; any other deck keeps the defaults. The registry refuses an
unknown key or a value out of range.

| Key | Range | Effect |
|---|---|---|
| `accent-families` | 5-6 | accent hue families a content slide may carry before OF-101 fails (default 4; the limit only widens) |
| `display-accent-families` | 5-6 | the same for cover, section, statement and closing slides (default 4) |
| `offset-shadow` | true | OF-120 passes the pack's hard shadow; needs `shadow:` in the pack |

Contrast floors, the body size floor and every other check stay as they are for every pack.
- [ ] On a legacy template OF-110, OF-111 and the OF-112 median are advisories, because the user asked for that template's single look.

### Objective evidence checks

- [ ] No explicit run is below the absolute 6pt floor. Primary reading text remains ≥12pt; captions/sources may use 6–10.5pt.
- [ ] No colored vertical side-stripe is attached to a card. A full-width structural rule is not a side stripe.
- [ ] A picture or table is not materially covered by a later text/image/table object.
- [ ] A picture declared as `figure`, `evidence`, or `source capture` has a visible adjacent numbered caption and `Source:`/`출처:`.
- [ ] Every appendix DOI, canonical-link, or raw-URL field contains an actual external OOXML hyperlink relationship; detection does not depend on a special “link available” phrase.
- [ ] Thumbnail review still judges hierarchy, whitespace, chart intuitiveness, executive tone, and whether caption/source/interpretation read as one group.

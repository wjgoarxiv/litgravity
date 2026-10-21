# Paper

Paper treats the screen like a printed journal page. The ground is white, the type is near-black, and
structure comes from thin rules where other directions use filled boxes. Figures do most of the
talking, each with a numbered caption and a source; tables use the three-rule style readers know from
papers; and one deep crimson is the only colour with a job: it marks the method or result the talk
proposes. The effect is calm and checkable, which is what a room of peers wants while it decides
whether to believe a result.

## When to choose it

Pick Paper for research talks, thesis defences, lab meetings and technical reviews where the audience
reads the evidence closely. Of the eleven families, six are evidence families (`figure-academic`,
`figure-pair`, `chart-insight`, `full-chart`, `table-insight`, `method`), and `references-appendix`
closes the deck with a reference list whose DOIs become real links. Prefer it when the source carries
numbered citations, DOIs or a references section, and when a third of the slides hold a chart. A
written analysis delivered as slides also fits, because hairline tables and numbered figures survive
printing.

The pack file names the mismatch: a sales or launch audience, where the restraint reads as cold
(Signal or Studio carry that energy). The pack has no full-bleed image family and keeps pictures
inside the grid, and a large dark room asks for Night, where thin rules vanish at distance.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F5F5F6 |
| ink / ink-muted / line | #111418 / #50565E / #C9CDD2 |
| accent / accent-deep / accent-tint | #8C1C2B / #5E121C / #F6E6E8 |
| field / on-field | #111418 / #FFFFFF |
| positive / negative | #1E6B3A / #50565E |
| series | #8C1C2B, #111418, #50565E, #2E5E8A |
| faces | Pretendard Bold for display and titles, Pretendard Regular for body, labels and numerals; `faces: a2z` keeps the same map |
| tracking (title / display) | 0 % / -1 % of the size |
| density / variance | 10 / 5 (up to 4 title treatments, all four of the pack) |
| radius / edge | 0 / border |
| table | booktabs: a 1 pt ink rule above the header, 0.5 pt under it, 1 pt at the end; no fill, no banding, right-aligned figures, bold totals |
| chart | hairline gridlines, direct labels, `series-order`: the highlighted series takes the accent, the others take ink, muted ink and the blue in order |
| image | no frame |
| decoration | hairline-rule, box-outline |
| fill-order | anchor-visual, distribute, step-up, change-family |

`edge: border` means every surface (a summary box, a note, a decision box) is an outline in the line
colour with no fill, so the page never gains a coloured card. A drop is shown with the muted ink,
because negative equals `ink-muted`: a sign and a glyph carry the meaning, and the accent stays free for
the proposed method. Without `accent-rule` in the decoration list, a `top-rule` title always sits on a
full hairline.

## Titles by family

Role defaults: content, data, sequences and references `top-rule`; data with a takeaway and images
`bottom-anchor`; definitions `side-rail`; statements `statement`. The pack's `structure` draws a
`comparison` as a ruled table under `top-rule`, and that title stays even when the deck already leans
on it.

| Family | Default title | Then, in pack order |
|---|---|---|
| `figure-academic` | `bottom-anchor` | `top-rule`, `side-rail` |
| `figure-pair` | `bottom-anchor` | `top-rule`, `side-rail` |
| `method` | `side-rail` | `top-rule` |
| `chart-insight` | `bottom-anchor` | `top-rule`, `side-rail` |
| `full-chart` | `bottom-anchor` | `top-rule` |
| `table-insight` | `top-rule` | `bottom-anchor`, `side-rail` |
| `comparison` | `top-rule` | `bottom-anchor`, `side-rail` |
| `quote` | `statement` | `top-rule` |
| `statement` | `statement` | none |
| `text-column` | `top-rule` | `side-rail` |
| `references-appendix` | `top-rule` | none |

A `bottom-anchor` title stands on the floor with a hairline 12 pt above it, so the chart or figure
takes the upper body and the title labels it from below. A table never takes a bottom title while
another title fits. Pin with `title: top-rule` after `layout:` when a figure slide needs the title at
the top.

## Families and variants

- `figure-academic`: one figure with its numbered caption and three bold-headed observations
  (Observation, Basis, Implication).
- `figure-pair`: two figures side by side, for before and after or two conditions.
- `method`: a formula or process figure beside the definitions of its symbols.
- `chart-insight`, `full-chart`: a native chart with two or three takeaways, or across the body; at
  the compact step the chart's values stand in a small table beside the takeaways.
- `table-insight`, `comparison`, `quote`, `statement`, `text-column`, `references-appendix` as the
  list above shows.
- Covers `cover-index` (needs an agenda or two sections), `cover-typographic`, `cover-split-image`;
  sections `section-rule`, `section-field`; closings `closing-summary-list`, `closing-ask`.

Display devices: the typographic cover is a journal title page (a 2 pt rule at y 96, the title, a
hairline, the presenter in bold, then department and date in one line); a statement stands between
two hairlines like an epigraph; a big number sits in an ink outline; a section with an agenda is the
index page, this part in the accent; a closing's next step sits under a hairline on the page foot.

## Do

- Number every figure and table caption and give each a source (the engine numbers them).
- Title each slide with what it shows ("Conversion at 60 min by feed rate"); the finding is the first
  observation.
- Keep the crimson for the proposed method in every chart, so the audience learns its meaning on the
  first plot; name the other series with a reference word (Baseline, Prior, Plan) or a period.
- Put the data fact that bounds a result on the same slide, beside the number it affects.
- End with the reference list; write each DOI or URL as a Markdown link.

## Avoid

- The short accent bar under a title; this direction draws a hairline.
- Coloured card fills.
- The accent on anything other than the proposed method.
- A figure without a numbered caption.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| QA `appendix_links` fails on a slide titled "Appendix" or "부록" | a DOI typed as plain text | write `[doi:10.x/y](https://doi.org/10.x/y)`; the engine writes a hyperlink relationship |
| QA `anti_slop: forbidden_terms` | a word such as "placeholder", "tbd" or "todo" anywhere in a slide | rewrite the entry; the list matches substrings |
| `note: slide 1: cover-index cannot be drawn (the deck has no agenda or sections to list)` | the deck has no agenda and fewer than two section slides | add an agenda or use `cover-typographic` |
| the crimson lands on the baseline series | no period or reference word in the series names, so the last column wins | order the columns baseline first, proposed last |
| a figure slide with no "Figure N." line | the alt text is empty | write the caption as the alt text |

## Two worked slides

A chart slide where the proposed series takes the crimson because the other column is named
`Baseline`. The compile adds the values table beside the takeaways and numbers the caption.

```markdown
---
layout: chart-insight

## Glucose yield at 24 h by enzyme dose

::: chart type=column unit="%"
| Enzyme dose (U/g) | Baseline (%) | Staged addition (%) |
|---|---|---|
| 5 | 41 | 52 |
| 10 | 55 | 68 |
| 15 | 63 | 77 |
| 20 | 66 | 80 |
> Glucose yield at 24 hours, mean of three runs (example data)
:::

- Staged addition raises the yield at every dose, by 11 to 14 points
- The gain is largest at 10 U/g, where yield rises from 55 % to 68 %
- Beyond 15 U/g both curves flatten, so extra enzyme adds little
- Source: example bench log, runs 1-3
---
```

A figure with its observation, basis and implication, each led by a bold label; the compile adds the
colon after each label (OF-118 checks it).

```markdown
---
layout: figure-academic

## Reactor layout with three feed ports

![Figure 2. Reactor with three feed ports along the column | Source: example image](assets/example-b.png)

- **Observation** feed enters at ports A, B and C in a 50/30/20 split by volume
- **Basis** all twelve runs used the same column and the same residence time of 24 hours
- **Implication** the gain in Figure 1 comes from the feed schedule alone
---
```

Both slides compile under `tonality: paper` with `lang: en` and a generic cover (drawn as
`cover-typographic`) and pass `qa_deck.py`; the laboratory and the data are invented.

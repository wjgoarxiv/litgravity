# Craft loop and QA gate

## One round (MO-C-15)

Rounds share one counter (1-3) with the look rounds in `look.md`.

1. `make brief.json --out <dir> --round N --stills-only`: treatment check, pre-flight gate (fonts,
   glyph coverage, timeline), the beat stills, one transition strip per cut, the contact sheet and the
   storyboard `board.png` in `<dir>/stills/`. Nothing is encoded yet. The brief carries no `style`: the
   treatment's style decides the preset.
2. **Look.** Open every file the stills index lists with the Read tool and answer the look questions
   in `look.md`: nothing clipped at the edges, no empty frame at a cut, type legible at its size, the
   preset's palette and nothing else, the accent at most once, no working title or index on screen.
   Record the round with `look --round N`.
3. Fix the brief (a different scene, a different style, better copy) where a still is wrong; rerun
   step 1 when you changed it.
4. `make brief.json --out <dir> --round N`: master with the sound bed, preview, poster,
   reduced-motion still, a second-process determinism re-render, a perf run and the full gate.
5. On exit 13 read `gate-report.txt`, fix the named rule, and start the next round from step 1.

## Stop conditions (MO-C-16)

- Done follows `look.md`: gate PASS, a valid treatment, at least two look rounds (the round-1
  stills round with its change, then a last round on the final full render's stills).
- Round 3 still failing: stop and report the failed rules and what each round changed. The film
  and exports are kept at their names for the user's judgment, except after a flash-audit FAIL.
- **Flash-audit (MO-C-03) FAIL in any round:** the MP4, preview, poster and still move to
  `withheld/`. They are diagnostics, never deliverables, not even as a draft. Say the render is
  withheld pending a fix.
- A blocked environment (exit 10, 11, 12, 14, 15): stop at once and name the fix; more rounds cannot
  repair a missing host tool.
- A frame-time (MO-D-02) FAIL alone still delivers the film with the report.
- Never answer a failure by shortening the film, dropping a shot, or switching the sound to none.

## Gate table

Numbers marked provisional are the spec's proposed defaults, implemented as written until the
user signs them off; the report labels them.

| Rule | Threshold | Typical fix |
| --- | --- | --- |
| MO-C-01 GLSL presence | every frame covered by a look pass that drew | never remove the preset's passes |
| MO-C-02 WebGL2 tier | renderer recorded; software GL labelled | none (environment) |
| MO-C-03 flash audit | <= 3 general and <= 3 red flashes in every 1 s window, master (non-looping) and preview (looping); excursion method, 640x360 window | fewer, slower large changes; no full-frame flips |
| MO-C-04 title-safe | every glyph bbox inside x 96–1824, y 54–1026 | shorter line, smaller size |
| MO-C-05 action-safe (provisional) | non-glyph marks inside x 48–1872, y 27–1053 | move the mark |
| MO-C-06 contrast (provisional size rule) | 4.5:1, or 3:1 at >= 32 px (>= 25 px bold) | use the type colour, not the signal, for small text |
| MO-C-07/08 reading time (provisional) | the floor function in type-craft.md | fewer words per shot, or `hold` |
| MO-A-13 eojeol | reveals are whole eojeol / items | keep items whole |
| MO-A-15 / 16 beat | cuts within 1 frame of a beat; shots >= 2 beats | engine-generated; check custom `hold` |
| MO-C-09 / MO-A-25 determinism | byte-identical `rgbaSha256` in a second process; seeked equals sequential | a scene read a clock or random: fix the scene |
| MO-C-10/11/12 | >= 1920x1080, >= 30 fps, >= 3 s; ffprobe yuv420p / bt709 / tv | engine-set |
| MO-C-13 sizes (provisional) | preview <= 3 MB, poster <= 1 MB; MP4 warn > 100 MB / 10 s | the preview ladder steps down itself |
| MO-C-14 reduced-motion still (provisional) | present; ink >= 0.9x the final text frame | end on a settled end card |
| MO-C-25 tracking (provisional) | display >= -0.04 em; machine voice never negative | |
| MO-C-26 line height | >= 1.5 Latin / 1.6 Korean for 2+ lines | |
| MO-C-27 measure | Latin paragraph cards 60–75 ch | |
| MO-C-29 accent (provisional) | <= 1 signal + 1 accent saturated cluster; accent in one entry, <= 10% of frames | remove the extra colour |
| MO-D-02 perf (provisional) | p95 <= 40 ms (hardware) / 250 ms (software) at samples 1 over >= 120 frames, each timed as the next frame of a sequence | lower octaves; never withholds |
| MO-D-03 empty frames (provisional) | no empty near-black run longer than 2x the minimum hold (+1 s at the ends) | a scene that failed to paint |
| MO-D-04 glyphs (provisional) | every character in its run's font | change the text or style |
| MO-SH-01..11 | seed formula, event budget, glitch/surge/flicker caps, dither seed per shot, guides off, <= 2 terminal layers, software downgrade | engine-enforced; report any FAIL as an engine defect |
| MO-A-33, MO-FT-04, MO-A-58 | Hangul weights from the lit-pptx pair only; no tracking or width motion on Hangul; post overrides in range, invert only on cuts | |

## Report (MO-C-17)

`gate-report.txt` starts with the fixed render-report block (outputs, preset and why, duration,
passes, WebGL2 tier, one line per MO-C-01..14 rule, rounds, frames viewed from `look.json`), then one line each for
MO-C-25/26/27/29 and MO-D-02/03/04, then every other enforced rule. Quote its verdict line and any
FAIL lines to the user; do not paraphrase a FAIL into a pass.

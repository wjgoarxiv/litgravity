# Type-path craft loop and QA gate

A type-path film is finished in rounds. Each round looks before it encodes, so the expensive full render
runs on a brief whose frames have already been seen. The round counter (1 to 3, `MAX_ROUNDS`) is the same
one the look rounds in `references/look.md` use.

## One round (MO-C-15)

1. **Stills.** `node "$SKILL_ROOT/scripts/motion.mjs" make <dir>/brief.json --out <dir> --round N --stills-only`
   checks the treatment, runs the pre-flight (fonts present and hash-verified, every glyph covered, the
   timeline valid) and writes the beat stills, one transition strip per cut and a contact sheet into
   `<dir>/stills/`. Nothing is encoded in this step.
2. **Look.** Open every file listed in `<dir>/stills/index.json` with `read_file`. Answer the look
   questions: no type clipped at the frame edge, no empty frame at a cut, every line legible at its size,
   only the preset's palette, the accent used at most once, no working title, file name or uninvited index
   on screen. Record the round with `motion.mjs look --out <dir> --round N --answers <file>`.
3. **Fix.** Change the brief where a still is wrong: another scene, another preset, tighter copy. When the
   brief changed, run step 1 again.
4. **Full render.** `motion.mjs make <dir>/brief.json --out <dir> --round N` renders the master with its
   sound bed, the preview, the poster, the reduced-motion still, a determinism re-render in a second
   process, a perf run of at least 120 frames, and the full gate into `gate-report.txt`.
5. **Read the verdict.** Exit 13 means a rule failed. Read `gate-report.txt`, fix the named rule, and
   start the next round at step 1. `motion.mjs gate <dir>` reruns the gate alone on an existing render.

## When to stop (MO-C-16)

- **Done:** a valid treatment, the line `QA gate: PASS`, and at least two recorded look rounds, the first
  a stills round that names its change and the last stamped with the stills of the final full render. The
  LitGravity Stop hook checks this through `engine/node/done.mjs` and the `read_file` calls it saw.
- **Round 3 still failing:** stop. Report the failing rules and what each round changed. The film and
  its exports stay under their names for the user to judge, with one exception below.
- **Flash audit failed (MO-C-03), in any round:** the master, preview, poster and reduced-motion still
  move into `<dir>/withheld/`. They are diagnostics, and nobody receives them, even as a draft. The
  reply says the render is withheld until the flashes are fixed.
- **Blocked environment** (exit 10, 11, 12, 14 or 15): stop at once and name the fix. More rounds cannot
  supply a missing browser, encoder or runtime.
- **Perf alone (MO-D-02):** a frame-time failure by itself still delivers the film, with the report.
- **Never** answer a failure by shortening the film, dropping a shot or switching the sound off.

## The flash audit (MO-C-03)

The audit follows the WCAG 2.3.1 excursion method (`engine/core/flash.mjs`) and runs on the exact bytes
handed to the encoder. Each frame is averaged onto a 320x180 grid of 6x6 px cells (transposed for a
portrait frame). A cell registers a transition when its luminance moves at least 0.1 away from the
extreme it reached since its last transition while the darker side is below 0.8. A frame-level
transition exists when the cells that moved one way within the last three frames cover more than 25 % of
some 640x360 window, the ten-degree field. Saturated red runs the same method on (R − G − B) × 320 with a
step of 20. A flash is a pair of opposite transitions inside one second, and the limit is three general
and three red flashes in every one-second window. The master is audited as a film that ends, the preview
as a loop that wraps. Separately, MO-SH-04a fails any single frame where 25 % of the cells jump by 0.1 or
more at once.

## Contrast (MO-C-06)

Contrast is measured on rendered pixels (`engine/core/contrast.mjs`). The foreground is the median
linear luminance under the glyph mask eroded by one pixel (the 5th and 95th percentiles for a gradient
fill). The background is sampled between the 5th and 95th percentiles inside the text box grown by a
quarter of the cap height and outside the mask dilated by two pixels. The worst pairing counts. In
terminalcore the boxes are first carried through the crt curvature, so a curved window edge is not mistaken
for a label's background.

## Gate table

Rules marked provisional use the motion spec's proposed defaults, implemented exactly as written while
they wait for sign-off; the report labels them. Never tune a number in `engine/core/constants.mjs` to make
a render pass.

| Rule | Threshold | Usual fix |
| --- | --- | --- |
| MO-C-01 look coverage | every frame inside a pass range whose pass issued a draw | keep the preset's passes |
| MO-C-02 WebGL2 | renderer recorded; a software renderer labelled and announced | environment only |
| MO-C-03 flash | ≤ 3 general and ≤ 3 red flashes per second, master and preview | fewer, slower large changes; no full-frame flips |
| MO-C-04 title-safe | every glyph box inside x 96–1824, y 54–1026 | shorter line or smaller size |
| MO-C-05 action-safe (provisional) | every non-glyph mark inside x 48–1872, y 27–1053 | move the mark |
| MO-C-06 contrast (provisional) | 4.5:1, or 3:1 at ≥ 32 px (≥ 25 px at 700) | small text in the type colour |
| MO-C-07/08 reading time (provisional) | the floor in `references/type-craft.md` | fewer words per shot, or a longer `hold` |
| MO-A-13 eojeol | every reveal step a whole eojeol or item | keep units whole |
| MO-A-15 / MO-A-16 beats | cuts within one frame of a beat; every shot at least two beats | engine-made; check custom holds |
| MO-C-09 / MO-A-25 determinism | identical `rgbaSha256` in a second process; seeked frames equal sequential ones | a scene read a clock or unseeded random |
| MO-C-10/11/12 format | ≥ 1920x1080, ≥ 30 fps, ≥ 3 s; yuv420p, bt709, tv range; warns past 90 s | engine-set |
| MO-C-13 sizes (provisional) | preview ≤ 3 MB, poster ≤ 1 MB; MP4 warns past 100 MB per 10 s | the preview ladder steps down by itself |
| MO-C-14 reduced-motion still (provisional) | present, with ink ≥ 0.9 × the last text frame | end on a settled end card |
| MO-C-25 tracking (provisional) | display ≥ −0.04 em; machine voice never negative | |
| MO-FT-04 Hangul | no tracking or width motion on a Hangul run | |
| MO-C-26 line height | ≥ 1.5 Latin, ≥ 1.6 CJK for two lines or more | |
| MO-C-27 measure | Latin paragraph cards 60–75 characters; Korean 30–45 advisory | |
| MO-C-29 colour (provisional) | at most two saturated clusters (signal and accent); the accent in one timeline entry and ≤ 10 % of frames | drop the extra colour |
| MO-D-02 perf (provisional) | p95 frame time ≤ 40 ms on hardware, ≤ 250 ms on software GL, over ≥ 120 frames | lower samples or tidal octaves; never withholds |
| MO-D-03 empty frames (provisional) | no near-black run longer than twice the minimum hold (plus 1 s at either end) | a scene that failed to paint |
| MO-D-04 glyphs (provisional) | every codepoint in its run's font | change text or preset |
| MO-SH-01..11 | pass seeds, the two-events-per-second budget, glitch, surge and flicker caps, dither seed per shot, guides off, ≤ 2 terminal layers, the software downgrade | engine-enforced; a FAIL is an engine defect to report |
| MO-A-33, MO-A-58, MO-A-37..41 | Hangul only in the Pretendard pair or Galmuri; post overrides in range, invert only on cuts and held two beats; every export and a canonical timeline present | |

## The report (MO-C-17)

`gate-report.txt` opens with a fixed block: the outputs, the preset and why, the duration, the passes, the
WebGL2 tier, one line per rule MO-C-01 to MO-C-14, the rounds, and the frames viewed according to
`look.json`. Then come MO-C-25, 26, 27 and 29, MO-D-02, 03 and 04, and every other enforced rule. Its
verdict line is `QA gate: PASS` or a failure line. Quote the verdict and every FAIL line when the user
asks for detail, and never soften a FAIL into a pass.

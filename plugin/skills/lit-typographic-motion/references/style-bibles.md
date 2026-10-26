# Style bibles

A style bible is the one page that decides how a film looks before any scene is written: the
palette, the three type voices, the motion vocabulary, the shader passes and their order, the
layout grid, what to avoid, and what makes this film its own. The type engine carries each preset as
data (`engine/core/presets.mjs`), and the house styles carry the same palettes for the stage path
(`styles/<id>.json`, `studio.md`); this page is the reasoning behind that data. The treatment's
`style` decides the preset on the type path, so the brief leaves `style` out; under a bare `lit`, state
the style and the rule that chose it in one sentence.

## Template

| Part | Decide |
| --- | --- |
| Idea | One sentence: what the film says and the single image it leaves. |
| Palette | A ground, one type colour, one signal hue; a rich film (the default) adds the style's accents, each for one role, and a minimal one at most one rare accent. Name every colour by role. |
| Three voices | Display (titles, hooks), body (running text; Hangul body for Korean), machine (data, credits, counters). |
| Motion tone | Named tokens only: how type lands, how long it holds, how a shot ends. No per-shot curves. |
| Passes | Which look-library passes run, in which order, and how strongly. |
| Grid | Columns, gutter, margin, baseline; where the eye enters each shot. |
| Anti-slop | Three to five things this film must not do. |
| Originality | What is this brief's own: its metaphor, its rhythm, its one accent moment. |

## Auto-pick (MO-B-00)

Checked in order, first match wins, whole words only (a Korean keyword must start a token, so it
never matches the tail of a longer word). A style the request names always wins, then the project's
house style. The treatment validator applies the same table to the request and the copy, plus the
`paper` row on the stage path (`studio.md`).

| The brief mentions | Preset |
| --- | --- |
| 터미널, CRT, 해커 / terminal, hacker | terminalcore |
| 물결, 파도, 잔잔한, 흐름 / gradient, wave, tide, calm | tidal |
| anything else | swiss-signal |

System, status and flow are deliberately not keywords: they appear in payment systems, design
systems and workflows that have nothing to do with a terminal or a tide.

## swiss-signal (default)

**Palette.** Ink ground `#0C0E13`; bone type `#E9EBE4`; one teal signal `#0F7A82`; one amber
accent `#D9A441` for a single moment; graphite `#4B5058` for hairlines only. Bone on ink is 16:1.
Teal on ink is 3.8:1, which clears the 3:1 large-type floor but not 4.5:1, so teal type must be at
least 32 px (25 px at 700 weight) or a mark, never small text.

**Voices.** Display: Archivo in static width steps (75, 100, 125) at 900, stepping width, never
interpolating; Hangul display in the Pretendard Bold file. Body: Archivo 400 / Pretendard Regular.
Machine: MesloLGS NF for annotations, credits and figures.

**Motion.** `slam`: 180 ms on the deceleration curve cubic-bezier(0.16, 1, 0.3, 1), landing on the
downbeat, entrance scale never below 0.95. `hold`: 0.6–0.9 s of stillness after a slam. `cut`: a
hard cut with no easing between shots. No spring, no bounce: print is precise, not playful.

**Passes.** swiss-grid (hairline rules that make the grid visible) then dither (Bayer 4x4 at about
0.3 strength, an engraved-print texture). Grain, vignette and a little chromatic aberration come
from the post chain. No bloom: glow on bone type reads as cheap.

**Grid.** 12 columns, 24 px gutter, 96 px margin, 8 px baseline. Asymmetric: type sits on the left
column edge, annotations beside the headline rather than stacked under it, generous empty space.

**Anti-slop.** Centered fade-ins as the only move; one ease for everything; glitch without a beat
reason; any second hue; bloom; a hold so long it reads as a stall.

**Originality.** Borrow the pattern (one ground, one signal, one rare accent), never a known
film's colours. Each shot gets this brief's own metaphor.

## terminalcore

**Palette.** Navy ground `#05070A`; panel `#0C1116` for window chrome; one signal hue per film,
phosphor green `#39FF6A` (default) or electric blue `#2FB6FF`, never both; status grey `#7C8B93`.
Green on navy is 15:1 and grey on navy 5.7:1 on a flat ground. The crt vignette and scanlines
darken the window corners below 4.5:1 for grey, so the chrome label and the readout there are set in
the signal hue; grey stays on strokes and on text nearer the centre.

**Voices.** Display: Galmuri9 for Hangul (pixel type at whole multiples of its 9 px grid, at least
36 px) with VT323 for Latin. Machine: MesloLGS NF for readouts. Chrome labels: Silkscreen. Galmuri
and VT323 never share a status line cell for cell.

**Motion.** `type-in`: characters appear at the terminal's rate (22 per second), linear, with no
easing, because a terminal does not ease. `boot-flicker`: the first 250 ms of a shot flicker at the
capped CRT amplitude, counted as one event. Hard cuts on downbeats. Nothing overshoots.

**Passes.** terminal-ui (window chrome, meters, readout) then crt (scanlines, curvature, capped
flicker) then dither (Bayer 4x4, 2 px cells) then glitch (rare, at most 0.5 hits per second, each hit
one band for two frames). This is the only preset with four passes, so the per-shot event budget
(two events in any second) is the real limit.

**Grid.** One thin-bordered window on a flat field, no depth or shadow; text aligned to the
character grid so it never drifts against the chrome.

**Anti-slop.** Falling code rain; purple-cyan neon haze; glitch running continuously; two signal
hues; pixel type too small to read.

**Originality.** The window, meters and readout are this engine's own drawings, not a copy of a
real operating system or terminal app.

## tidal

**Palette.** Indigo ground `#0E1420`; off-white type `#E8ECEF`; gradient stops deep teal `#124559`
and violet `#4C3B6E`; coral `#E07856` as punctuation in one moment only. Off-white clears 8:1 on
every stop, so type can sit anywhere on the flow without a scrim.

**Voices.** Display: Archivo 700 at normal width, calm and mostly still; Hangul in the Pretendard
Bold file. Body: Pretendard Regular. Machine: MesloLGS NF for small credits only.

**Motion.** `drift`: position and opacity on cubic-bezier(0.37, 0, 0.63, 1) over 2–4 s, matching the
gradient's slow flow so type and background move as one system. `surge-punch`: 300 ms on the slam
curve, timed to a tidal surge. Continuous flow, not hold-and-snap.

**Passes.** tidal-gradient (a domain-warped flow mixing the stops, one or two soft surges per shot)
then swiss-grid (rules only, guides off) then glitch at 0.5 hits per second or less, as punctuation.

**Grid.** The swiss-signal grid; centred compositions are allowed here because the ground moves.

**Anti-slop.** A rainbow or hue-cycling ramp; bloom on the gradient; glitch as texture; flow so
fast that held type smears.

**Originality.** The flow field is seeded per shot, so no two films share one; stops are chosen for
the brief within two or three restrained colours.

## paper (stage path only)

**Palette.** Warm paper ground `#F3EEE5`; near-black ink `#1D1B18`; muted `#5B564E` for second lines;
one terracotta signal `#B0452A`; one blue accent `#2B5D8E` for a single moment; line `#C9BFAE` for
drawn strokes. Ink on paper is 14.9:1, muted 6.3:1, signal 4.9:1.

**Voices.** Pretendard throughout (700 for display and headline, 400 for body), MesloLGS NF for small
labels. Hangul and Latin share one face, so mixed lines keep one colour of type.

**Motion.** Soft springs: panels settle at damping 0.8, the subject may bounce at 0.6, type never
overshoots. Entrances on a quint-like ease-out, exits shorter and on an ease-in.

**Grid.** The shared layout zones (`studio.md`), generous margins, drawings in line weight rather than
fills.

**Anti-slop.** Drop shadows that float type; neon or glow; gradients on type; more than two saturated
colours on screen; bouncy type.

**Originality.** The drawing carries the film: hand-drawn lines, paper cut-outs, small diagrams. The
ground stays plain so the drawing reads.

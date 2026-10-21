# Style bibles for the type path

Before any scene is chosen, a type-path film commits to one look: a ground, a type colour, one signal,
three type voices, how type moves, which shader passes run and in what order, the grid it sits on, and a
short list of things it must never do. The engine keeps each preset as data in `engine/core/presets.mjs`
(palette hexes, voices, motion tokens, pass order and pass parameters), and the gate reads the same object.
This page explains why each preset looks the way it does, so a choice between them can be argued.

When the user asked for a direction, write the film's own short bible in the reply using the template
below. Under a bare `lit` route, one sentence naming the preset and the reason is enough.

## Template for a film's own bible

| Part | What to decide |
| --- | --- |
| Idea | One sentence: what the film says and the one image it leaves behind |
| Palette | Ground, type colour, one signal hue, at most one rare accent, each named by its role |
| Voices | Display for titles and hooks, body for running text (with its Hangul face), machine for figures, data and credits |
| Motion tone | Named tokens for how type lands, how long it holds and how a shot ends; no per-shot curve invention |
| Passes | Which look passes run, their order and strength |
| Grid | Columns, gutter, margin, baseline, and where the eye enters each shot |
| Anti-slop | Three to five moves this film refuses |
| Originality | The metaphor, rhythm or single accent moment that belongs to this brief alone |

## How a preset is picked (MO-B-00)

An explicit `style` in the brief always wins. Without one, `pickPreset` scans the brief's text (its shots,
title and request) against a short keyword table, top row first, and takes the first whole-word hit.
Latin keywords need word boundaries on both sides and ignore case; a Korean keyword only has to start a
token, so it can carry a particle but can never match the tail of a longer word.

| Keywords in the brief | Preset |
| --- | --- |
| 터미널, CRT, 해커, terminal, hacker, crt | terminalcore |
| 물결, 파도, 잔잔한, 흐름, gradient, wave, tide, calm | tidal |
| no hit | swiss-signal |

Words such as system, status or flow were left out on purpose: they turn up in billing systems, design
systems and workflows that have nothing to do with a terminal or the sea. The report prints the reason,
for example `agent default (brief mentions "파도")`, and calls the style user-specified only when the
user's request names the preset.

## swiss-signal, the default

**Palette.** Ink ground `#0C0E13`, bone type `#E9EBE4`, a single teal signal `#0F7A82`, an amber accent
`#D9A441` saved for one moment, and graphite `#4B5058` for hairlines only. Bone on ink measures about 16:1.
Teal on ink is roughly 3.8:1: enough for large type (32 px, or 25 px at weight 700) and for marks, too
little for small text, which therefore stays bone.

**Voices.** Display is Archivo 900 in three static width instances (75, 100, 125); width changes step
between instances and never interpolate. Hangul display uses Pretendard Bold, with Pretendard Regular as
the lighter weight step. Body is Archivo 400 with Pretendard Regular. The machine voice is MesloLGS NF
(Hangul falls back to Pretendard Regular).

**Motion.** A slam takes 0.18 s on a hard deceleration and lands on the downbeat; the entrance never
scales below 0.95. After a slam the type holds still for 0.6 to 0.9 s. Shots change on hard cuts with no
easing. There is no spring and no bounce: the reference is printed matter.

**Passes.** `swiss-grid` draws the hairline rules of a 12-column grid (guides stay off in every export),
then `dither` lays a Bayer 4x4 pattern at strength 0.3 for an engraved texture. The post chain adds light
grain, a soft vignette and a hint of chromatic aberration. Bloom and halation are zero: glow on bone type
reads as cheap, and the teal is too dark to bloom anyway.

**Grid.** 12 columns, 24 px gutter, 96 px margin, 8 px baseline. Compositions are asymmetric: type hangs
from a column edge, annotations sit beside the headline, and large areas stay empty.

**Refuses.** Centred fade-ins as the only move, one easing curve for everything, glitch without a reason
on the beat, a second hue, bloom, and holds so long that the film seems to stall.

**Originality.** Borrow the structure (one ground, one signal, one rare accent) and never the colours of a
known title sequence. The metaphor of each shot comes from this brief.

## terminalcore

**Palette.** Navy ground `#05070A`, panel `#0C1116` for the window chrome, one signal hue per film
(phosphor green `#39FF6A` by default, electric blue `#2FB6FF` with `signalHue: "blue"`) that also becomes
the type colour, and status grey `#7C8B93`. On a flat ground green reaches about 15:1 and grey about 5.7:1.
The crt vignette and scanlines darken the window corners enough to pull grey under 4.5:1, so labels and
readouts near the corners use the signal hue and grey stays on strokes and central text.

**Voices.** Display is VT323 for Latin with Galmuri9 for Hangul, a pixel face that is only drawn at whole
multiples of its 9 px grid and never below 36 px. The body uses VT323 with Pretendard Regular for Hangul.
Machine readouts use MesloLGS NF, and the window chrome is labelled in Silkscreen. VT323 and Galmuri never
share one status line cell for cell.

**Motion.** Characters type in at 22 per second, linearly, because a terminal has no easing. The first
0.25 s of a shot may boot-flicker at the capped crt amplitude, which counts as one event. Cuts land on
downbeats and nothing overshoots.

**Passes.** Four, in this order: `terminal-ui` (window chrome, two meters, a log readout and a caret
blinking at 1.2 Hz), `crt` (scanlines, curvature 0.06, triad mask, flicker amplitude 0.03), `dither`
(2 px cells) and `glitch` (at most 0.5 hits per second, each hit held two frames over at most 12 % of the
frame). With four passes the shared event budget, two events in any second of a shot, is the limit that
actually bites.

**Grid.** One thin-bordered window on a flat field, no drop shadow, with text snapped to a 14x24 px
character grid so it never drifts against the chrome.

**Refuses.** Falling code rain, purple and cyan neon haze, continuous glitching, two signal hues, and
pixel type too small to read.

**Originality.** The window, meters and readout are drawn by the engine itself and imitate no real
operating system or terminal application.

## tidal

**Palette.** Indigo ground `#0E1420`, off-white type `#E8ECEF`, gradient stops deep teal `#124559` and
violet `#4C3B6E`, and coral `#E07856` as punctuation for a single moment. Off-white stays above 8:1 on every
stop, so type may sit anywhere on the flow without a scrim. Tidal has no signal hue of its own: the teal
stop is its saturated cluster for the accent check, and marks such as bars and the pen head use the type
colour.

**Voices.** Display is Archivo 700 at normal width only, calm and mostly still, with Pretendard Bold for
Hangul. Body is Archivo 400 with Pretendard Regular. MesloLGS NF appears only for small credits.

**Motion.** Type drifts in position and opacity over two to four seconds on a symmetric ease, in step with
the background's slow flow, so type and ground read as one system. A surge punch of 0.3 s marks a tidal
surge. The film flows continuously instead of holding and snapping.

**Passes.** `tidal-gradient` (a domain-warped flow mixing the stops, four octaves, at most two surges per
second with attack and decay of at least 0.1 s), then `swiss-grid` with its guides off, then `glitch` at
0.5 hits per second or less, used as punctuation.

**Grid.** The swiss-signal grid. Centred compositions are fine here, because the ground itself moves.

**Refuses.** Rainbow or hue-cycling ramps, bloom on the gradient, glitch as a texture, and a flow so fast
that held type smears.

**Originality.** The flow field is seeded per shot from the run seed, so two films never share one, and
the stops stay within two or three restrained colours chosen for the brief.

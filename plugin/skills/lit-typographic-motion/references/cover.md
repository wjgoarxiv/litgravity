# Cover mode: the seamless README loop

Open this file when the request asks for a README cover, a hero or banner loop, an animated project
header, or anything else that plays forever at the top of a page with no one pressing play. Such a
loop is a different object from a film. A film is read once, from a first frame to a last one; a
cover is glanced at, scrolled past and seen again, so it has to look finished in any frame, keep
moving in every half second and never show the point where it starts over. Everything else in this
skill (the stage path, the type path, sound, beats) stays as it is for films. Cover mode only takes
over when `treatment.json` says `"mode": "cover"`.

The reason for a separate mode is practical. The film pipeline rewards things that make a cover
worse: beats of at least 1.2 s that each show something new, stills taken at beat midpoints, a
settled end card, reading floors for copy. Followed faithfully, they produce a slide deck that
happens to loop. Cover mode swaps them for a loop contract on the page, a review of motion on a
contact sheet, and a gate that measures the encoded file the reader's browser will decode.

## Which film rules relax, and what replaces them

| In a film | In a cover |
| --- | --- |
| Beats of 1.2 s or more, each with new content | No beats. One system and three speed layers, each running for the whole loop |
| An end card that settles; holds count as rhythm | No ending at all. A hold longer than 0.5 s fails the TARGET of G3 |
| At least 10 s, and shortening is a recorded downgrade | 6 to 12 s; every shipped recipe uses 8 s |
| 16:9 or 9:16 | 2:1 (page 1200x600 CSS px, cover 1000x500) or 3:2 (page 1200x800, cover 960x640) |
| A generated sound bed and its gates | Silent. `sound` is absent or `"none"` |
| An invented subject and copy lines | The brand word, plus at most one motto that the user wrote or the project already prints |
| Titles fading in, a stage skeleton rising from black | Frame 0 is the poster and already the whole picture |
| Nine look questions about purpose and beats | Eight questions about motion, the seam and visible damage (below) |

The film's flash audit, its no-network rule, its raster limits and its determinism rule all stay.

## The cover page

Write the page as `cover/index.html` inside the output folder (`motion-<slug>/cover/index.html`),
with its rasters in `cover/assets/`. The renderer serves that folder and three things of its own: the
loop kit at `/lit/loop-kit.js`, the bundled faces at `/lit/fonts.css`, and the init script that runs
before any of your code. The stage path's static scan runs on the folder first, so the same limits
hold: nothing fetched from the network, no `<video>`, `<audio>`, `<iframe>` or workers, at most 24
rasters and 8 MB of them, no animated raster and no flipbook of numbered frames. A script that looks
like a third-party library gets a warning; the page is your own code plus the kit.

The page contract has four parts.

1. **Layout size.** Lay everything out at the aspect's page size in CSS pixels. Capture runs at
   device scale 2 and the frames are downsampled with Lanczos to the cover size, so hairlines and
   small type are drawn at twice the density at which they are shown.
2. **`window.renderFrame(t, { mask })`.** `t` is loop time in [0, 1). The renderer draws frame `i`
   of `N` at `t = i / N` (with `N = round(loopSec * fps)`), so `t = 1` never reaches the page; drawing
   it would duplicate frame 0 and stutter at the seam. The call may return a promise; capture waits
   for it and for `document.fonts.ready`.
3. **`window.ready = true`.** Set it only after fonts and images are decoded. A page that is not
   ready within 60 s, or that sets `ready` with no `renderFrame`, stops with exit 17.
4. **The mask variant.** `renderFrame(t, { mask: true })` paints the brand word white and everything
   else black, in exactly the place the normal frame puts it. A mask capture of every frame feeds the
   title gates G5 and G6.

Everything visible is a function of `t` alone. The renderer seeks frames in sequence, repeats all of
them in a fresh browser, and then seeks sixteen of them in a shuffled order in a third browser. A
frame that depends on the one drawn before it (a trail made by never clearing a canvas, a counter,
an accumulated buffer) agrees with itself in sequence and disagrees when sought out of order. Clear
every canvas you draw into and compute each frame from `t`.

### What throws during capture

The init script replaces every clock and every unseeded entropy source with a function that throws
and records its own name: `Math.random`, `Date()` and `new Date()` without arguments, `Date.now`,
`performance.now`, `requestAnimationFrame`, `setInterval` and `crypto.getRandomValues`. CSS
animations and transitions are switched off. The renderer reads the recorded names after loading and
after each frame, so even a page that catches the error stops with exit 18 naming the call. Use
`LitLoop.rng(seed)` for layout choices and `t` for anything that changes. A `new Date(2026, 0, 1)`
with explicit arguments is allowed because it reads no clock.

### Faces

The page may use the stage faces plus `"JetBrains Mono"`, a variable face with a real `wght` axis
from 100 to 800 and a fixed advance, which lets the weight move without reflowing a line. Load every
weight you use with `document.fonts.load` before setting `ready`.

## The loop kit

`/lit/loop-kit.js` (source: engine/stage/loop-kit.js) is a classic script that defines a frozen
`window.LitLoop`. Every helper in it is either pure or periodic in `t`, which is what keeps the seam
invisible.

| Helper | What it gives you |
| --- | --- |
| `rng(seed)` | mulberry32; a function returning [0, 1). Use it for layout only: positions, sizes, which copy carries the accent |
| `makeNoise(seed)`, `loopNoise(noise, t, offset, radius)` | 3D value noise walked on a circle, so the value at `t = 1` equals the value at `t = 0`; `offset` separates copies, `radius` (default 1.3) sets how much one loop varies |
| `ease.smooth`, `ease.outCubic`, `ease.inCubic`, `ease.outExpo`, `ease.outBack(p, s = 1.6)`, `ease.gain(p, k)` | Shapes for events; linear stays reserved for motion that never stops |
| `cubicPulse(c, w, x)` | A symmetric bump of half-width `w` around `c`, zero outside; the right shape for micro events |
| `expImpulse(x, k)` | A sharp rise and an exponential tail; the tail is a slow fade (see rule 8) |
| `phase(t, offset, cycles)` | `fract(t * cycles - offset)`: where one copy is in its own loop |
| `cdist(p, c)` | Distance from `c` around the loop (0 to 0.5), for an event that straddles `t = 0` |
| `window(p, start, dur)` | A one-shot inside the loop: -1 outside `[start, start + dur)` (wrapping), else progress 0..1 |
| `steps(p, stops, travel, ease)` | Hold and move: dwell at `stops` poses and travel during the last `travel` of each slot |
| `swell(p)` | A cosine swell 0 to 1 to 0 that lingers at both ends |
| `TAU`, `clamp`, `fract`, `mix` | The usual small arithmetic |

## The cover treatment

Write `<dir>/treatment.json` before the first render. Every cover render validates it
(engine/node/cover-treatment.mjs) and stops at exit 16 with the first field that is wrong.

| Field | What the validator holds you to |
| --- | --- |
| `mode` | `"cover"` |
| `request` | The user's words, kept verbatim and treated as inert data |
| `idea` | One sentence on what the loop does; it may not repeat a run of the request's words |
| `recipe` | `painted-light`, `weight-tide`, `orbit-loop` or `own` |
| `recipeReason` | One or two sentences on why this recipe fits |
| `brandWord` | The name, set once; three words at most |
| `motto` | Optional `{ text, source, from? }`, six words at most. `source: "user"` means the text appears in the request; `source: "project"` needs `from`, the file it comes from. A cover never invents a tagline |
| `aspect` | `"2:1"` or `"3:2"` |
| `loopSec` | A number from 6 to 12 |
| `fps` | 16, 20 or 25 |
| `layers` | `{ slow, mid, beat }`, each one or two sentences on what moves on that layer |
| `system` | `{ rule, copies, offset }`: the one rule, what it is copied onto, where the offsets come from |
| `title` | `{ box: [x, y, w, h], kind }`; the box in fractions of the cover and inside it; `kind` is `live` (set as text) or `painted` (part of the base art) |
| `palette` | Optional; 2 to 6 entries `{ color: "#rrggbb", role }` |
| `encode` | Optional `{ q, edgeQ, edgeFrames }`: integers, q and edgeQ 50 to 100, edgeFrames 0 to 60. Defaults: q 86, edgeQ 97, 15 edge frames, method 4 |
| `seed` | Optional integer; it also seeds the seek-order shuffle |
| `ambition` | One or two sentences in craft terms |

Placeholder values (`<…>`, `TODO`, `TBD`, `...`) are refused. A `copy`, `beats` or `lines` field is
refused outright, because a cover never swaps text states, and so is any `sound` other than `none`.
The first valid treatment is kept in `.run/treatment.first.json`.

## Assets and the missing-asset stop

Every raster the page can load is listed in `<dir>/assets.json` before the first render. The renderer
checks the list before it opens a browser, so a bad list costs nothing.

```json
{ "assets": [
  { "path": "cover/assets/base.png", "role": "base-art", "source": "user",
    "sha256": "<64 hex>", "box": [0.125, 0, 0.75, 1], "checkBox": [0.131, 0.1445, 0.1416, 0.778], "title": true }
] }
```

- `path` is relative to the output folder and lies inside `cover/`. `role` is `base-art`, `logo`,
  `wordmark` or `texture`. `source` is `user` for supplied art or `generated` for art made for this
  cover (for example with the host's `generate_image` tool, where the build offers it). `sha256` is the file's own hash.
- A listed file that is absent stops the run at exit 22 `BLOCKED_ASSET_MISSING` before any
  frame is written. Ask the user for the art or generate it and list it as generated, so that the real
  art always takes the place of a stand-in. The `painted-light` recipe without a `base-art` entry is the same exit 22.
- A raster in `cover/` that the list leaves out, or a listed file whose hash has changed, is exit 17.
  After you edit an asset, list it again with its new hash. A malformed entry is exit 16.
- Base art needs `box`, where it sits on the cover. `checkBox` (inside `box`, at least 10 % of its
  area) is the region the ART check compares; without it the whole box is compared.
- `title: true` on the base art declares that the brand word is painted into it. Only then is the
  title exempt from the G6 size floor, and it is still measured and printed as INFO.
- Art is scaled whole into its box, and the stage raster limits still apply.

When the cover is done, every `generated` entry becomes a line the reply has to carry: the Stop hook
holds the finished turn once so that the reply says which asset was generated.

## Craft rules, most important first

These come from rendering and measuring real covers, including several that looked fine as PNG
frames and fell apart once encoded.

1. **Design for the encoder.** Lossy animated WebP leaves a pixel alone when it changes by less than
   roughly `31(1 - sqrt(q/100)) + sqrt(q/100)` levels from the previous frame: about 6 levels at q72,
   about 3 at q90. A slow fade or a gentle breathing glow under that step is simply not sent; the
   region goes stale and jumps back at the next keyframe, which by default is the loop point. None of
   this shows in the frames you captured. It only shows in the decoded file, which is why the gate
   decodes.
2. **Light travels as an edge.** A lit window that moves across the picture with a 24 to 40 px edge
   survives encoding. The same window with a 150 px soft edge did not at q72 with default keyframes: on
   one painted cover the moving share fell from 0.92 to 0.83 and the seam jumped to 24 times its
   neighbouring steps. At a high edge quality the soft edge survives and reads as a wash in place of a
   travelling edge, which no motion gate sees; only look review does.
3. **Something must translate.** A weight wave with nothing else moving lost most of its motion in
   the encoder (median step 0.0007, seam 14 times its neighbours). Letting the background rows drift
   one word length per loop kept all of it (median 0.0098, seam 1.1).
4. **One rule, copied, offset by position.** One swell over hundreds of letters, one orbit rule on
   three rings, one light window over seven bays. The offset of each copy comes from x, y, its angle
   or a loop-noise field, and the wave appears by itself. There is no timeline and there are no scenes.
5. **Three speed layers.** A slow layer that never stops and moves linearly (drift, laps, rising
   motes); a mid layer that swells (the tide, the light window); and short events on a beat (a cursor
   step with `outBack`, a gate flash, a blink, a flare). Every cover that reached TARGET had all three.
6. **The brand word stays where it is.** It can be the material (its weight changes and its position
   does not), it can stand still beside the system, or it can be painted into the art and lifted.
   Motion happens inside it, around it or behind it.
7. **Frame 0 is the poster.** Thumbnails, reduced-motion readers and slow connections show frame 0
   alone, so it must be the complete picture: no black opening, no fade in.
8. **Exponential tails are slow fades.** `expImpulse` spends half the loop decaying below the encoder
   step. Use `cubicPulse` for micro events, and place one across `t = 0` so whatever the keyframe
   resets lands under motion.
9. **Bands are flat steps, and every step clears the encoder.** A 3 px leading line followed by a
   two-step afterglow (0.10, then 0.05) encoded cleanly; adding a third step of 0.03 drifted and
   pushed the seam from 1.71 to 2.48. One flat slab encodes well but reads as a box on the sheet.
10. **Few small movers over texture.** Each mote over a painting makes the encoder resend the
    textured blocks around it; halving the motes on one cover saved about 0.2 MB. Keep them few, and
    mostly on the plain wings.
11. **Lift a painted title instead of overlaying live text.** Raise only the pixels brighter than the
    plate behind the letters (a luminance-keyed gain): the letters reach 4.5:1 or more, the plate
    stays dark, and thresholding the same letters gives the mask. Live text set at the painting's
    scale ended up about 11 px tall at README width.
12. **Spend quality at the seam.** Once every edge is sharp, what remains at the loop point is
    requantisation: frame 0 is a keyframe and the frames before it carry different error. Raise the
    quality of frame 0 and the last stretch (`encode.edgeQ` over `encode.edgeFrames`) and keep the
    default keyframes. Periodic keyframes spread the snap into visible pops, and a very short keyframe
    interval made a 2.5 to 5 Hz shimmer.
13. **Size and frame rate.** Encode at 1000x500 for a README: the column is about 830 to 900 px
    wide, and the title still has room. Use 16 fps for slow painted covers (20 fps cost about 18 %
    more and thinned each step) and 25 fps for a system with fast dots. At 16 fps img2webp writes
    63 ms frames, so an 8 s loop lasts 8.064 s; that is fine.

## Recipes

Each recipe is a worked page in `recipes/<name>/index.html` with the treatment, settings and gate row
it shipped with in `recipes/<name>/expected.json`. Start a cover by copying the page into `cover/`,
then change the brand word, the motto, and for the painted recipe its `ART` block. Treat the pages as
examples; the rules above are what carries over to an `own` recipe.

### Painted base + travelling light (`painted-light`, the default)

A finished painting is the whole picture, and the page relights it. The painting is supplied by the
user, or generated and labelled as generated, and listed as `base-art`. It keeps its own coordinates
and is scaled into its box; at 2:1 a 3:2 painting is pillarboxed and the side wings stay quiet (a
static spill and a few motes; nothing glows outside the frame). Macro layer: the dim bays sit in a
dimmed pool, and a lit window with a 24 px feather walks across them once per loop. Mid layer: a scan
band per bay at two passes per loop, offset by the bay's position; a comet lapping the hero's frame;
one fast skewed glint across the title in **overlay** blend, which keeps the plate dark and
brightens only the letters (screen brightens a visible box, and colour-dodge saturated a coloured
letter into a red block). Beat layer: the eyes breathe twice with a phase offset, the core breathes
once, one blink, and the accent word flares at `t = 0` and `t = 0.5`. A denser or brighter painting
needs a deeper dim pool and a lower `q`; the settings that reached TARGET are in the recipe's row.

**Choosing the hero.** Any bay can be the hero, so a cover can feature one machine on a shared
line-up. Three things move together:
1. `ART.hero` is the bay index (0 is the leftmost bay). The dim pool is clipped around that bay, so a
   hero in the middle stays at source brightness while the light window still walks every other bay
   as one continuous light. The comet laps the hero's border and its scan band stays at full
   strength.
2. `ART.lights` maps a bay index to the light anchors measured on that machine
   (`{ cx, cy, rx, ry, k }` in painting pixels; `k` 0 and 1 are eyes that breathe twice and blink,
   `k` 2 is a core that breathes once). Only the hero's entry glows. A hero with no entry stops the
   page with `ART.lights has no entry for the hero bay N` (the render ends as
   `STAGE_CONTRACT_ERROR` after the 60 s ready wait), because borrowing another machine's
   coordinates draws its eyes on the wrong body. Measure the anchors, or write `[]` for that bay to
   run with no beat lights and say so in the treatment's beat layer.
3. The base art's `checkBox` in the asset list points at the hero bay. With the shipped layout
   (painting scaled by `S = 600 / 1024` and pillarboxed 150 px from the left of a 1200 x 600 page) a
   bay `[x0, x1]` with panel `top` and `bottom` is
   `[(150 + x0·S) / 1200, top·S / 600, (x1 - x0)·S / 1200, (bottom - top)·S / 600]`. A box left on
   another bay measures a dimmed bay and the ART line fails.

The accent flare and the title glint belong to the painted motto and title, not to the hero, and
stay where they are.

### Weight tide (`weight-tide`)

Rows of the brand word in JetBrains Mono at about 1.3:1 against the background drift one word length
per loop, alternate rows in opposite directions. Each letter's weight is
`gain(swell(fract(t - offset)), 2.4)` with `offset = 0.85 * x / W + 0.35 * y / H`. The hero word sits
on a knockout band and takes the same field over a narrower range (330 to 800) so it never thins. One
accent: a terminal cursor that dwells under each letter, steps to the next with `outBack`, and
returns home on the last stop.

### Orbit loop (`orbit-loop`)

Three rings carry dots that complete 3, 2 and 1 laps per loop in alternating directions, each with a
fading arc trail. A gate at twelve o'clock flashes on every crossing and pulses the dot that passes.
The crossing times are computed analytically and light the cells of a ledger under the word, which
then decay; there are as many crossings per loop as cells, so the ledger loops too. The core breathes
once per loop and rings on each of four bars. The word stays still on the left.

### Own

Any system that keeps the rules: one rule copied with positional offsets, three layers, a word that
stays put, edges instead of fades. Name it in `recipeReason`.

### Rows and negatives

Each `expected.json` keeps the decoded gate row the recipe reached (median d, moving share, longest
still, spike, seamLocal, bytes) next to its encode settings and treatment. The repository's cover
recipe QA re-renders every recipe through this renderer and fails when median d or the moving share
leaves ±15 % of its row, seamLocal leaves TARGET, or the file grows past 2 MiB.

Every negative and every regression declares the gates it must fail in `mustFail`, as `<gate>.<tier>` ids
(`G2.floor`, `G1.target`). `--negatives` renders them all. A case counts as caught only when its render
completed and gated the decoded file (exit 0 or 13, with a manifest), every declared gate failed at its
declared tier, and no FLOOR gate among G1 to G4 failed without being declared. A crash, a missing or empty
declaration, a gate that passed, or a failure on an undeclared FLOOR gate fails the QA and says which.

The painted recipe declares one regression, `feather-150` (`--feather 150` runs it alone and needs the
painting): the light edge widened from 24 to 150 px. The defect it stands for is light drawn as a soft wash
in place of a travelling edge. At this recipe's encode (q83, edge q97 for 18 frames) the encoder keeps the
soft edge, so the motion numbers stay near the recipe's own (moving 1.0, seamLocal wandering 1.91 to 2.01
around the 2.0 TARGET from run to run). What it reliably trips is the 2 MiB size TARGET (about 2.5 to
2.6 MB against 2.06 MB), so `G1.target` is the only gate it declares and G4 stays undeclared. A decoded-file
edge measure was tried and dropped: it rated a sharp-windowed cover below the soft wash, because it
measures every soft change in the frame and not the travelling edge, and any threshold would be fitted
to one painting. The wash belongs to look review (question 6 in `references/look.md`).

`recipes/negatives/` holds four slide-like pages, each declaring the FLOOR gates it must keep failing as
`mustFail` in its own `expected.json`:

| Negative | What it does | Must fail |
| --- | --- | --- |
| `title-slam` | the name slams in, lines appear one by one, an end card holds | G2 and G3 |
| `card-scenes` | cards fade in, hold, and fade out in turn | G2 |
| `still-glow` | a still picture with a faint breathing glow | G2 and G3 |
| `reset-sweep` | a progress sweep that resets at the loop point | G4 |

They are never recipes. Read them to see what cover mode exists to prevent, and never move a
threshold so that one of them passes.

## Encoding

The frames are encoded with img2webp: lossy, `-loop 0`, `-m 4`, every frame shown for
`round(1000 / fps)` ms, frame 0 and the last `edgeFrames` frames at `edgeQ`, the rest at `q`, default
keyframes. Method 6 took minutes and gained little, and `-mixed` changes nothing while every frame is
lossy. The gate decodes with dwebp, so img2webp counts only together with dwebp. When either is
missing, gifski at quality 90 writes `cover.gif` instead. With neither, the render stops before
capture at exit 21 `BLOCKED_NO_COVER_ENCODER`; tell the user to install libwebp (or gifski). A cover
is never an MP4: README renderers do not autoplay video.

## The gate: measured on the decoded file

`cover-gate` (engine/node/cover-gate.mjs) decodes the cover the way a browser composites it and turns
each frame into a luma grid about 300 px wide. It then resamples to a fixed time grid of
`max(50 ms, shortest frame)`. The grid matters: an encoder merges identical frames into one long
frame, and statistics counted per frame would make a slide film look busy. `d` is the mean absolute
luma change per grid step (0 to 1). The loop is a ring, so the step from the last sample back to the
first, the seam, counts as one more step. A step below 0.0005 is still.

| Gate | What it measures | FLOOR (fails the cover) | TARGET (`--strict`, the cover-mode goal) |
| --- | --- | --- | --- |
| G0 determinism | SHA-256 of every frame in two captures from fresh browsers | all identical | same |
| G1 budget | bytes, duration, loop count | ≤ 3 MiB, 6 to 12 s, loops forever | ≤ 2 MiB |
| G2 motion energy | median d; share of moving steps | ≥ 0.0004; ≥ 0.45 | ≥ 0.0015; ≥ 0.95 |
| G3 anti-slide | longest still run; largest step / median step | ≤ 2.0 s | ≤ 0.5 s and spike ≤ 6 |
| G4 seam | seam step / mean of the two steps on each side (`seamLocal`) | ≤ 8 | between 0.25 and 2.0 |
| G5 title contrast | per frame, the median title pixel against the 90th-percentile background in the title box, read through the mask | ≥ 4.5:1 in every frame | same |
| G6 title size | cap height of the title glyphs in the mask, scaled to an 830 px README width | ≥ 24 px | same; a declared painted title is INFO |
| SEEK | 16 frames re-rendered in a seeded shuffled order in a fresh page, against the master | identical, or within one level per channel | same |
| ART | SSIM of the base art's check box in decoded frame 0 against the source scaled into its box | ≥ 0.90 | same |
| FLASH | WCAG 2.3.1 general and red flashes, the loop treated as continuous | at most 3 per second each | same; a FAIL withholds the cover |

FLOOR was set so that eight earlier hand-made covers pass and the four negatives fail. TARGET is what
cover mode is for, and those earlier covers miss it on purpose: they held for 1.9 s and flashed at
the seam. `motion.mjs cover` exits 13 until every gate reaches TARGET; the report then reads
`COVER gate --strict: PASS+TARGET`. G2 and G3 are area-weighted, so a small comet over a still
picture counts as still at thumbnail size, which is the intent.

How the less obvious gates decide:

- **G5** builds, per frame, a title set from the mask and a background set from the box pixels at
  least 3 px away from any title pixel, then compares the median title luminance with the
  background's 90th percentile (10th for dark letters on light). Without one mask per frame it fails
  and says what is missing.
- **G6** splits the mask's white pixels in the title box into connected glyphs, drops dots and
  accents (under 1 % of the largest glyph's area or 30 % of the tallest's height), takes the median
  height of the rest on twelve sampled frames, keeps the smallest, and scales it from the cover width
  to 830 px. Contrast alone passed a name plate that was 11 px tall at that width; G6 exists for that.
- **SEEK** catches state kept between frames. Sequential captures agree with each other even when a
  page draws trails; a frame sought out of order does not, and the run stops at exit 18 naming the
  frame and its time. An element whose opacity and transform change together can rasterize one level
  apart depending on what was painted before it, so a sought frame within one level per channel
  passes and is counted as `oneLevel` in the report.
- **ART** runs for each `base-art` entry. A page that relights a painting dims most of it at frame 0
  on purpose, so aim `checkBox` at the part it leaves lit (the hero bay); a flat fill in place of the
  art scores far below 0.90.

Run the same gate on any cover file, from a render or from elsewhere:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" cover-gate <dir>/cover.webp --strict
node "$SKILL_ROOT/scripts/motion.mjs" cover-gate <file> --frames <d> --frames2 <d> --masks <d> --title x,y,w,h --strict --json
```

Without `--frames`, `--frames2` and `--masks` only G1 to G4 can run. `--strict` fails on any TARGET
miss, the 2 MiB size included. Never raise a number, shorten the loop or drop a layer to get a pass;
find the cause on the sheet.

## What a cover render writes

```bash
node "$SKILL_ROOT/scripts/motion.mjs" cover --out <dir> --round <N>
```

One round validates the treatment, scans the page, checks `assets.json` and the fonts, captures the
master at 2x and downsamples it, captures the mask pass in the same browser, repeats every frame in a
fresh browser (G0, exit 18 on any difference), seeks the shuffled sample in a third browser, runs the
flash audit, encodes, and gates the decoded file. The render runs detached and writes
`<dir>/.run/progress.json` and `<dir>/.run/render.log`; if `run_command` hands back a command id before the render ends, read it with `command_status`; running the same
command again attaches to the render still running. The output folder then holds:

- `cover.webp` (or `cover.gif`) and `poster.png` (frame 0);
- `stills/sheet.png`: twelve decoded frames at `t = k/12` above a plot of every grid step's `d`, the
  still threshold as red dashes and the median as green dots; flat runs on the dashes are holds,
  regular spikes are encoder pops, a spike at the right end is a reset;
- `stills/poster.png`, `stills/seam.png` (the last decoded frame beside frame 0), and
  `stills/frame-00.png` to `stills/frame-11.png`, the sheet's frames at full size, all listed in
  `stills/index.json`;
- `gate-report.txt` (the verdict line and one line per gate), `manifest.json` (settings, bytes and
  the gate row), and `withheld/` only when the flash audit failed.

Exit codes a cover render can end with: 13 a gate below TARGET (the message names them), 16 the
treatment or the asset list entry, 17 the page contract or an unlisted or changed raster, 18 a clock
or entropy call or a frame that differs in a fresh browser or out of order, 19 a network request, 21
no encoder, 22 a missing asset.

## Looking at the cover

The gate cannot see damage. On the painted pilot the two worst defects were found only by eye: a
colour-dodge glint that turned one letter into a red block, and a wing glow that read as a dark disc.
So every round ends with a look. Open `stills/sheet.png`, `stills/poster.png` and `stills/seam.png`
with `read_file` (and any `frame-NN.png` you want closer), then answer the eight cover questions in
`references/look.md` and record them:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" look --out <dir> --round <N> --answers <file>
```

A cover has no stills-only round: round 1 is a full cover render followed by its look, and that
look names the `change` you will make before round 2.

### Defects and the window re-render

What the eye finds goes into the round's `defects`, at most three and worst first:

```json
"defects": [{ "t": 1.2, "region": [340, 10, 330, 50], "frame": "stills/frame-02.png",
  "observed": "<what is visible there>", "cause": "<why it happens>", "fix": "<the change you will make>" }]
```

`t` is the loop time in seconds where the defect shows, inside the loop's length; `region` is
`[x, y, w, h]` in whole cover pixels and on the cover; `frame` is a file of the current stills set that
shows it; `observed` is a real sentence; `cause` and `fix` each say something concrete. `look`
refuses an entry that breaks any of these.

Check each fix before paying for a full render:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" cover --out <dir> --round <N> --window <t0>,<t1>
```

It captures only the frames from `t0 - 0.5 s` to `t1 + 0.5 s` (wrapping across the seam) in a fresh
page and writes `windows/round-<N>/<t0>-<t1>/sheet.png`, with the defect's span shaded on the plot,
and `window.json`. These are frames before encoding. A window render never touches `stills/`, the
cover file, the report or the manifest, and it never counts toward done: the next full render and its
decoded gate decide.

## Done

A cover is done when all of these hold:

- the treatment is a valid cover treatment and has not changed since the last cover render;
- the last render was a cover render whose report reads `COVER gate --strict: PASS+TARGET`;
- `look.json` has at least two rounds, and the first names its `change`;
- the last round is stamped with the final render's stills and lists `stills/sheet.png`,
  `stills/poster.png` and `stills/seam.png` as viewed, each one really opened with `read_file` in this
  session;
- the last round asks for no further round, or it is round 3 and its open items go into the reply.

The LitGravity Stop hook runs this check on the last output folder and holds the turn with the named
reason, at most twice; after that it asks the reply to say plainly that the cover is not done and
why. When the cover is done but an asset is generated or a look item stays open, it holds once so the
reply says so. Rounds share one counter with the renders, 1 to 3.

## Not yet confirmed

- Whether the single keyframe reset at the loop point is visible to a person on a real README page;
  the numbers say smooth, and nobody has watched it there.
- How a cover reads inside GitHub's README column at full width; review so far used local frames.
- The encoder step formula comes from libwebp's animation encoder as remembered. Measured behaviour
  matches it (q72 drops slow fades, q86 to q90 drops fewer), but the source was not re-read.
- The FLOOR and TARGET numbers come from 8 positives and 4 negatives in one visual family; re-check
  them on the first covers made for unrelated projects.

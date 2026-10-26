# Cover mode (README cover loops)

Read this when the request is a README cover, a hero or banner loop, an animated project cover, or
any short image that plays forever at the top of a page. A cover is not a film. It has no beats, no
arc, no ending, no sound and no copy lines. It is one picture that never stops moving and never
shows where it starts. Film mode (the stage and type paths) is unchanged and still takes every
other request.

The difference matters because the film pipeline rewards the wrong things for a cover: beats of at
least 1.2 s, a new composition per beat, stills taken at beat midpoints, a settled end card and a
reading floor all push the result toward a slide deck. Cover mode replaces those with a loop
contract, a review that watches motion instead of stills, and a gate that measures the encoded
file a reader's browser will actually decode.

## What is different from a film

| Film rule | Cover mode |
| --- | --- |
| Beats of at least 1.2 s, each showing something new | No beats. Layers and one system, each continuous over the whole loop |
| Settled end card, MO-C-14 ink ratio, holds as a reward | No ending. Any hold over 0.5 s is a defect (G3) |
| 10 s minimum and the "never shorten" downgrade | 6–12 s; 8 s worked for every recipe |
| 16:9 or 9:16 only | 2:1 (page 1200×600, cover 1000×500) or 3:2 (page 1200×800, cover 960×640) |
| Authored score and the SOUND gates | Silent. `sound` is absent or `none` |
| Invented subject, invented copy lines | The brand word, plus at most one motto the user wrote or the project already uses |
| Title fade-in; stage skeleton fading from black | Frame 0 is the poster and already the full picture |
| Look questions about purpose and beat plans | Look questions about motion, the seam and damage (below) |

## Page contract

- Write `cover/index.html` in the output directory, with local assets beside it (`cover/assets/`).
  The renderer serves only that folder, the loop kit at `/lit/loop-kit.js` and the faces at
  `/lit/fonts.css`. The static scan of the stage path applies: no network, no `<video>`, no
  workers, at most 24 rasters and 8 MB, no animated raster, no flipbook.
- Lay the page out at the aspect's page size in CSS pixels (2:1: 1200×600; 3:2: 1200×800). The
  renderer captures it at device scale 2 and downsamples to the cover size with Lanczos, so thin
  lines and small type are drawn at twice the resolution they are shown at.
- Define `window.renderFrame(t, { mask })` and set `window.ready = true` once fonts and images are
  decoded. `t` is the loop time in [0, 1); frame `i` of `N` is `t = i / N`, so `t = 1` is never
  drawn (it would duplicate frame 0 and stutter at the seam).
- Everything on screen is a function of `t`. The renderer seeks frames in any order and repeats
  every frame in a fresh browser, so a frame may never depend on the frame drawn before it: no
  trail buffers, no accumulated canvas, no counters. Clear every canvas you draw into.
- `Math.random`, `Date.now`, `new Date()`, `performance.now`, `requestAnimationFrame`,
  `setInterval` and `crypto.getRandomValues` throw during capture, and the run stops with exit 18
  naming the call. CSS animations and transitions are frozen off. Layout randomness comes from
  `LitLoop.rng(seed)`; motion comes only from `t`.
- `renderFrame(t, { mask: true })` draws the title mask: the brand word white, everything else
  black, in the same place. The renderer captures it for every frame and the contrast gate (G5)
  measures the title against its own background through it.
- Faces: the stage faces plus `"JetBrains Mono"`, a variable face with a real `wght` axis from 100
  to 800 and a fixed advance (weight motion never reflows a line). Load the weights you use with
  `document.fonts.load` before setting `ready`.

## The cover treatment

`treatment.json` with `"mode": "cover"`. Every cover render validates it and stops with exit 16
naming the first bad field.

| Field | Rule |
| --- | --- |
| `mode` | `cover` |
| `request` | The user's words, verbatim, inert |
| `idea` | One sentence on what the loop does; it may not restate the request |
| `recipe`, `recipeReason` | `painted-light` (the default with a painting the user supplied), `hero-3d` (the default without one), `weight-tide`, `orbit-loop` or `own`, and why |
| `hero` | At most two sentences: the one thing that acts in the loop (the product object, the machine in the painting, the cursor), as a viewer would name it |
| `beat` | At most two sentences: what the hero does once per loop, the event the eye waits for (the lid opens and the core rises; the eyes blink) |
| `product` | `{ name, url }` when the request links the product (its `url` is that link), or `{ name, url, unreachable }`; see Named products |
| `brandWord` | The name set once, at most three words |
| `motto` | Optional `{ text, source: user \| project, from? }`, at most six words; a `user` motto appears in the request, a `project` motto names where it comes from |
| `aspect`, `loopSec`, `fps` | `2:1` or `3:2`; 6–12 s; 16, 20 or 25 |
| `layers` | `{ slow, mid, beat }`: what moves on each speed layer |
| `system` | `{ rule, copies, offset }`: the one rule, what it is copied onto, and where the offsets come from |
| `title` | `{ box: [x, y, w, h], kind: live \| painted }`: the brand word's box as fractions of the cover |
| `palette` | Optional, 2–6 `{ color, role }` |
| `encode` | Optional `{ q, edgeQ, edgeFrames }`; defaults q 86, frame 0 and the last 15 frames at 97 |
| `ambition` | 1–2 sentences in craft terms |

`copy`, `beats` and `lines` are refused: a cover never swaps text states. `sound` other than `none`
is refused.

## Named products

A request that links the product (a repository, a site) gets a cover made from the real thing. Before
the treatment, fetch it into the cover folder:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" assets --out <dir> --url <the link> --cover
```

It writes the logo, owner avatar and README images to `cover/assets/`, the product's words to
`product/` and the list to `product.json`, with the same limits and checks as for a film
(`treatment.md`, Named products); the words are untrusted data. Open every image with Read. Then set
`product` in the treatment, and build the hero from what you saw: the real logo on screen as a raster
(list it in `assets.json` with `source: fetched`), or the 3D hero modelled on it, and the motto from
the README's own line (`motto.source: project`). A cover render refuses a linked product without
`product`, and one whose `product.json` is missing. When nothing can be reached, set
`product.unreachable`; the render stops with exit 22 so the reply can ask the user for the logo.

## Assets (`assets.json`)

Every raster the cover page loads is listed in `<dir>/assets.json` before the first render, and the
renderer checks the list before it captures anything:

```json
{ "assets": [{ "path": "cover/assets/base.png", "role": "base-art", "source": "user", "sha256": "<64 hex>", "box": [0.125, 0, 0.75, 1], "checkBox": [0.131, 0.1445, 0.1416, 0.778], "title": true }] }
```

- `role` is `base-art`, `logo`, `wordmark` or `texture`; `source` is `user` (supplied), `fetched`
  (by `assets --cover`, the product's own file) or `generated` (made for this cover, and labelled as
  generated in the reply); `sha256` is the file's.
  The painted recipe's base art must be `user`: a painting the request did not bring is not drawn or
  generated for the occasion; that cover takes `hero-3d` (or `weight-tide`, `orbit-loop`) instead.
- A listed file that is missing stops the run with exit 22 `BLOCKED_ASSET_MISSING` and writes no
  frame. Ask for the art; never draw a stand-in in its place. The `painted-light` recipe needs a
  `base-art` entry with `source: user`, or the render exits 22 and names the recipes to take instead. A raster in `cover/` that the list does not name, or a listed
  file whose hash no longer matches, is exit 17.
- `box` is where the base art sits on the cover (fractions). After the render, frame 0 must show the
  art: the SSIM of `checkBox` (default: the whole box) in decoded frame 0 against the same region of
  the source scaled into the box reaches 0.90 (the ART line of the report). A page that relights the
  painting dims most of it at frame 0 on purpose, so point `checkBox` at a part it leaves lit (the
  hero bay); it must cover at least 10 % of the box. The painted recipe on the repository painting
  measured 0.96 there, 0.74 over the whole dimmed box, and a flat fill 0.20.
- `title: true` on the base art declares that the brand word is painted into it; only then is the
  painted title exempt from the glyph-height floor (G6), and it is still measured and reported.
- The art is scaled into its box, never cropped, and the raster limits of the stage path still apply.

## Craft rules, ranked

A cover is maximal by default, like a film: layered depth, the product's real parts with their names,
several accents by role, full 3D (`hero-3d`) where the subject has a back and an inside. It is minimal
only when the request asks for a calm, quiet or minimal cover. Density never breaks the rules below: it
is many copies of one rule, in three speed layers, around a brand word that never leaves.

1. **The encoder is part of the design.** Lossy animated WebP treats a pixel as unchanged when it
   moves less than about `31(1 - sqrt(q/100)) + sqrt(q/100)` levels from the previous frame: about
   6 levels at q72 and 3 at q90. Slow fades and slow breathing below that are dropped, go stale,
   and snap back at the next keyframe, which by default is the loop point. Every failure of this
   kind is invisible in the PNG frames and visible in the decoded file.
2. **Light is a moving edge, not an in-place fade.** A travelling window with a 24–40 px edge
   survives the encoder; a 150 px soft edge does not at q72 (moving share fell from 0.92 to 0.83 and
   the seam jumped to 24 times its neighbours on the same frames). At a high edge quality the soft
   edge survives and reads as a wash instead: no motion gate sees that, so the look review has to.
3. **Something translates.** A weight tide alone lost most of its motion in the encoder (median
   step 0.0007, seam 14×). One word of row drift per loop kept all of it (0.0098, seam 1.1×).
4. **One rule, many copies, offsets from position.** One swell over 600 letters, one orbit rule
   on three rings, one light window over the bays. Offsets come from x, y, angle or a loop-noise
   field, and the wave appears by itself. No timeline, no scenes.
5. **Three speed layers.** A slow, perpetual, linear layer (drift, laps, rising motes), a mid swell
   (the tide, the light window), and micro events on a beat (a cursor step with `outBack`, a gate
   flash, a blink, a flare). Every cover that reached TARGET had all three.
6. **The brand word is set once and never leaves.** It is the material (its weight moves, its
   position does not), or it is static beside the system, or it is painted into the base art and
   lifted. Motion happens in, around or behind it.
7. **Frame 0 is the poster.** Reduced-motion readers, thumbnails and slow networks show it alone,
   so it is the whole picture: no fade from black, no empty opening.
8. **Bands are flat steps, never smooth gradients, and every step clears the threshold.** A 3 px
   leading line with a two-step afterglow (0.10, 0.05) passed; a third 0.03 step drifted and pushed
   the seam from 1.71 to 2.48. A single flat slab encodes well but reads as a box.
9. **Exponential tails are slow fades.** `expImpulse` decays below the threshold for half the loop.
   Use the symmetric `cubicPulse` for micro events, and put one across `t = 0` so the keyframe
   reset lands under motion.
10. **Small movers over texture are expensive.** Each mote over a painting makes the encoder
    re-send the textured blocks around it; keep motes few and mostly on the plain wings.
11. **Lift a painted title instead of laying live text over it.** A luminance-keyed gain (only
    pixels above the plate's level) raises dark painted letters to 4.5:1 and keeps the plate
    black; thresholding the same letters gives the mask. Live text set at a painting's scale came
    out 11 px tall on screen.
12. **Spend quality at the seam, not on keyframes.** What is left at the loop point once every
    edge is sharp is requantisation: keyframe 0 and the frames before it carry different error.
    Raise the quality of frame 0 and the last second (`edgeQ`, `edgeFrames`) and keep the default
    keyframes. Periodic keyframes (`-kmin 15 -kmax 16`) spread the snap into visible pops, and a
    small `-kmax` (4–8) made a 2.5–5 Hz shimmer.
13. **16 fps for slow painted covers, 20 for a 3D hero, 25 for a system with fast dots.** 20 fps
    cost 18 % more and dropped the median step below 0.0015 on the painted cover. At 16 fps img2webp
    writes 63 ms frames, so an 8 s loop is 8.064 s; that is fine. The gate measures on a 50 ms grid,
    and a smooth 3D turn at 25 fps lands one grid step on two frames at the seam (seamLocal 2.35,
    FLOOR only, while the raw frames were smooth); at 20 fps every grid step is one frame and the
    same page reached TARGET (1.2).
14. **A lit 3D object needs a clean shadow and a high `q`.** Shadow acne on a turning object flickers
    and reads as flashes on the sheet: set the key light's `shadow.bias` (about -0.0004) and
    `shadow.normalBias` (about 0.03). Smooth white surfaces blotch in lossy WebP at q86; the 3D hero
    recipe encodes at q94 (edge 97 over 15 frames).

## Recipes

Each recipe ships as a worked page in `recipes/<name>/index.html`. Copy it into `cover/`, then
replace the brand word, the motto and, for the painted recipe, the `ART` block. The pages are
examples; the rules above are what transfers. Every recipe has a hero and a beat: the treatment
names them, and look question 9 checks the beat on the stills.

- **3D hero (`hero-3d`, the default without a supplied painting).** One product object, lit in a
  small studio, drawn with the vendored three.js on the GPU rung (`depth.md`). Slow: the object turns
  exactly once per loop. Mid: the camera breathes twice. Beat: once per loop the lid opens
  (0.28-0.44 of the loop), a lit core rises and settles back, a ring runs out across the floor, and
  the lid closes (0.62-0.78), so every value is back at its start by `t = 1`. The brand word and the
  motto sit still on the left in a 2D canvas over the GL canvas; the mask pass hides the GL canvas.
  `AIM` is the pixel the object's origin lands on (`setViewOffset`), so the word keeps its side of
  the frame. Replace the `HERO` group with the project's own object (its real logo as a texture or an
  extruded shape is the usual start), keep the turn slow and the open eased, and keep 20 fps
  and q94. On this machine it reaches TARGET (median d 0.0025, moving 1.0, seamLocal 1.2). If the GPU
  is unavailable it renders on the software rung, slower, and the report says so.

- **Painted base + travelling light (`painted-light`, the default when the user supplies a painting).**
  A finished painting the user supplied is the whole picture; the page relights it. With no painting,
  `hero-3d` is the default.
  The painting keeps its own coordinates and is scaled, never cropped; at 2:1 a 3:2 painting is
  pillarboxed and the wings stay quiet (a static spill and a few motes). Macro: a light window
  with a 24 px feather walks the dim bays once per loop. Mid: a scan band per bay at two passes per
  loop, offset by the bay's position; one fast skewed glint across the title in **overlay** blend
  (screen brightens a visible box; colour-dodge turned a coloured letter into a red block); a comet
  lapping the hero border. Beat: the eyes breathe twice, the core once, one blink, the accent word
  flares at `t = 0` and `t = 0.5`. A denser, brighter painting needs a deeper dim pool and a
  lower `q` (the repository painting reached TARGET at dim 0.68, q 83, edge 97 over 18 frames).

  **Choosing the hero.** Any bay can be the hero, so each product's cover can feature its own
  machine on a shared line-up. Three things move together:
  1. `ART.hero` is the bay index (0 is the leftmost bay). The dim pool is clipped around that bay,
     so a hero in the middle stays at source brightness while the light window still walks every
     other bay as one continuous light. The comet laps the hero's border and its scan band stays
     at full strength.
  2. `ART.lights` maps a bay index to the light anchors measured on that machine
     (`{ cx, cy, rx, ry, k }` in painting pixels; `k` 0 and 1 are eyes that breathe twice and
     blink, `k` 2 is a core that breathes once). Only the hero's entry glows. A hero with no entry
     stops the page with `ART.lights has no entry for the hero bay N` (the render ends at once
     as `STAGE_CONTRACT_ERROR` with that message), because borrowing another machine's
     coordinates draws its eyes on the wrong body. Measure the anchors, or write `[]` for that bay
     to run with no beat lights and say so in the treatment's beat layer.
  3. The base art's `checkBox` in `assets.json` points at the hero bay. With the shipped layout
     (painting scaled by `S = 600 / 1024` and pillarboxed 150 px from the left of a 1200 x 600
     page) a bay `[x0, x1]` with panel `top` and `bottom` is
     `[(150 + x0·S) / 1200, top·S / 600, (x1 - x0)·S / 1200, (bottom - top)·S / 600]`. A box left on
     another bay measures a dimmed bay and the ART line fails.

  The accent flare and the title glint belong to the painted motto and title, not to the hero, and
  stay where they are.
- **Weight tide (`weight-tide`).** JetBrains Mono rows of the brand word at about 1.3:1 to the
  background drift one word length per loop, alternate rows opposite ways. Weight is
  `gain(swell(fract(t - offset)), 2.4)` with `offset = 0.85·x/W + 0.35·y/H`. The hero word on a
  knockout band takes the same field over 330–800 so it never thins. One accent: a cursor that
  dwells under each letter, steps on with `outBack`, and carriage-returns home.
- **Orbit loop (`orbit-loop`).** Three rings with integer laps per loop (3, 2, 1), alternating
  directions, dots with fading arc trails. A gate at twelve o'clock flashes on every crossing and
  pulses the dot; the crossing times, computed analytically, light the cells of a ledger under
  the word, as many crossings as cells so the ledger loops. The core breathes once per loop and
  rings on each bar. The word stays static on the left.
- **Own.** Any system that keeps the rules: one rule many copies, three layers, a still word,
  edges instead of fades. Name it in `recipeReason`.

## Loop kit (`/lit/loop-kit.js`)

`LitLoop` holds: `rng(seed)` (mulberry32, layout only); `makeNoise(seed)` and
`loopNoise(noise, t, offset, radius)` (value noise walked on a circle, so it closes at `t = 1`);
`ease.smooth`, `ease.outCubic`, `ease.inCubic`, `ease.outExpo`, `ease.outBack(p, s)`,
`ease.gain(p, k)`; `cubicPulse(c, w, x)` and `expImpulse(x, k)`; `phase(t, offset, cycles)`;
`cdist(p, c)` (distance around the loop, for an event that straddles `t = 0`);
`window(p, start, dur)` (a one-shot event inside the loop, -1 outside); `steps(p, stops, travel,
ease)` (hold and move); `swell(p)` (a cosine swell that dwells at both ends); `TAU`, `clamp`,
`fract`, `mix`. Every helper is periodic in `t` or pure.

## Encode

img2webp, lossy, loop forever, `-m 4`, every frame `-d` = round(1000 / fps) ms, frame 0 and the
last `edgeFrames` at `edgeQ`, default keyframes. `-m 6` took minutes and gained little; `-mixed`
changes nothing while every frame is lossy. When img2webp (or dwebp, which the gate decodes with)
is missing, gifski is the fallback at quality 90. Neither present is exit 21
`BLOCKED_NO_COVER_ENCODER`. A cover is never an MP4: README renderers do not autoplay video.

## Gate (decoded file)

The gate decodes the encoded cover (dwebp per frame, composited as a browser does) and measures on
a fixed time grid of `max(50 ms, shortest frame)`, because the encoder merges identical frames into
long ones and frame counts would flatter a slide film. `d` is the mean |ΔY| (luma 0..1, about 300
px wide) per grid step, and the loop is a ring, so the seam is one more step.

| Gate | Metric | FLOOR (fail) | TARGET (cover mode) |
| --- | --- | --- | --- |
| G0 determinism | SHA-256 per frame, two captures in fresh browsers | 100 % identical | same |
| G1 budget | bytes, duration, loop | ≤ 3 MiB, 6–12 s, loop 0 | ≤ 2 MiB |
| G2 motion energy | median d; share of moving steps | ≥ 0.0004; ≥ 0.45 | ≥ 0.0015; ≥ 0.95 |
| G3 anti-slide | longest still run; max d / median d | ≤ 2.0 s | ≤ 0.5 s, spike ≤ 6 |
| G4 seam | seam / mean of the two steps on each side | ≤ 8 | 0.25–2.0 |
| G5 title contrast | median title pixel vs 90th-percentile background in the box, every frame, through the mask | ≥ 4.5:1 | same |
| G6 title size | cap height of the title glyphs in the mask, at the README display width (830 px) | ≥ 24 px | same; a title painted into declared base art is INFO |
| SEEK order | 16 frames in a seeded shuffled order in a fresh page, against the master | identical, or within one level per channel (else exit 18 naming the frame and its time) | same |
| ART | SSIM of the base art's check box in decoded frame 0 against the source | ≥ 0.90 | same |
| FLASH | WCAG 2.3.1 flashes per second, looped | ≤ 3 general, ≤ 3 red | same; a FAIL withholds the cover |

FLOOR was set so that eight earlier painted covers pass and four slide-like negatives fail; TARGET
is what cover mode delivers, and those earlier covers miss it on purpose (a 1.9 s hold, a flash at
the seam). The cover render exits 13 until every gate reaches TARGET. G2 and G3 are area-weighted:
a small comet on a still picture counts as still at thumbnail scale, which is intended. Never
raise a number, shorten the loop or drop a layer to pass; fix the cause.

G6 measures the mask frames: the white pixels in the title box split into connected glyphs, dots
and accents (under 1 % of the largest glyph's area or 30 % of the tallest) are left out, and the
median glyph height of the smallest sample, scaled from the cover width to 830 px, is the cap
height. A live name plate set at a painting's scale came out about 11 px at that width; contrast
alone passed it. The seek-order check catches a page that keeps state between frames (a trail drawn
by never clearing a canvas): the sequential captures agree with each other, a frame sought out of
order does not. An element whose opacity and transform change together can rasterize one level
apart depending on which frames were painted before it, so a sought frame within one level per
channel of the master passes (the report counts them as `oneLevel`); kept state differs by far more.

`node "$SKILL_ROOT/scripts/motion.mjs" cover-gate <file> [--frames d --frames2 d --masks d
--title x,y,w,h] [--strict] [--json]` runs the same gate on any cover file.

## Review

Every cover render writes, from the DECODED file:

- `stills/sheet.png`: twelve frames at `t = k/12` above a plot of every grid step's `d`, the still
  threshold (red dashes) and the median (green dots). Holds are flat runs on the dashes; encoder
  pops are regular spikes; a reset is a spike at the right end.
- `stills/poster.png` (frame 0) and `stills/seam.png` (the last frame beside frame 0);
- `stills/frame-00.png` … `frame-11.png`, the sheet's frames at full size, for a closer look.

The gate cannot see damage. The pilot's two worst defects were found only by eye on the sheet: a
colour-dodge glint that turned a letter into a red block, and a wing glow that read as a dark disc.

Answer all nine every round, each naming a frame from the stills set and what you saw there:

1. Is something moving in every half-second window (the plot never lies flat on the dashes)?
2. Does the seam disappear in the decoded file (`seam.png`, the right end of the plot)?
3. Does it still move after encoding: no region that freezes and then pops?
4. Is the brand word present, legible and in place in every frame, never faded or swapped?
5. Are all three speed layers visible: a slow perpetual layer, a mid swell, beat events?
6. Does anything read as a slide, a card swap, a title fade or an end card, or does light wash in
   place instead of travelling as an edge?
7. Is any glyph, glint or glow damaged: a colour block, a dark disc, a visible box?
8. Name one thing a skilled motion designer would add or remove, or `none`.
9. Does the hero act its beat once per loop, as the treatment's `beat` says, and is it the thing the
   eye follows?

A `no` on 1–5 or 9, a `yes` on 6 or 7, or a `named` 8 asks for another round. Record the round with
`look --out <dir> --round <N> --answers <file>`; the answers file has the film's shape (`viewed`,
`answers` with `q`, `verdict`, `frame`, `observed`, `aids`) without `weakestBeat`, and round 1
names the `change` you make before round 2.

## Defects and window re-renders

What the eye finds goes into the round as `defects`, at most three, worst first:

```json
"defects": [{ "t": 1.2, "region": [340, 10, 330, 50], "frame": "stills/frame-02.png", "observed": "<what is visible there>", "cause": "<why>", "fix": "<the change>" }]
```

`t` is the loop time in seconds where the defect shows, `region` the `[x, y, w, h]` it covers in
cover pixels, `frame` a file of the current stills set that shows it. `look` refuses a defect without
a time, outside the loop, off the cover, or on a frame that is not in the current stills set.

Before the next full render, check each fix locally:
`motion.mjs cover --out <dir> --round <N> --window <t0>,<t1>` captures only the frames from
`t0 - 0.5 s` to `t1 + 0.5 s` (wrapping at the seam) and writes
`windows/round-<N>/<t0>-<t1>/sheet.png` (the span shaded on its plot) and `window.json`. It shows the
frames before encoding, writes nothing to `stills/`, the report or the manifest, and never counts as
done: the full render and its gate decide.


## Rounds and done

Rounds share one counter with the renders, 1 to 3. Each round is a full cover render followed by
a look. Done needs all of: a valid cover treatment; the last render's report reading
`COVER gate --strict: PASS+TARGET`; at least two look rounds, the first naming its change; the last
round stamped with the final render's stills and viewing `stills/sheet.png`, `stills/poster.png`
and `stills/seam.png`, each opened with Read. After round 3, deliver with the open items said
plainly. A window re-render never counts. The Stop hook checks every item, and when the cover is
done it asks the reply to label every asset `assets.json` marks as generated.

## Recipe rows and negatives

Each recipe keeps its gate row in `recipes/<name>/expected.json` (median d, moving share, longest
still, spike, seamLocal, bytes, the settings and the treatment it shipped with). `npm run
qa:cover-recipes` in a LitGravity checkout re-renders every recipe through this renderer and fails
when median d or the moving share leaves ±15 % of its row, seamLocal leaves TARGET or the file passes
2 MiB.

Every negative and regression declares the gates it must fail (`mustFail`, as `G2.floor` or
`G1.target`). `--negatives` renders them all, and one counts as caught only when its render
completed and gated the decoded file, every declared gate failed, and no undeclared FLOOR gate
among G1–G4 failed. A crash, a missing declaration or a failure on another gate fails the QA.

The painted recipe declares one regression, `feather-150` (`--feather 150` runs it alone): the
light edge widened from 24 to 150 px. The defect it stands for is light drawn as a soft wash
instead of a moving edge, but at this recipe's encode (q83, edge q97 for 18 frames) the encoder
keeps the soft edge, and the motion numbers stay where the recipe's are (moving 1.0, seamLocal
1.91–2.01 across six renders, against 1.965). What it reliably trips is the size TARGET (G1:
2.50–2.60 MB against 2.06 MB), so `G1.target` is all it declares. A decoded-file edge measure was
tried and dropped: the share of each step's change carried by pixels that move at least 8 levels
was 0.501 at 150 px against 0.587–0.660 for this painting at 24 px, but 0.319 for an earlier cover
of the same painting whose window edge was sharp and whose scan bands were soft. It measures every
soft change in the frame, not the travelling edge, and any threshold would be fitted to one
painting. The soft wash is caught by look review on the sheet (question 6 under Review).

`recipes/negatives/` ships four slide-like pages that must keep failing on their named gates: a title
slam with line-by-line text and an end card (G2, G3), card scenes that fade in, hold and fade out
(G2), a still with a faint breathing glow (G2, G3), and a progress sweep that resets at the seam
(G4). They are never recipes; read them to see what cover mode exists to prevent, and never tune a
threshold so one of them passes.

## Commands

```bash
node "$SKILL_ROOT/scripts/motion.mjs" cover --out <dir> --round <N>
node "$SKILL_ROOT/scripts/motion.mjs" cover --out <dir> --round <N> --window <t0>,<t1>
node "$SKILL_ROOT/scripts/motion.mjs" look --out <dir> --round <N> --answers <file>
node "$SKILL_ROOT/scripts/motion.mjs" cover-gate <dir>/cover.webp --strict
```

A cover render runs detached with its log in `<dir>/.run/render.log`; give the call a timeout of at
least 600000 ms. It writes `cover.webp` (or `cover.gif`), `poster.png`, `stills/`, `manifest.json`
and `gate-report.txt`. Exit 13 names the gates that miss TARGET; 16 the treatment field; 17 the
page contract or the asset list; 18 a call that is not a function of `t`, or a frame that differs in
a fresh browser or when sought out of order;
19 a network request; 21 no cover encoder; 22 a listed asset is missing.

## Unconfirmed

- Whether the default single keyframe reset is visible to a person on a real README; the numbers
  say smooth, nobody has watched it there yet.
- How a cover reads inside GitHub's README column at 100 % width; review so far used local frames.
- The encoder threshold formula comes from libwebp's animation encoder as remembered; measured
  behaviour matches it (q72 drops slow fades, q86–90 drops fewer).
- The thresholds come from 8 positives and 4 negatives in one family's style; re-check them on
  covers made for other projects.

# The stage path

Load this once the treatment says `path: stage`. On this path the film is a web page you write, and the
LitGravity renderer turns it into frames: it serves the page to a headless Chrome on a private origin,
drives a virtual clock from zero, captures every frame in order, then encodes, replays and gates the
result. You draw everything the treatment promised, the subject first. The kit described below supplies
timing and reveal primitives and nothing pictorial, so no two stage films start from the same template.

## The page contract

The page lives at `<dir>/stage/index.html`, next to the local files it uses (SVG, PNG, JPG, WebP, JS,
CSS, WAV). Only that folder is served, under the origin `http://lit.stage`; a symlink that resolves
outside it is a contract error.

Two routes come from the renderer itself and are always available:

- `<link rel="stylesheet" href="/lit/fonts.css">` declares the verified faces (table below).
- `<script src="/lit/stage-kit.js"></script>` defines the global `LitStage`.

The page hands the renderer its spec with `LitStage.define({ width, height, fps, duration, render })`, or
by assigning the same object to `window.litStage`. `define` checks the spec as soon as it is called:

- `width`×`height` is 1920×1080 for `format: 16:9` or 1080×1920 for `format: 9:16`, and must match the
  treatment. Any other size, or a capture whose real size differs, stops the run with exit 17.
- `fps` is 60, or 30 when the treatment sets `fps: 30`. A mismatch with the treatment is exit 17.
- `duration` is a positive number of seconds. The gate's MO-C-12 rule fails a film whose encoded length is
  more than 10 % away from `treatment.durationSec`; length belongs to the arc, so the page never trims it.
- `render(t)` paints the frame at `t` seconds. The renderer calls it once per frame, in order from zero. The
  page runs no loop of its own.

Copy lives in a single `COPY` object at the top of the page script, one entry per `copy.lines` line, word
for word. That keeps edits in one place, and the text QA then has to find every line on screen; a line it
cannot find is quoted in a `TEXT-COPY-FOUND` failure.

A bare skeleton (every angle-bracket value is yours to fill):

```html
<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="/lit/fonts.css">
<script src="/lit/stage-kit.js"></script>
<style>html, body { margin: 0; width: <width>px; height: <height>px; overflow: hidden; background: <colour>; }</style>
<body>
  <svg id="subject" viewBox="0 0 <width> <height>"><!-- the drawn subject --></svg>
  <h1 id="headline"></h1>
  <script>
    const COPY = { headline: "<copy line>" };
    const { define, text, at, ease } = LitStage;
    const h = document.getElementById("headline");
    h.textContent = COPY.headline;
    text(h);
    define({ width: <width>, height: <height>, fps: 60, duration: <seconds>, render(t) {
      h.style.opacity = at(t, <start>, <seconds>, ease.standard);
    } });
  </script>
</body>
```

## What `LitStage` offers

Everything in the kit (`engine/stage/stage-kit.js`) is a pure function of its arguments, so the same `t`
always yields the same picture.

**Easing.** `ease` holds `linear` plus the `in`, `out` and `inOut` forms of `Quad`, `Cubic`, `Quart`,
`Quint`, `Sine`, `Expo`, `Circ` and `Back` (`ease.outCubic`, `ease.inOutSine`, `ease.outBack` …), and five
motion-design curves: `standard`, `emphasized`, `decelerate` (settle-heavy arrivals), `accelerate` (quick
exits) and `css`. Each maps 0..1 onto 0..1 with exact ends. `cubicBezier(x1, y1, x2, y2)` builds your own.

**Physics.** `spring({ stiffness, damping, mass, velocity })` returns an analytic position function from 0
toward 1: `const s = spring({ damping: 14 }); el.style.scale = s(t - start);`. `spring.settle(opts)`
returns how many seconds that spring needs to settle within 0.1 %, which is how you size the beat around it.

**Timing.** `at(t, start, dur, ease)` gives clamped, eased local progress. `kf(t, keys)` interpolates
keyframes `[{ t, v, ease }]` whose values may be numbers, number arrays or colours; `ease` on a key shapes
the segment that starts at it, and the end values hold outside the keys. `stagger(i, each, { from, count })`
offsets a set (`from` may be `"center"`). `seq([name, dur, offset?], …)` lays out named steps; a negative
offset overlaps the previous step, and the result answers `p(name, t)`, `local(name, t)`,
`active(name, t)`, `seg[name].start` and `duration`.

**Randomness.** `rand(seed)` is a seeded generator; `rand.int(seed)(lo, hi)` and `rand.range(seed)(lo, hi)`
are the integer and float forms. Use these for scatter, jitter and layout so a replay matches.

**Text.** `splitText(el, { by })` with `by` = `grapheme`, `word`, `eojeol` or `line` replaces the element's
text with `<span data-lit-part>` units (inline-block, so transforms apply; `line` units are blocks) and
returns them. Passed a string, it returns the pieces. A Hangul syllable is never split, and `eojeol` keeps
each space-separated Korean word whole.

**Shapes and reveals.** `drawPath(pathEl, p)` draws an SVG stroke from 0 to 1. `morph(fromD, toD, { samples })`
returns `p => d` between two single-subpath shapes (64 samples by default). `clipRect(el, p, { from })`
reveals from `left`, `right`, `top`, `bottom` or `center`, and `wipe` is the same call. `clipCircle(el, p,
{ x, y })` opens an iris from a point in percent. `maskLinear(el, p, { angle, feather })` is a soft reveal
along an angle.

**Colour and arithmetic.** `mix(a, b, t, { space })` blends two colours in oklab (default) or sRGB, and
`rgba(colour, alpha)` sets alpha. `clamp`, `lerp`, `invLerp`, `remap(x, a, b, c, d)` and
`smoothstep(a, b, x)` cover the rest.

**Registration.** `text(el, { decor })` marks an element as a text run; `text({ content, x, y, w, h })`
registers canvas or WebGL text for the frame being drawn (see Text and the QA).

## Faces

`/lit/fonts.css` declares only the verified faces, each with `font-display: block`, so no frame is ever
captured in a fallback face. The family names are exact:

| Family | Weights / widths | Use |
| --- | --- | --- |
| `"Pretendard"` | 400, 700 | Hangul and Latin, body and display; all Korean copy |
| `"Archivo"` | 400, 700, 900 at `font-stretch` 75 %, 100 %, 125 % | Latin display |
| `"VT323"` | 400 | Latin terminal voice |
| `"Silkscreen"` | 400, 700 | Latin pixel voice |
| `"Galmuri9"` | 400 | Hangul and Latin pixel voice |
| `"MesloLGS NF"` | 400 | Latin monospace |
| `"JetBrains Mono"` | variable `wght` 100–800 | Latin monospace with a fixed advance, so weight animation never reflows |

A family outside this list falls back to a system face; the text QA reports it (`TEXT-FONTS`), and fails it
when the run carries copy. Ask only for weights the family has, since the browser would fake a bold
otherwise, and never animate letter-spacing or width on Hangul.

## Who owns time

The renderer does. An init script installed before the page loads replaces the wall clock with a virtual
one that advances only when the renderer steps a frame: `Date` (pinned to 2026-01-01 plus elapsed virtual
time), `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `requestIdleCallback`,
`document.timeline`, CSS animations and transitions, the Web Animations API with its promises, SVG SMIL and
`Math.random` (seeded from the treatment). CSS keyframes, WAAPI chains and timers are therefore safe.

What escapes the clock is not: `performance.timeOrigin`, `crypto.getRandomValues`, or anything else that
reads real time or real entropy. The full render replays the page in a second, fresh Chrome from zero and
compares sampled frames (the first, the last, every beat start and the beat midpoints) by the SHA-256 of
their RGBA bytes. Any difference stops the run with exit 18 `STAGE_NONDETERMINISTIC`, naming the frame and
the first differing 64×64 region. Variation comes from `LitStage.rand(seed)`.

## What a page may not contain

- The elements `<video>`, `<audio>`, `<iframe>`, `<object>`, `<embed>` and `<frame>`; the APIs `Audio`,
  `AudioContext`, `OfflineAudioContext`, `Worker`, `SharedWorker` and service workers. Each is stubbed,
  recorded and turned into exit 17 with its name. Sound is planned in the treatment and muxed by the
  renderer; a page never plays any.
- Any network: `WebSocket`, `WebTransport`, `RTCPeerConnection`, an absolute `http(s)://` URL, a
  protocol-relative `//…` URL, and preconnect or prefetch hints. The source scan and the live request log
  both end in exit 19 `STAGE_NETWORK_REQUEST` with the URL or API named.
- Third-party libraries. Nothing is installed, downloaded or pasted into the stage folder. A script over
  150 KB or carrying a `@license` banner is flagged as a likely library in the warnings.
- Too many or animated rasters. At most 24 raster files (PNG, JPG, WebP, GIF) and 8 MB in total; ten or
  more rasters of the same pixel size are treated as a flipbook; any animated GIF, APNG or WebP is refused.
  All are exit 17. Rasters are textures and stills inside a drawn scene.
- A film made some other way. A frame loop encoded by hand, a screen recording or an image sequence pushed
  through ffmpeg is not the deliverable, whatever it looks like. Every frame goes through this renderer.

## Text and the QA replay

A third Chrome replays the clock for the text QA, so measuring never disturbs the master capture. It
samples at 10 fps for presence and opacity, and at the QA samples (each beat midpoint, plus two settled
frames at 75 % and 90 % of each beat) it renders the frame twice, once with an ink rule switched on, and
measures the glyph pixels inside each text run's boxes.

- A run is the text of a block element marked with `LitStage.text(el)`, or of the nearest block element,
  however it is split into spans.
- Illustrative words inside a drawing (a label on a sketched device, numbers on a dial) are decor:
  `text(el, { decor: true })`. Decor is exempt from title-safe and the reading floor, its contrast only
  warns, it may never carry a copy line, and it may cover at most 25 % of the visible text area in a sample.
- Canvas and WebGL text is invisible to the QA unless it is registered every frame with
  `LitStage.text({ content, x, y, w, h })`; unregistered canvas text is a `TEXT-CANVAS` warning that the
  look round must answer by eye.

The rules it reports: `TEXT-COPY-FOUND` (every copy line seen), `TEXT-CONTRAST` (settled copy at 4.5:1,
or 3:1 when the font size is at least 3 % of the frame's short side), `TEXT-TITLE-SAFE` (copy inside the
central 90 %), `TEXT-READING` (each line readable at least its reading floor: 0.2 s per Hangul syllable
plus a word rate of 3.3 per second, never under 0.9 s for a Latin line or 1.0 s for a Hangul one),
`TEXT-DECOR`, `TEXT-FONTS`, `TEXT-CANVAS`, `TEXT-META-LABEL` (the request, a file name or a word like
path, preset, gate, beat or treatment shown as a label) and `TEXT-PRESENCE` (at least half the beat
midpoints show drawn content outside the text, so the film does more than name its subject).

## Effects and their limits

`morph` refuses shapes with more than one subpath (`morph: multi-subpath paths are unsupported`); morph
each subpath on its own or cross-fade. For WebGL, create the context with `preserveDrawingBuffer: true`;
a page that asks for WebGL and gets none on any rung exits 11.

Chrome rasterizes every tile in full on the CPU, so blurs, `backdrop-filter`, `mix-blend-mode`, shadows,
SVG filters, SMIL, canvas `shadowBlur` and shaders all replay pixel for pixel. One known quirk remains: an
element whose opacity and transform change together can land one level apart depending on which earlier
frames were painted. The determinism replay therefore paints and captures every frame exactly like the
master. A stills-only frame skips the paints between wanted frames and may differ from the master by that
one level; that is expected and never a reason to change the page.

## Running it

```bash
node "$SKILL_ROOT/scripts/motion.mjs" stage --out <dir> --round 1 --stills-only
node "$SKILL_ROOT/scripts/motion.mjs" stage --out <dir> --round 2
```

The stills-only round writes `<dir>/stills/`: one PNG per beat midpoint, one transition strip per cut (the
frames 6 before, at and 6 after the cut, side by side at half size), a 12-frame contact sheet, and
`stills/index.json`. Nothing is encoded. Open those PNGs with `read_file` and record the round as
`references/look.md` describes before the full render.

The full render captures the master, encodes the MP4 (with the planned sound muxed), builds the preview
WebP or GIF, the poster and the reduced-motion still, runs the determinism replay and the text QA in
parallel, and writes `gate-report.txt`, `manifest.json` and `render.jsonl`. It runs detached and logs its
phase to `<dir>/.run/progress.json`. If `run_command` returns before the render ends, read it with `command_status` or run the same command again: it attaches
to the render already running and returns its result. Never cut the film short to finish sooner.

## The stage gate

`gate-report.txt` ends with `QA gate: PASS` or lists the failed rule ids. The stage rules are:

- `MO-C-03` the flash audit on the master and on the looping preview (at most 3 general and 3 red flashes
  in any one-second window). A failure withholds every export into `withheld/` as diagnostics.
- `MO-C-10/11` the MP4 is the format's size, at least the minimum fps, `yuv420p`, BT.709 primaries,
  transfer and matrix, `tv` range.
- `MO-C-12` the length is within ±10 % of `treatment.durationSec`.
- `MO-C-13` the preview is at most 3 MB and the poster at most 1 MB (a master above 100 MB per 10 s warns).
- `MO-C-14` the reduced-motion still (the final beat's midpoint) exists.
- `MO-D-03` no empty near-black run longer than 2.4 s (1 s extra is allowed at the very start or end).
- `MO-C-02` WebGL on the software rung, reported only when the page uses WebGL.
- `MO-C-09` the determinism replay matched.
- `MO-A-37..41` the film, preview, poster and reduced-motion still are all present.
- The `TEXT-*` rules above and the `SOUND-*` rules from `references/sound.md`.

No rule is waived to pass, and the flash audit is never weakened.

## Exit codes on this path

| Exit | State | What to do |
| --- | --- | --- |
| 10 | `BLOCKED_NO_CHROME` | Install Chrome or set `CHROME_PATH`. |
| 11 | `BLOCKED_NO_WEBGL2` | Only when the page asked for WebGL and no rung had it. |
| 12 | `BLOCKED_NO_FFMPEG_FOR_VIDEO` | The stills and sheet exist; install ffmpeg for the film. |
| 13 | `GATE_FAIL_QA` | Fix the named rule and render the next round. |
| 14 | `BLOCKED_DEPS_NOT_PREWARMED` | The user runs `npx @litfamily/litgravity runtime install motion` in a terminal (or as an allowed `run_command`). |
| 15 | `BLOCKED_FONT_FETCH` | A cached font is missing or fails its hash; same pre-warm command. |
| 16 | `BLOCKED_TREATMENT_INVALID` | Fix the named treatment field. |
| 17 | `STAGE_CONTRACT_ERROR` | Fix the element, API, raster, size, fps or missing copy the message names. |
| 18 | `STAGE_NONDETERMINISTIC` | Drive the named frame's source from `t` or a seeded `rand`. |
| 19 | `STAGE_NETWORK_REQUEST` | Remove the URL or connection; everything is local. |
| 20 | `SOUND_INVALID` | Fix the bed or the track the message names. |

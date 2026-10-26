# Stage path

Read this after the treatment sets `path: stage`, with `studio.md`. On the stage path you author the
film as a web page and the renderer captures it frame by frame, deterministically, then runs the gate.
The house style gives the frame: palette, type roles, layout zones, motion tokens and hand-offs, served
to the page as `/lit/style.css` and `/lit/style.js`. The subject, its drawing and its motion are yours.
Start every page from `motion.mjs scaffold --out <dir>`, which writes the structure from the treatment.

## Contract

- Write `stage/index.html` inside the run's output directory, plus any local assets it needs:
  SVG, PNG, JPG, WebP, JS, CSS and WAV files beside it. Nothing else is served.
- The page loads the fonts, the style and the kit from the renderer's own routes:
  `<link rel="stylesheet" href="/lit/fonts.css">`, `<link rel="stylesheet" href="/lit/style.css">`,
  `<script src="/lit/style.js"></script>` and `<script src="/lit/stage-kit.js"></script>`.
- Each shot's copy sits in its layout's type zone, in a type-role class and a colour class of the style;
  the gate's style rules check the result (`studio.md`).
- The page calls `LitStage.define({ width, height, fps, duration, render })`, or sets
  `window.litStage` to the same object. `render(t)` draws the frame at `t` seconds. The renderer
  calls it once per frame, in order, from 0; the page never runs its own loop.
- Size is exactly 1920×1080 for `format: 16:9` or 1080×1920 for `format: 9:16`, matching the
  treatment. A capture of any other size stops the run (exit 17).
- `fps` is 60. Use 30 only when the treatment says so, which it may only when the request asks for 30 fps.
- `duration` must land within ±10 % of `treatment.durationSec`, or the gate fails. Length comes
  from the treatment's arc; do not trim the page to finish sooner.
- Put the copy in one `COPY` object at the top of `stage/index.html`, so it is easy to edit and
  easy to find. Every `copy.lines` entry appears verbatim there, and the page must show each one:
  the QA replay quotes any line it cannot find on screen (exit 17).

The scaffold writes the page; its shape, with placeholders only:

```html
<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="/lit/fonts.css">
<link rel="stylesheet" href="/lit/style.css">
<script src="/lit/style.js"></script>
<script src="/lit/stage-kit.js"></script>
<body>
  <section class="shot" data-shot="0">
    <svg class="subject" data-zone="subject"></svg>
    <div class="type" data-zone="type"><p class="lit-headline lit-ink" data-copy="0"></p></div>
  </section>
  <script>
    const COPY = ["<one copy line>"];
    const { define, shot, place, tokens, text } = LitStage;
    // place each shot's zones from LitTimeline, set the COPY lines, then:
    const DRAW = [(s, svg, t) => { /* the subject of shot 1, from s.p, s.local, s.enter() */ }];
    define({ width: <width>, height: <height>, fps: 60, duration: <seconds>, render(t) {
      const s = shot(t);
      DRAW[s.index](s, document.querySelectorAll(".subject")[s.index], t);
    } });
  </script>
</body>
```

## Kit

Every primitive is a pure function of its inputs. `LitStage` holds them all.

- Eases: `ease.outCubic(p)`, `ease.inOutSine(p)`, `ease.outBack(p)`, `ease.standard(p)`,
  `ease.emphasized(p)`, `ease.decelerate(p)`, `ease.accelerate(p)`; each maps 0..1 to 0..1 with
  exact ends.
- `cubicBezier(x1, y1, x2, y2)` returns an ease: `const e = cubicBezier(0.2, 0, 0, 1); e(0.5)`.
- `spring({ stiffness, damping, mass, velocity })` returns an analytic position from 0 to 1:
  `const s = spring({ damping: 14 }); el.style.scale = s(t - <start>);`.
  `spring.settle({ damping: 14 })` returns the seconds it needs to settle within 0.1 %.
- `kf(t, keys)`: `kf(t, [{ t: 0, v: 0, ease: "outCubic" }, { t: 1.2, v: 240 }])`. Values may be
  numbers, number arrays or colours (`"#rrggbb"`, `"rgb(...)"`); `ease` on a key shapes the segment
  that starts there; outside the keys the ends hold.
- `stagger(i, each, { from, count })`: `const d = stagger(i, 0.06, { from: "center", count: n });`.
- `at(t, start, dur, ease)` returns eased local progress, clamped to 0..1.
- `seq([name, dur, offset?], ...)`: `const tl = seq(["in", 0.6], ["hold", 1.8], ["out", 0.5, -0.2]);`
  then `tl.p("in", t)`, `tl.local("hold", t)`, `tl.active("out", t)`, `tl.seg.out.start`,
  `tl.duration`. A negative offset overlaps the previous step.
- `rand(seed)` returns a seeded generator: `const r = rand(<seed>); r();`. Also
  `rand.int(<seed>)(1, 6)` and `rand.range(<seed>)(-8, 8)`.
- `splitText(el, { by })` with `by` = `grapheme`, `word`, `eojeol` or `line` replaces the element's
  text with `<span data-lit-part>` units and returns them:
  `splitText(el, { by: "eojeol" }).forEach((s, i) => { s.style.opacity = at(t, i * 0.08, 0.4); });`.
  Units are inline-block so transforms apply. Given a string it returns the pieces. It never splits
  a Hangul syllable, and `eojeol` keeps each space-separated word whole.
- `drawPath(pathEl, p)` draws an SVG stroke from 0 to 1: `drawPath(stroke, at(t, 1, 1.4, ease.inOutSine));`.
- `morph(fromD, toD, { samples })` returns `p => d` for two single-subpath shapes:
  `const m = morph(shapeA, shapeB); pathEl.setAttribute("d", m(at(t, 2, 0.8)));`.
- `clipRect(el, p, { from })` reveals from `left`, `right`, `top`, `bottom` or `center`;
  `wipe(el, p, { from })` is the same reveal.
- `clipCircle(el, p, { x, y })` opens an iris from `x`% `y`%.
- `maskLinear(el, p, { angle, feather })` makes a soft-edged reveal along an angle.
- `mix(a, b, t, { space })` blends two colours in oklab (default) or sRGB:
  `el.style.background = mix(<colour a>, <colour b>, p);`. `rgba(colour, alpha)` sets alpha.
- `clamp`, `lerp`, `invLerp`, `remap(x, a, b, c, d)` and `smoothstep(a, b, x)` for arithmetic.
- `text(el, { decor })` marks a text run; `text({ content, x, y, w, h })` registers canvas text
  (see Text).
- The style and the timeline (`studio.md`): `shot(t)` (the shot at `t`, with `p`, `local`,
  `enter(delay, dur)`, `exit(dur)`), `zone(layout, part)` and `place(el, layout, part)` (a layout zone in
  pixels), `tokens()` (the style's eases, durations, staggers and springs per object class).

## Fonts

`/lit/fonts.css` declares only the product's verified faces, each with `font-display: block`, so
no frame is captured with a fallback face. Use these family names exactly:

| Family | Weights and widths | Scripts and role |
| --- | --- | --- |
| `"Pretendard"` | 400, 700 | Hangul and Latin; body and display |
| `"Archivo"` | 400, 700, 900 at `font-stretch` 75 %, 100 %, 125 % | Latin display |
| `"VT323"` | 400 | Latin terminal voice |
| `"Silkscreen"` | 400, 700 | Latin pixel voice |
| `"Galmuri9"` | 400 | Hangul and Latin pixel voice |
| `"MesloLGS NF"` | 400 | Latin monospace |
| `"JetBrains Mono"` | 100–800 (variable `wght`) | Latin monospace with a fixed advance; weight motion never reflows |

Any other family falls back to a system face. The QA replay reports that, and fails it for copy
text. Set Korean copy in Pretendard. Never ask for a weight the family does not have (the browser
would synthesize a fake bold), and never animate tracking or width on Hangul.

## Clock

The renderer owns time. It steps a virtual clock frame by frame from 0 and captures the frames in
order. `Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`,
`requestIdleCallback`, `document.timeline.currentTime`, CSS animations and transitions, the Web
Animations API (its `finished` promises included), SVG SMIL and `Math.random` (seeded from the
treatment) all follow that clock. So CSS keyframes, WAAPI chains and timers are safe to use.

Anything outside the clock is not. Never let `performance.timeOrigin`, `crypto.getRandomValues` or
any other real clock or entropy reach a visible value: a second capture in a fresh browser compares
sampled frames pixel by pixel, and a difference stops the run (exit 18) naming the frame and the
region. For variation, use `LitStage.rand(<seed>)`.

## Forbidden

- Elements `<video>`, `<audio>`, `<iframe>`, `<object>`, `<embed>` and `<frame>`; the APIs
  `new Audio()`, `AudioContext` and `OfflineAudioContext`; `Worker`, `SharedWorker` and service
  workers. Each stops the run with exit 17, naming the element or API. Sound comes from the
  treatment's `sound` plan, never from the page.
- Network of any kind: `WebSocket`, `WebTransport`, `RTCPeerConnection`, any absolute `http(s)://`
  or protocol-relative (`//…`) URL, and preconnect or prefetch links. Each is exit 19. Everything
  the page uses is local.
- Third-party libraries: never install, download or copy one into the stage directory. Use the kit
  and your own code. The one exception is the pinned three.js build the renderer itself serves at
  `/lit/three/` for a `depth: 3d` film (`depth.md`); import it through the import map, never from a
  CDN.
- Rasters: at most 24 raster images and 8 MB in total. Ten or more rasters of the same size (a
  flipbook), or any animated GIF, APNG or WebP, is exit 17. Rasters are textures and stills, never a
  frame sequence.
- Hand-encoded films are not the deliverable: no frame loop encoded by hand, no screen recording,
  no raster flipbook. Every frame passes through the renderer.

## Text

The QA replay reads DOM text in a separate browser and never touches the master capture.

- Mark each copy element with `LitStage.text(el)`, or let its nearest block element carry the run.
  A run is the text of that element, however it is split into spans.
- Illustrative text inside a drawn subject is decor: `text(el, { decor: true })`. Decor is exempt
  from title-safe and the reading floor, its contrast is a warning only, it may never carry a copy
  line, and it may cover at most 25 % of the visible text area in any sample.
- Canvas and WebGL text is invisible to the QA unless you register it every frame with
  `LitStage.text({ content, x, y, w, h })`. Unregistered canvas text is reported as not measured.
- Copy stays inside the central 90 % of the frame, reaches 4.5:1 contrast (3:1 when its font size
  is at least 3 % of the frame's short side), and stays readable for at least its reading floor.
- Copy stays on the style and in its shot's type zone, and no two text runs overlap: `TEXT-ON-STYLE`,
  `TEXT-ZONE` and `TEXT-OVERLAP` (`studio.md`, Style rules in the gate). An empty frame of any colour
  for more than 1 s fails `FLAT-FRAME`.
- Never put the request, the idea, a file name or an internal term on screen as a label.

## Unsupported

- Morphs between shapes with more than one subpath: `morph` throws
  `morph: multi-subpath paths are unsupported`. Morph each subpath separately, or cross-fade.
- Anything that reads the real clock or unseeded entropy for a visible value.
- Video and audio elements, and any page-side sound.
- No tested effect is non-deterministic on the stage renderer: CSS `filter: blur()`,
  `backdrop-filter`, `mix-blend-mode`, `box-shadow`, SVG `feGaussianBlur` and SMIL, Canvas2D
  `shadowBlur` and a WebGL shader all match a fresh replay pixel for pixel. The renderer rasterizes
  every tile in full on the CPU (SwiftShader, no partial raster). An element whose opacity and
  transform change together can still rasterize one level apart depending on which earlier frames
  were painted and captured, so the determinism replay paints and captures every frame exactly as
  the master does; stills-only frames may differ from the master by that one level. For WebGL, create the context with
  `preserveDrawingBuffer: true`.
- That is the software rung. A `depth: 3d` treatment renders on the GPU rung instead (ANGLE on Metal
  on macOS) and is held to the same determinism replay; when the GPU rung cannot start or has no
  WebGL, the render falls back to the software rung and the report and manifest say so (`depth.md`).

## Commands

`SKILL_ROOT` is the skill's directory; run the installed commands by absolute path.

```bash
node "$SKILL_ROOT/scripts/motion.mjs" stage --out <dir> --round <N> --stills-only
node "$SKILL_ROOT/scripts/motion.mjs" stage --out <dir> --round <N>
```

The first is the board round: every beat midpoint, a −6 / 0 / +6 frame transition strip per cut, a
12-frame contact sheet, the storyboard `stills/board.png`, and the board check (the text QA replay with
the style rules) in `stills/check.json`; exit 13 `BOARD_CHECK_FAIL` names each failed rule. Nothing is
encoded. The second is the full render: the master, the preview, the poster, the reduced-motion still,
the determinism re-check, the text QA replay, the sound mux, the gate and the board again. Give the full render call a timeout of at least 600 s, and
never shorten the film to save render time.

| Exit | Meaning |
| --- | --- |
| 10 | No Chrome |
| 11 | The page asked for WebGL and none is available on any rung |
| 12 | No ffmpeg; the stills and the sheet are still written |
| 13 | Gate FAIL, or the board check failed on a stills-only render |
| 14 | Runtime not pre-warmed |
| 15 | A font is missing or its hash differs |
| 16 | Treatment invalid (names the field) |
| 17 | Stage contract error |
| 18 | Nondeterministic frame |
| 19 | Network request |
| 20 | Sound invalid |

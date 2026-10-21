# The type engine's contract

The type engine draws any frame of a film from its frame time and a handful of fixed run parameters:
seed, samples, shutter, scale and preset. Nothing else is allowed to change a pixel. A scene may not read
a clock, draw unseeded random numbers, open the network or read a file while rendering. That rule is what
makes the still you opened in round 1 the same frame the film contains, and it is what the determinism
gate hashes. Read this page when you write or debug a scene; a film that only uses the six shipped scenes
never needs it.

## From brief to bytes

1. **Plan, in Node.** `engine/node/brief.mjs` turns the brief into shots, and `engine/core/timeline.mjs`
   places them on the beat grid as the canonical timeline.
2. **Page, in headless Chrome.** Chrome is driven over the DevTools pipe (`--remote-debugging-pipe`), so
   no control port listens. The page files in `engine/web/` are served from disk through Fetch
   interception, and the page receives the plan and the font bytes (bundled, the reused lit-pptx files,
   or the pre-warmed cache).
3. **Frame n.** For each of `samples` sub-frames, at
   `t = max(0, n/fps + (shutter/fps)·((i + 0.5)/samples − 0.5))`, the shot active at that time is
   composited in linear HDR: the background pass, grid rules or window chrome, the scene's marks, the glyph
   layer, then the filter passes in preset order. The sub-frames are averaged, and the post chain runs once
   with the overrides of the middle sub-frame and grain keyed to the frame's own time. The master uses 4
   samples at shutter 0.5; previews and stills use one.
4. **Egress.** The final RGBA8 frame, rows top to bottom with the glyph-coverage mask in alpha, is read
   back through a fenced pixel-pack buffer and sent over a WebSocket on 127.0.0.1 with an ephemeral port.
   When the sandbox refuses `listen`, the same buffer is pulled over CDP instead, and the report names
   that egress. A refused listen is never a blocked state.
5. **Back in Node.** Each frame's ink is counted from the mask, alpha is forced to 255, the bytes are
   hashed (`rgbaSha256`), fed to the flash audit, logged and piped to ffmpeg. The hashed, audited and
   encoded bytes are one and the same buffer.

## Scene interface (`engine/web/scene.mjs`)

A scene object is built once per shot. Its context holds the shot, preset, palette, voices, grid, the
terminal window when there is one, fps, frame count, seed, the stroke fonts and the accent window. The
base class supplies `fit`, `wrap`, `fitBlock` and `snapSize`, which already obey the eojeol and Galmuri
rules.

| Member | Contract |
| --- | --- |
| `render(f, stage)` | Draws frame `f` and returns the post overrides for it. Pure in `f` and the scene's state |
| `stateful`, `prerollMax` | Set when the scene carries state between frames; that state may remember at most `prerollMax` seconds |
| `advance(f)` | The only place state may change. Called for every sub-frame, preroll replays included |
| `reset()` | Restores the starting state, on entering the shot and after a seek |

`f` carries `t`, `lt` (seconds since the shot began), `p` (progress 0..1), `start` and `end`. Anchor every
beat inside a scene to `lt`, `p` or the shot's reveal steps, never to a literal frame number, so the scene
holds at any fps.

`stage` offers `type` (the type kit), `glyphs` (the glyph layer whose alpha becomes the mask), `lines`
(instanced hairlines), `mark(rect, hex, id, kind)` for a filled non-glyph mark that the action-safe and
colour checks see, and `record`, the frame's element and fill log.

After a seek into a stateful shot the engine calls `reset()` and replays `advance` over every frame inside
`prerollMax`, with the same sub-frame pattern, so a seeked still equals the frame of the sequential render
byte for byte (MO-A-25).

## Shipped scenes and passes

Scenes live in `engine/web/scenes/`: `title-slam.mjs`, `karaoke-line.mjs`, `kinetic-list.mjs`,
`number-counter.mjs`, `signature.mjs` and `end-card.mjs`. Passes live in `engine/web/passes/`.

| Pass | Kind | Seeded by | Hard limits |
| --- | --- | --- | --- |
| `swiss-grid` | layout, hairline rules | no seed | guides never on in an export |
| `dither` | filter | blue-noise mode only | seed fixed for the whole shot |
| `tidal-gradient` | background | noise origin per shot | ≤ 2 surges per second, attack and decay ≥ 0.1 s |
| `crt` | filter | static triad grain | flicker ≤ 0.06 peak to peak; persistence only in stateful shots |
| `glitch` | filter | hit schedule per shot | ≤ 2.0 hits per second, a band ≤ 20 % of the frame, one displace and one restore |
| `terminal-ui` | background, Canvas2D chrome | the cosmetic readout digit | ≤ 2 layers per scene |

Every pass seed is `fnv1a32("<runSeed>:<sceneId>:<shotIndex>:<pass>")` as an unsigned integer. A shot may
hold at most two events in any one second across every source (glitch hits, surges, flash rises, invert
changes, boot flickers), and that schedule is fixed before the first frame. Each draw passes through one
uniform-setting wrapper that logs `{frame, pass, draws, uniforms}` to `render.jsonl`; a frame counts as
covered by the look library only when some pass actually drew.

## The post chain

The order is fixed: bloom with halation, chromatic aberration, tone shoulder, grain, vignette, fade,
flash, shake and zoom, invert. All of it runs in linear light, and the sRGB transfer happens once at the
end. A scene may override any field for its frame (MO-A-58); it can never reorder the chain.

| Field | Range | Neutral |
| --- | --- | --- |
| `exposure` | > 0 | 1 |
| `bloom`, `halation`, `grain`, `vignette` | 0–1 | 0 |
| `bloomThreshold` | 0–1 | 0.85 |
| `bloomKnee`, `bloomRadius` | 0–1 | 0 |
| `ca` | ≥ 0 px at 1080p | 0 |
| `fade` | 0–1, as opacity | 1 |
| `flash` | 0–1; each rise past 0.1 is one event | 0 |
| `shake` | [x, y] in px | [0, 0] |
| `zoom` | > 0 | 1 |
| `invert` | boolean, only on a cut and held at least two beats | false |

## Chrome rungs and software GL

Chrome is tried on a ladder, and a rung counts only when the page really gets a WebGL2 context: on macOS
`--use-angle=metal --enable-gpu-rasterization --ignore-gpu-blocklist`, on Linux `--use-angle=gl` with the
same two flags, on Windows `--use-angle=d3d11 --enable-gpu-rasterization`, and last the software rung
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Every rung adds the three anti-throttling flags and
`--use-mock-keychain --password-store=basic`, so a fresh profile never asks the macOS keychain for
anything. The winning rung is recorded as `chromeFlags`, and the profile lives in the run's own
`.run/chrome/` folder, removed when the render ends.

When the renderer string contains swiftshader, llvmpipe, softpipe, lavapipe, apple software renderer or
microsoft basic render driver, the engine drops samples to 1, cuts the tidal octaves to
max(3, floor(octaves / 2)), turns crt persistence off, marks those passes `downgraded: true`, and the
report says the film was software-rendered.

## Logs and manifest

`manifest.json` carries schemaVersion, engineCredit, presetId, seed, fps, resolution, scale, samples,
shutter, renderer, softwareRenderer, chromeFlags, previewEncoder, audioTier, bpm or beatGrid, durationSec,
generatedAt, passRanges, timeline and warnings, plus `frameCount`, `round` and any poster or still
override. `render.jsonl` holds one line per pass per frame and one frame line (`pass: null`) with
`rgbaSha256`, `textBoxes`, ink pixels, elements, fills, post values and that frame's flash transitions.

A `textBoxes` entry is `{elementId, text, voice, fontFile, fontSizePx, capHeightPx, weight, fill, bbox}`
plus `script`, `trackingEm` and `widthPct`, and for blocks of several lines `lineCount`, `lineHeight`,
`cjk`, `paragraph` and `measureCh`. The box comes from the real glyph outlines under the scene's transform,
in logical 1920x1080 pixels, which is what the safe-area, contrast and typography rules in
`references/craft-loop.md` read.

# Runtime, pre-warm and BLOCKED states

## What is installed where

| Piece | Where | Installed by |
| --- | --- | --- |
| Engine code, GLSL passes, scenes, bundled fonts | this skill directory (the plugin) | the LitGravity package |
| opentype.js 2.0.0 (pinned in `engine/package-lock.json`) | `<cache>/node-<lockdigest>-<platform>-<arch>/` | `litgravity motion-runtime install` (`npm ci --omit=dev --ignore-scripts`) |
| Galmuri9, MesloLGS NF and their licence files | `<cache>/fonts/` (pinned URL, sha256-verified) | same command |
| Pretendard Regular / Bold | `../lit-pptx/fonts/pretendard/` (reused by path, hash-checked) | the package |
| librosa venv (Tier 2, optional) | `<cache>/audio-<digest>/` from `engine/audio/requirements.lock` with `pip install --require-hashes --only-binary=:all:` | `litgravity motion-runtime install --audio` |
| Word-timing models (Tier 3, optional) | not in this release | `--word-timing` prints the size and pins, then stops |
| Chrome, ffmpeg, img2webp and dwebp (libwebp), gifski (optional cover fallback) | host tools, never bundled | the user |

`<cache>` is `$LITGRAVITY_MOTION_RUNTIME`, otherwise `${XDG_CACHE_HOME:-~/.cache}/litgravity/motion-runtime`.

## Pre-warm, never first use

The cache is written only by `litgravity motion-runtime install`; `litgravity install` (and the
global npm postinstall, which runs it) attempts the same pre-warm and prints one receipt line if it
fails, without failing the install. A agy plugin install runs no lifecycle step, so
there the explicit command is the pre-warm. A render session only reads the cache: it never runs
npm, pip or a download, because a sandboxed session usually has no network or no write access
outside the workspace, and a half-finished install would look like a broken engine.

`litgravity doctor` (and `npm run doctor` in a checkout) prints the seven probes: Chrome,
ffmpeg with the preview encoder rung, the WebGL2 renderer from a real headless probe, the software-GL
or unknown-renderer warning, the pre-warm state naming anything missing and the fix command,
the cover encoder (img2webp and dwebp, or the gifski fallback) that cover mode needs, and the
house styles (each one valid, the default named).
`litgravity motion-runtime status` prints the pre-warm state alone.

## Exit codes

| Exit | Name | Meaning | Fix |
| --- | --- | --- | --- |
| 0 | OK | the mode finished; for `make`, the gate passed | — |
| 10 | BLOCKED_NO_CHROME | Chrome is missing or cannot launch headless; the message carries the launcher's first error line | install Chrome or set `CHROME_PATH` |
| 11 | BLOCKED_NO_WEBGL2 | Chrome runs but no flag rung gives a WebGL2 context, not even SwiftShader | GPU drivers; nothing can render without WebGL2 |
| 12 | BLOCKED_NO_FFMPEG_FOR_VIDEO | ffmpeg missing; stills and sheet were still written | install ffmpeg |
| 13 | GATE_FAIL_QA | the gate (or the pre-flight gate) failed; see `gate-report.txt` | fix the named rule; next round |
| 14 | BLOCKED_DEPS_NOT_PREWARMED | engine dependencies (or Tier-3 models) missing from the cache | `litgravity motion-runtime install` outside the session |
| 15 | BLOCKED_FONT_FETCH | a required font is missing or its sha256 differs | same command |

Each state names its real cause. A sandbox that refuses `listen` is not a blocked state: frames are
pulled over CDP from the same readback buffer, and the report names that egress.

## Chrome flags (MO-A-51)

Tried in order, each counting only if a page gets WebGL2: macOS `--use-angle=metal
--enable-gpu-rasterization --ignore-gpu-blocklist`; Linux `--use-angle=gl --enable-gpu-rasterization
--ignore-gpu-blocklist`; Windows `--use-angle=d3d11 --enable-gpu-rasterization`; then the software rung
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Every rung adds the three anti-throttling
flags. The rung that worked is recorded as `chromeFlags`. The Chrome profile lives in the run's own
`.run/chrome/` directory and is removed when the render ends. Every launch also passes
`--use-mock-keychain` and `--password-store=basic`, so Chrome never asks the OS keychain for its
safe-storage item (on macOS a fresh profile would otherwise raise a keychain dialog).

## Audio tiers

- **Tier 1 (default):** text reading time on a 100 BPM grid (or the brief's `bpm`).
- **Tier 2:** an audio file in the brief and a ready venv: librosa beat grid, cuts on detected
  beats, audio muxed into the MP4. A missing venv, a venv whose pins changed, or a failed analysis
  falls back to Tier 1 with the warning "audio analysis not prewarmed: run litgravity
  motion-runtime install --audio" (or the analysis error). It is never repaired in the session.
- **Tier 3:** `--word-timing` only; exits 14 in this release. Never MMS_FA or madmom weights,
  never aubio or essentia, at any tier.

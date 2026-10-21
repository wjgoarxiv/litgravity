# The motion runtime in LitGravity

Rendering needs a few things the plugin cannot ship: one pinned npm package, two fonts whose licences
call for a fetched original, optional Python audio analysis, and host programs such as Chrome. LitGravity
keeps the first three in its own cache and never installs any of them while a film is being made. A
headless `agy -p` run refuses the shell command an install needs, and a half-finished install in the middle
of a render would look like a broken engine. The cache is filled once, by the pre-warm command below, and
every render after that only reads it.

## What lives where

| Piece | Location | Put there by |
| --- | --- | --- |
| Engine code, scenes, GLSL passes, bundled fonts, recipes | the skill folder inside the installed plugin | the LitGravity package |
| opentype.js 2.0.0, pinned by `engine/package-lock.json` | `<cache>/node-<lockdigest>-<platform>-<arch>/` | the pre-warm, via `npm ci --omit=dev --ignore-scripts` |
| Galmuri9 and MesloLGS NF with their licence files | `<cache>/fonts/`, fetched from pinned URLs and checked by sha256 | the pre-warm |
| Pretendard Regular and Bold | the lit-pptx skill's `fonts/pretendard/` folder, reused by path and hash-checked | the LitGravity package |
| librosa venv (Tier 2, optional) | `<cache>/audio-<digest>/`, built from `engine/audio/requirements.lock` with `pip install --require-hashes --only-binary=:all:` | `node "$SKILL_ROOT/scripts/motion-runtime.mjs" install --audio` |
| Word-timing models (Tier 3) | not shipped; `engine/models/word-timing.json` only pins them | `install --word-timing` prints sizes and pins, then stops |
| Chrome, ffmpeg, img2webp and dwebp, gifski as the cover fallback | host programs | the user |

`<cache>` is `$LITGRAVITY_MOTION_RUNTIME` when set (tests and isolated probes use it), otherwise
`${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/motion`. The cache key for the npm part is a digest of
the lockfile, so a new LitGravity release with a new pin lands in a fresh folder.

## The font manifest

`fonts/manifest.json` lists every font key with one of three sources, and the status check reads the same
list:

- **bundled**: shipped inside the skill (the Archivo width and weight instances, VT323, Silkscreen,
  JetBrains Mono for cover recipes, and the five EMS single-stroke SVG fonts). Hash and licence are
  checked in place.
- **reuse**: the Pretendard pair from lit-pptx, verified against the hash recorded in the manifest. Should
  that file ever be missing, the manifest names a pinned fallback download that the pre-warm fetches into
  the cache.
- **fetch**: Galmuri9 and MesloLGS NF, downloaded only by the pre-warm from a pinned URL, with their
  licence files, each checked by sha256.

## Pre-warming

Run this once, from a terminal or as a `run_command` the user allows in an interactive agy session:

```bash
npx @litfamily/litgravity runtime install motion
npx @litfamily/litgravity runtime status motion
```

Both call `scripts/motion-runtime.mjs` (`install --json` / `status --json`) and read
`{name, ready, cache, missing}`. The install takes an mkdir lock in the cache (a stale lock older than 20
minutes is cleared), installs the npm package, fetches the missing fonts and verifies every hash. The same
script runs by hand as `node "$SKILL_ROOT/scripts/motion-runtime.mjs" status` for a readable report, and
`install --audio` adds the optional venv. On an air-gapped machine `LITGRAVITY_MOTION_MIRROR` points at a
mirror that serves every pinned file under its sha256 (and the npm tarball under its file name);
`LITGRAVITY_MOTION_PYTHON` picks the interpreter for the audio venv.

## Checking readiness

`node "$SKILL_ROOT/scripts/motion-doctor.mjs"` (add `--json` for data) runs six read-only probes and prints
one line each:

| Line | What it reports |
| --- | --- |
| `MOTION_CHROME` | the Chrome binary and version, or not found (set `CHROME_PATH`) |
| `MOTION_FFMPEG` | ffmpeg and the preview encoder rung it supports; without it stills and sheets still work |
| `MOTION_WEBGL2` | the renderer string from a real headless probe and the flags that got it |
| `MOTION_SOFTWARE_GL` | whether that renderer is software GL (slower, samples lowered) or unknown |
| `MOTION_PREWARM` | ready, or the missing pieces and the pre-warm command |
| `MOTION_COVER` | img2webp and dwebp for cover loops, the gifski fallback, or BLOCKED_NO_COVER_ENCODER |

The probe's Chrome profile is a fresh temporary folder removed afterwards. `npx @litfamily/litgravity doctor`
shows the same picture at plugin level: rows for Chrome, ffmpeg and libwebp, and an engine row for
`motion` with the command that fixes it.

## Exit codes on this path

| Exit | Name | Meaning | Fix |
| --- | --- | --- | --- |
| 0 | OK | the mode finished; for `make`, the gate passed | none |
| 10 | BLOCKED_NO_CHROME | Chrome is missing or will not start headless; the message carries the launcher's first error line | install Chrome or Chromium, or set `CHROME_PATH` |
| 11 | BLOCKED_NO_WEBGL2 | Chrome starts but no rung yields WebGL2, the software rung included | graphics drivers; nothing renders without WebGL2 |
| 12 | BLOCKED_NO_FFMPEG_FOR_VIDEO | ffmpeg is missing; stills and the sheet were written anyway | install ffmpeg |
| 13 | GATE_FAIL_QA | the gate or the pre-flight failed; see `gate-report.txt` | fix the named rule in the next round |
| 14 | BLOCKED_DEPS_NOT_PREWARMED | the pinned npm package (or the Tier-3 runtime) is not in the cache | `npx @litfamily/litgravity runtime install motion`, from a terminal |
| 15 | BLOCKED_FONT_FETCH | a required font is missing from the cache or its sha256 differs | the same command |

Every blocked state names its real cause. The model repairs one only with the pre-warm command above, the one
install step this skill owns, and never with an npm, pip or download command of its own. When `run_command`
is refused (every headless run), it stops with BLOCKED, names the state, and gives the user the command to run
in a terminal.

## Audio tiers

- **Tier 1, the default.** Cuts follow reading time on a 100 BPM grid, or the brief's `bpm`.
- **Tier 2.** The brief names an audio file and the venv is ready: librosa finds the beat grid, cuts land
  on detected beats, and the track is muxed. A missing venv, a venv whose pins changed, or an analysis that
  fails falls back to Tier 1 with the warning `audio analysis not prewarmed`, followed by the
  `install --audio` command. Only that command repairs it.
- **Tier 3.** `--word-timing` only, and it exits 14 because the aligner runtime is not shipped. MMS_FA and
  madmom weights, aubio and essentia are excluded at every tier.

# Studio: house styles, shots, the board and the house file

Read this for every film, after `treatment.md`. It is what makes two films of one request look like
the same studio made them, and what lets the user see the film before the full render. Covers keep
their own recipes (`cover.md`); everything here is for films on the stage and type paths.

The rule behind every part below: a decision the model used to make again on each run is now data
the page is built from, or a check the renderer runs. Prose that only asks for consistency does not
produce it; data and checks do.

## The flow

1. **Style.** The treatment names one house style. The validator accepts only the style the rules
   choose (below), so the same request always gets the same style.
2. **Shots.** Each beat of the treatment is a shot with a `layout`, a `hero` move and a `transition`.
   The layouts are one grid shared by every style; the style maps them to pixels per format.
3. **Scaffold** (stage path). `motion.mjs scaffold --out <dir>` writes `stage/index.html` from the
   treatment. Draw the subject of each shot in its `DRAW` function; keep the rest of the structure.
4. **Board round** (round 1). `stage --round 1 --stills-only` (or `make ... --stills-only` on the type
   path) writes the stills and `stills/board.png`, the storyboard. On the stage path it also runs the
   board check, the text and style rules of the gate on the board frames, and exits 13 naming each
   failed rule before any film is encoded.
5. **Film.** The full render, with the style rules in its gate.
6. **House.** A passed film records its style in `motion-house.json` beside the output folder; the next
   film in that folder takes the same style unless the user names another.

## Register: rich is the default

Every film is maximal unless the request asks otherwise. `register` is `rich` by default and
`minimal` only when the request asks for a calm, quiet, simple or minimal film (미니멀, 잔잔, 차분, 조용,
심플, 절제, minimal, calm, quiet, simple, understated, sparse, serene). The validator refuses
`minimal` without that ask and `rich` with it.

A rich film fills its frame the way the reference studios do:

- **A layered world** (`world.layers`, at least 3, back to front): what lives in the far ground, the
  middle and the near ground of the film's place. Every shot shows at least two of them at once.
- **Labelled parts** (`world.labels`, at least 6, at most 4 words each): the names a viewer reads on
  the drawn parts, readouts, tabs and tags. A named product uses its real names. The text QA's
  `TEXT-LABELS` rule fails when fewer than 75 % of them reach the screen, or when half the beat
  midpoints show fewer than 3 readable text runs.
- **A filled frame.** At each beat midpoint the text QA cuts the frame into 4 x 3 regions; `RICH-FILL`
  fails when more than one shot leaves over 2 of the 12 empty (the end card may breathe). A 3D hero on a
  dark floor does not fill a frame by itself: put the world's parts around it as panels in the DOM
  (live counters, a log that scrolls, stage pills, a progress readout, the product's own screens at a
  size that reads), the way a dense dashboard frame does.
- **A moving camera** (`world.camera`, `[{beat, move}]`, in at least half the shots): push-in, truck,
  crane, orbit, rack focus, parallax. A locked shot is not listed.
- **Accents by role.** Besides its core palette each style has at least three accent colours, each
  for one role (a state, a category, a path); a rich `palette` may add them, at most 14 entries.
- **Decor text** (readouts, coordinates, part numbers) may fill up to 60 % of the text area.
- **An authored score**: `sound.mode: score`, layered stems arranged on the film's beats (`sound.md`).
- **Full 3D where the subject allows**: `depth: 3d`, and `render3d: blender` for path-traced light
  when Blender is installed and the request asks for high-quality, cinematic or photoreal 3D
  (`depth.md`); `scaffold` prints `BLENDER:` when both hold.

A minimal film keeps the restraint of a single hero on an open ground: the core palette only, decor
under 25 %, no world plan, and the style's preset beds (`sound.mode: generated`).

The flash audit (MO-C-03) is the same in both registers. Density is met with slower light changes,
lower-contrast detail behind a move, motion blur and cuts, never by locking the camera.

## House styles

A style is a file in `styles/<id>.json`: palette roles, faces per type role, a type scale per format,
leading, motion tokens (eases, durations, staggers, a spring per object class, secondary and ambient
travel, the hold push), the transitions it hands off with, its ground, its sound beds (a default and
two alternatives, `sound.md`) and the defaults it never uses. Four ship:

| Style | Look | Type | Hand-offs | Default bed |
|---|---|---|---|---|
| `swiss-signal` (default) | Ink ground, bone type, one teal signal, one amber moment | Archivo display and headline, Pretendard body, MesloLGS NF labels | cut, wipe, match, push | glass, A minor, 104 BPM |
| `tidal` | Indigo ground with a slow teal-to-violet flow, off-white type, one coral moment | Archivo 700, Pretendard body | dissolve, match, wipe | felt-strings, D major, 84 BPM |
| `terminalcore` | Navy terminal, phosphor type at typing speed, one signal hue, no easing | VT323 with Galmuri9 for Hangul, sizes on its 9 px grid | cut, wipe | pulse-synth, E minor, 120 BPM |
| `paper` | Warm paper ground, near-black ink, terracotta signal, one blue moment, soft springs | Pretendard throughout, MesloLGS NF labels | cut, match, wipe, iris, push | soft-keys, F major, 96 BPM |

`swiss-signal`, `tidal` and `terminalcore` are the type engine's presets too, so a style means the same
palette on both paths. `paper` is stage-only.

Type sizes per role (px):

| Style | 16:9 display / headline / body / label | 9:16 display / headline / body / label |
|---|---|---|
| swiss-signal | 128 / 76 / 40 / 26 | 120 / 80 / 46 / 32 |
| tidal | 116 / 72 / 40 / 26 | 112 / 76 / 46 / 32 |
| terminalcore | 126 / 81 / 45 / 36 | 117 / 81 / 54 / 36 |
| paper | 112 / 68 / 40 / 26 | 108 / 74 / 46 / 32 |

`motion.mjs styles --out <dir> [--format 16:9|9:16]` renders the same demo film in every style and
writes `<dir>/styles.png`, the four boards side by side. Show it when the user wants to choose a style,
or asks what the films will look like.

## Choosing the style

In this order, first match wins; the validator refuses anything else and says which rule chose:

1. The request names a style: its id (`swiss-signal`, `tidal`, `terminalcore`) or `paper style`
   (`페이퍼`, `타이달`, `터미널코어`, `스위스 시그널` too).
2. The project's house style (`motion-house.json` beside the output folder).
3. A keyword in the request or the copy: terminal words (터미널, CRT, 해커, terminal, hacker) take
   `terminalcore`; calm or wave words (물결, 파도, 잔잔한, 흐름, gradient, wave, tide, calm) take `tidal`;
   warm or paper words (따뜻한, 밝은, 종이, 손그림, 포근한, 아기자기, warm, cozy, bright, paper, handmade,
   hand-drawn) take `paper` on the stage path.
4. The genre: an `explainer` takes `paper` (a warm, legible ground for diagrams and steps; on the type
   path, where `paper` has no preset, the rule is skipped) and a `brand-mood` film takes `tidal`.
5. Otherwise `swiss-signal`.

The style fixes more than colour. On the stage path the treatment's `palette` may only list the style's
colours (a rich film adds its role accents), `typePlan.faces` only its faces, and a minimal film's
generated bed is one of the style's beds exactly. A score takes the style's genre unless `sound.genre`
names another.
On the type path the brief's `style` must equal the treatment's style or be left out.

## Shots and layouts

Each beat carries three shot fields on the stage path:

| Field | Rule |
|---|---|
| `layout` | `title`, `split`, `split-alt`, `stage`, `full` or `hero` |
| `hero` | The one move the eye follows in this shot, as a viewer would describe it |
| `transition` | How the shot hands off: a word from the style's list; the last shot is `end` |
| `lines` | Optional: the indices of the copy lines this shot shows (a `full` shot shows none) |

The layouts, as `[x, y, w, h]` fractions of the frame:

| Layout | 16:9 type zone | 16:9 subject zone | 9:16 type zone | 9:16 subject zone |
|---|---|---|---|---|
| `title` | 0.08, 0.20, 0.84, 0.60 | whole frame (backdrop) | 0.09, 0.26, 0.82, 0.48 | whole frame |
| `split` | 0.08, 0.16, 0.36, 0.68 (left) | 0.48, 0.08, 0.46, 0.84 | 0.09, 0.08, 0.82, 0.26 (top) | 0.06, 0.36, 0.88, 0.56 |
| `split-alt` | 0.56, 0.16, 0.36, 0.68 (right) | 0.06, 0.08, 0.46, 0.84 | 0.09, 0.66, 0.82, 0.26 (bottom) | 0.06, 0.06, 0.88, 0.56 |
| `stage` | 0.08, 0.75, 0.84, 0.18 (caption band) | 0.06, 0.07, 0.88, 0.64 | 0.09, 0.79, 0.82, 0.13 | 0.06, 0.06, 0.88, 0.68 |
| `full` | none: no copy | whole frame | none | whole frame |
| `hero` | 0.08, 0.76, 0.84, 0.17 (low band) | 0.03, 0.03, 0.94, 0.94 | 0.09, 0.80, 0.82, 0.12 | 0.03, 0.03, 0.94, 0.94 |

Choose layouts for the story: `title` for an opening or closing line over a backdrop, `split` and
`split-alt` for a line beside the thing it is about (alternate them so the eye moves), `stage` when the
drawing is the shot and the words are a caption, `full` when the picture must speak alone, `hero` when
the protagonist fills the frame (a close-up, the turn, the product reveal) with one short line under
it. Composition changes with the story: two adjacent shots never share a layout, and a film of four or
more shots uses at least three layouts; the validator refuses a treatment that parks the eye. One hero
move leads each shot and the eye follows it; in a rich film the world around it keeps working:
secondary moves on the labelled parts travel 50-70 % as far and start 0.1-0.2 s later, the layers drift
at their own depths, and ambient motion never stops. A minimal film keeps ambient motion under the
style's ambient travel.

## The page: style.css, style.js and the kit

The renderer serves two files for the film's style and format:

- `/lit/style.css`: custom properties (`--lit-ground`, `--lit-ink`, `--lit-muted`, `--lit-signal`,
  `--lit-accent`, `--lit-line`, `--lit-surface`, the size steps), the body ground, the type-role classes
  `.lit-display`, `.lit-headline`, `.lit-body`, `.lit-label` (face, size, weight, leading) and the colour
  classes `.lit-ink`, `.lit-muted`, `.lit-signal`, `.lit-accent`, `.lit-knockout`.
- `/lit/style.js`: `window.LitStyle` (the tokens, with the layout zones in pixels for this format) and
  `window.LitTimeline` (the treatment's shots: `t0`, `t1`, `layout`, `transition`, plus fps and length).

The kit reads them:

- `LitStage.shot(t)` returns the shot at `t`: `index`, `beat`, `layout`, `transition`, `local` (seconds
  into the shot), `length`, `p` (0..1), `enter(delay, dur)` (0 to 1 on the style's entrance ease) and
  `exit(dur)` (0 to 1 over the shot's last `dur` seconds on its exit ease).
- `LitStage.zone(layout, "type" | "subject")` returns `{ x, y, w, h }` in pixels;
  `LitStage.place(el, layout, part)` positions an element there.
- `LitStage.tokens()` returns the style's eases as functions (`enter`, `move`, `exit`), durations,
  staggers, a spring per object class (`micro`, `panel`, `headline`, `subject`, `camera`, each a
  function of seconds from 0 to 1), `secondary`, `ambient` and `push`.

The page times every shot from `LitTimeline`, so the treatment, the page, the stills, the board, the
sound cues and the gate read one timeline. Set copy with the classes (or the same values): the gate
checks the result, not the class names.

## Scaffold

`motion.mjs scaffold --out <dir>` needs a valid stage treatment and writes `<dir>/stage/index.html`:
the COPY block with every copy line, one `<section>` per shot with its type placed in the shot's type
zone (first line headline, or display in a `title` shot; further lines body in the muted colour), an
empty `<svg>` in the subject zone, entrances on the style's ease, the hand-off of each shot (wipe,
iris, dissolve, push; match, morph and cut switch on the cut, so carry the matching shape yourself),
and one `DRAW` function per shot. Fill the `DRAW` functions: they receive the shot (`s`), the shot's
svg and `t`. Change the structure only for a reason the treatment states. The scaffold never replaces
an existing page.

## The board round

Round 1 is the board round. A stills-only render writes the stills set and `stills/board.png`: one
keyframe per shot with its number, time, layout and hand-off under it and its hero move in words, the
shot's type zone dashed over the frame, and a header with the style, palette and the film's format,
length and bed. On the stage path the same render runs the board check, the gate's text and style
rules on the board frames, writes `stills/check.json` and prints the verdict on the board.

- Exit 0: open the board and every still with Read, record round 1 with its change, and render the
  film.
- Exit 13 `BOARD_CHECK_FAIL`: the message names each failed rule. Fix the page and render the board
  again before the full render; a full render fails the same rules.

The board is a deliverable. The reply names it, so the user can see what was built.

## Style rules in the gate

All FAIL, on the stage path, on the board round and the full render alike:

| Rule | Fails when | Typical fix |
|---|---|---|
| `TEXT-OVERLAP` | Two visible text runs overlap by more than 8 % of the smaller box at a QA sample | Fewer lines per shot, the `split` layout, or let one line leave before the next arrives |
| `TEXT-ON-STYLE` | Settled copy is in a colour outside the style's text roles, a face outside the style, or a size more than 4 % off the type scale | Use the type-role and colour classes |
| `TEXT-ZONE` | Settled copy sits outside its shot's type zone (by more than 1.2 % of the frame), or any copy shows in a `full` shot | Shorter copy, a smaller role, or a layout with a larger type zone |
| `TEXT-OVERLAP` (cut) | Text of the outgoing and the incoming shot overlaps during a hand-off: the QA samples every second frame within 0.4 s of each cut, and the failure is marked `(cut)` | Let the outgoing copy leave before the incoming copy arrives, or move the incoming copy to a different zone |
| `FLAT-FRAME` (full render) | More than 1 s of frames whose 0.5-99.5 % luminance spread is under 0.02: an empty frame of any colour | Draw the shot; never leave a stub `DRAW` empty |
| `DEAD-AIR` (full render) | More than 0.5 s in a row (0.4 s more allowed at the opening, 0.6 s more at the close) where under 2.5 % of the frame carries anything: a 48 px cell counts when its pixels vary (sd over 6) or differ from the ground by more than 16 levels | Keep the protagonist or the next shot's subject on screen through the hand-off; enter the next thing before the last one has gone |
| `ASSET-USED` (named product) | `product.assets` lists real files and the page loads none of them | Show the real logo, screenshot or README image from `stage/assets/` |

Non-copy text off the scale is a WARN; decor text (`text(el, { decor: true })`) is exempt. The cut
samples check overlap only: copy in mid-transition is off its zone and scale by design.

`FLAT-FRAME` catches a blank frame; `DEAD-AIR` catches the frame that is not blank but says nothing,
one thin line or a lone label on an empty ground, held long enough to read as a stall.

## Preview

When the request asks for a preview or a storyboard first (미리보기, 스토리보드, 콘티, preview,
storyboard), set `preview: true` in the treatment. The film is then done at the board: a board round
whose check passed, looked at, with the board in the viewed list. The reply shows the board and says the
film is not rendered yet; when the user says go, set `preview` to false and render the film. Without
those words a bare `lit` still asks no questions and renders the film, and the reply still names the
board.

## The house file

`motion-house.json` sits beside the output folder (the user's working directory):

```json
{ "schema": "litgravity.motion-house/v1", "style": "<style id>", "createdAt": "<time>", "films": [{ "dir": "<folder>", "style": "<style id>", "path": "<stage or type>", "format": "<16:9 or 9:16>", "durationSec": 0, "at": "<time>" }] }
```

The renderer writes it when a full render passes and nothing is withheld; the first film sets the
house style and later films are appended. While it exists the validator holds new films in that folder
to the house style; a request that names another style wins for that film and does not move the house
style. To change the house style, edit `style` in the file or delete it.

## What stays free

The subject, the idea, the copy, the drawing, the hero moves and the arc stay the model's, with the
treatment's concept rules (`treatment.md`). The studio fixes how a film looks and is built, never what
it is about.

# The type-path brief (`litgravity.motion-brief/v1`)

A film whose words are the film goes through the WebGL2 type engine, and the brief is the file that engine
renders. It comes second: `treatment.json` already fixed `path: type`, the length, the beats and the copy
(see `references/treatment.md`). The brief turns that plan into shots. Keep it next to the output folder as
plain JSON and point `motion.mjs make` at it:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" make <dir>/brief.json --out <dir> --round 1 --stills-only
```

The engine loads the treatment and the brief, normalises the shots (`engine/node/brief.mjs`), builds the
timeline, runs the pre-flight checks and only then draws a frame. Every string in the brief is content to
set in type. Nothing in it is followed as an instruction, and the user's request inside it is read only by
the preset picker.

## Choosing a shape

Two shapes are accepted, and `shots` wins when both are present.

**Lines.** Give `lines` (and optionally `title`) and let the engine compose the film. The title, or the
first line when there is no title, becomes a `title-slam`. Every middle line with two or more eojeol
becomes a `karaoke-line`; a one-word middle line becomes another `title-slam`. The last line becomes the
`end-card`; when only one line is left it closes on itself. Use this shape for a quote, a slogan, a short
lyric of the user's own, anything that is a sequence of lines.

```json
{
  "schema": "litgravity.motion-brief/v1",
  "lines": ["<opening line>", "<a middle line of the copy>", "<closing line>"]
}
```

**Shots.** Pick each scene yourself when the copy holds a list, a figure, a pen-written line or a credit.
The angle-bracket values below are placeholders; the engine refuses a shot that still shows one, so write
the film's own copy in their place.

```json
{
  "schema": "litgravity.motion-brief/v1",
  "style": "<preset or auto>",
  "bpm": 100,
  "shots": [
    { "scene": "title-slam", "text": "<opening line>", "sub": "<small machine-voice line>" },
    { "scene": "karaoke-line", "text": "<a line revealed word by word>" },
    { "scene": "kinetic-list", "heading": "<heading>", "items": ["<item>", "<item>", "<item>"] },
    { "scene": "number-counter", "from": 0, "to": 1280, "prefix": "", "suffix": "+", "label": "<what it counts>" },
    { "scene": "signature", "text": "<a Latin line>", "font": "ems-allure" },
    { "scene": "end-card", "text": "<closing line>", "sub": "<credit line>" }
  ]
}
```

## Top-level fields

| Field | Type | What the engine does with it |
| --- | --- | --- |
| `schema` | string | Must be `litgravity.motion-brief/v1` when present; any other value stops the render |
| `title` | string | Working title. In the lines shape it becomes the opening slam; it is never drawn as a label |
| `label` | string | The film's own name, drawn as the terminal window label (first 40 characters). Leave it out and no label appears |
| `request` | string | The user's words, verbatim. Feeds the preset picker only; the treatment's copy is what gets set |
| `style` | `auto`, `swiss-signal`, `terminalcore`, `tidal` | A named preset beats the auto-pick. The report says user-specified only when the request itself names the preset; otherwise it says agent default |
| `signalHue` | `green` or `blue` | terminalcore only. One hue for the whole film |
| `bpm` | number | The Tier-1 beat grid; 100 when absent or not positive |
| `seed` | integer | Run seed for every pass; default 20260926 |
| `audio` | path | Lets the Tier-2 beat grid run when the librosa venv is ready. The track that is muxed comes from `treatment.sound` (`references/sound.md`) |
| `wordTiming` | boolean | Tier-3 opt-in; exits 14 because that runtime is not shipped |
| `lines` | string[] | The lines shape |
| `shots` | object[] | The shots shape |
| `posterFrame` | integer | Frame used for `poster.png`; default is the middle of the first text shot |
| `post`, `passParams` | object | Expert overrides of the post chain and pass parameters. Every gate cap still applies |

## Scenes

| `scene` | Required | Optional | On screen |
| --- | --- | --- | --- |
| `title-slam` | `text` | `sub` | Display type landing on a beat, with a small machine-voice line under it |
| `karaoke-line` | `text` | | One line revealed one eojeol at a time; the layout never reflows as words arrive |
| `kinetic-list` | `heading`, `items[]` (at least one) | | A heading, then the items, one whole item per reveal step |
| `number-counter` | `to` | `from` (0), `prefix`, `suffix`, `label` | A figure counting up in the machine voice; the final value is set as `prefix` + the rounded number with thousands separators + `suffix` |
| `signature` | `text` (Latin only) | `font` | A pen writing the line in a single-stroke font |
| `end-card` | `text` | `sub` | The closing statement; its settled last frame is the reduced-motion still |

Every shot may also carry `hold` (seconds; it can only lengthen the shot) and `post` (overrides for that
shot, range-checked by MO-A-58 in `references/craft-loop.md`).

The `signature` fonts are `ems-allure` (connected script), `ems-felix` (brush), `ems-osmotron`
(geometric), `ems-readability` (plain sans, the default) and `ems-tech` (hand lettering). None of them
has Hangul, so a `signature` shot with Hangul text is refused before rendering; set Hangul as a
`title-slam` instead.

## What the engine refuses before the first frame

- An unknown `scene` id, or a scene missing its required field.
- A brief with no text at all (no `lines`, no `shots`).
- A placeholder in angle brackets anywhere in a shot.
- A running index such as `01 / 05` in any string while the treatment's `typePlan.index` is not true.
  Turn the index on in the treatment when the film should count its parts.
- A character the resolved font cannot draw (MO-D-04, `references/type-craft.md`).

The first three are brief errors; the index and placeholder checks report a treatment field, so the exit
names what to fix.

## Writing copy that moves

- **Length belongs to the treatment.** Every unit first gets 1.25 times its reading floor. When that film
  is shorter than `durationSec`, the engine scales every hold by the smallest factor that reaches the
  target, so a beat snap overshoots by one beat at most. When the floors alone already run more than 10 %
  past the target, it keeps the floors and warns; the reply then says the film came out longer.
- **One idea per shot.** A shot that needs a paragraph has become a card. Split the thought across shots
  or turn it into a `kinetic-list`.
- **Keep the user's words.** Supplied copy stays as written in meaning. Invented copy comes from the
  treatment's subject specifics, never from rephrasing the request.
- **Punctuation is automatic.** Display strings pass through `smart()` (three dots to an ellipsis,
  straight quotes to curly ones). In terminalcore every string goes back through `plain()`, because the
  terminal shows typed input.
- **Nothing private on screen.** The working title, file names and internal terms stay off the frame;
  only `label` is ever drawn as a name.
- **Rights.** Song lyrics or any text the user does not own never become the film's content.

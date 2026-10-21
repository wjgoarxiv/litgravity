# Look rounds and the done-check

The gate tells you a film is safe to watch and its words can be read. It cannot tell you the film is
any good, and it cannot see a glint that turned a letter into a coloured block. Look rounds are where
you open the rendered pixels, judge them against the treatment, and write down what you saw. The
done-check refuses a film or a cover that nobody looked at, and in LitGravity it can tell whether you
really opened the images.

## What counts as looking

Only an image you open with `read_file` counts. While the `lit-typographic-motion` route is active,
LitGravity's PostToolUse hook records the path of every `read_file` call (`view_file` on older builds), and the Stop hook compares the
`viewed` list of your last round against those paths. A file you list without opening is named in
the hold reason. OCR, pixel statistics, a directory listing or a description from another tool can
be written into `aids`; they help, and they never count as viewing.

Every render writes its stills into `<dir>/stills/` and lists them in `stills/index.json`:

- **Film, stage or type path:** `beat-NN.png` (each beat at its midpoint, full size), `strip-NN.png`
  (one strip per cut: frames 6 before, at, and 6 after the cut), `sheet.png` (12 frames across the
  film), and after a full render the delivered `poster.png`.
- **Cover:** `sheet.png` (12 decoded frames over the frame-difference plot), `poster.png` (frame 0),
  `seam.png` (the last frame beside frame 0) and `frame-00.png` to `frame-11.png`. See
  `references/cover.md`.

If `read_file` cannot show you an image in this session, record the round as blocked:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" look --out <dir> --round <N> --blocked no-vision-tool
```

The best the result can then reach is `DONE_UNVIEWED`, and the reply has to say in plain words that
nobody looked at the frames.

## The film questions

Answer all nine in every film round. Each answer names one file of the current stills set and says
what is visible there.

1. **Who is it for?** Write down the sentence a stranger would say. Get it blind when you can: spawn
   a read-only child with `invoke_subagent` (`TypeName` `quality-reviewer`), hand it only
   the contact sheet and the beat stills, never the request or the treatment, and record its sentence
   verbatim with `by: "blind"`. If no child can run, answer it yourself with `by: "self"`. The
   verdict says whether that sentence matches the treatment's audience and subject.
2. Does every beat show what its `onScreen` plan promised?
3. Is the craft at the level `ambition` asks for: transitions, rhythm, depth, hierarchy?
4. Is any request text, label, placeholder, file name or internal term on screen?
5. Does the ending land?
6. Does the sound follow the cuts? Answer from `sound-cues.json`.
7. Name one thing a skilled motion designer, given only the request, would have shown that this film
   does not, or answer `none`.
8. Is any element on screen without a job in its beat?
9. Could every copy line move unchanged into a film about another subject? If so, rewrite the copy
   from `subject.specifics`.

## The cover questions

A cover round answers eight different questions, because a loop fails in different ways.

1. Is something moving in every half-second window (the plot never lies flat on the red dashes)?
2. Does the seam vanish in the decoded file (`seam.png`, and the right end of the plot)?
3. Does it still move after encoding, with no region that freezes and then pops?
4. Is the brand word present, legible and in place in every frame, never faded or swapped?
5. Can you see all three speed layers: a slow perpetual one, a mid swell, and beat events?
6. Does anything read as a slide, a card swap, a title fade or an end card, or does light wash in
   place instead of travelling as an edge?
7. Is any glyph, glint or glow damaged: a block of colour, a dark disc, a visible box?
8. Name one thing a skilled motion designer would add or remove, or answer `none`.

## The answers file

Write the answers as JSON and record them:

```bash
node "$SKILL_ROOT/scripts/motion.mjs" look --out <dir> --round <N> --answers <file>
```

```json
{
  "viewed": ["stills/sheet.png", "stills/beat-01.png", "stills/strip-01.png"],
  "weakestBeat": 2,
  "change": "<the change you make after this round>",
  "aids": ["<optional notes that are not looking>"],
  "answers": [
    { "q": 1, "verdict": "yes", "by": "blind", "sentence": "<the stranger's sentence, verbatim>",
      "frame": "stills/sheet.png", "observed": "<a concrete visible detail in that frame>" },
    { "q": 7, "verdict": "none", "frame": "stills/beat-03.png", "observed": "<what you saw>" }
  ]
}
```

`look` (engine/node/look.mjs) checks the file against the latest stills set and refuses, with a
`LOOK_REFUSED` line, anything that does not hold:

- `viewed` is a non-empty list of stills files, paths relative to `<dir>`, each one in the current
  `stills/index.json` and present on disk.
- `answers` covers every question exactly once. `verdict` is `yes` or `no`, except for the last
  question (film 7, cover 8), which takes `none` or `named`.
- Every answer's `frame` is in the current stills set, and its `observed` is a real sentence about
  something visible: at least 20 characters and four words in Latin script, or 12 characters with
  eight Hangul syllables. A bare verdict word, a `<placeholder>` or the same sentence used for two
  answers is refused.
- Film question 1 also carries `by` (`blind` or `self`) and the stranger's `sentence`.
- Round 1 of a film names `weakestBeat` (an integer index). Round 1 of either mode names `change`, at
  least 12 characters.
- `defects` belongs to covers only: at most three per round, each `{ t, region, frame, observed,
  cause, fix }`, with `t` inside the loop, `region` in whole cover pixels on the cover, and `frame` in
  the current set. A film round with `defects` is refused. The cover reference explains how a defect
  leads to a `--window` re-render.

The recorded round is stamped with the SHA-256 of `stills/index.json` and of every frame it names, so
the done-check can tell a look at the final render from a look at an earlier one.

## Rounds

Rounds share one counter with the renders, from 1 to 3, and only move forward. `look --round N` needs
the latest stills set to be round N.

- **Film round 1** is always a stills round: render with `--round 1 --stills-only`, look, name the
  weakest beat and the change, then make the change.
- **Cover round 1** is a full cover render followed by a look that names the change.
- **Another round is needed** when a film answer is `no` on 1, 2, 3, 5 or 6, `yes` on 4, 8 or 9, or
  `named` on 7; or when a cover answer is `no` on 1 to 5, `yes` on 6 or 7, or `named` on 8. Fix the
  cause, render again, look again.
- **After round 3**, deliver anyway and state each open item plainly in the reply.

## Done

For a film, done needs every one of these: a valid treatment that has not changed since the last full
render; `gate-report.txt` reading `QA gate: PASS`; a full render after any stills-only one; at least
two look rounds, the first a stills round that names a change; the last round stamped with the final
render's stills; that round's `viewed` covering the poster, the sheet, every beat still and every
strip, each one opened with `read_file`; and no answer in the last round asking for more unless it is
round 3. A cover is done on its own terms, listed in `references/cover.md`.

The Stop hook evaluates this for the last output folder of the turn. It holds the turn with the
named reasons at most twice, then asks the reply to say plainly that the work is not done, why, and
what the user can run to finish it. A blocked render (exit 10, 11, 12, 14, 15, 21 or 22) goes straight
to that notice. A finished film or cover with a downgrade, an open look item, a generated asset or
`DONE_UNVIEWED` holds once so that the reply says so.

## Never downgrade to pass

Do not answer a failure by shortening the film, dropping a beat or the subject device, switching
sound to `none`, moving from the stage path to the type path, or deleting effects. Fix the cause: a
scrim behind the text, a larger size, a position inside the safe area, slower timing, seeded
randomness. The done-check compares the final treatment with the first valid one and records a
downgrade when the duration fell by more than 20 %, the subject covers fewer beats, the sound became
`none` without the user asking for silence, or the path moved from stage to type. The reply must
name it.

## The reply

Keep the activation line where it is, with no second banner and no emoji under it. In plain words:
one line on the defaults chosen; a label on every invented subject, every generated sound and every
generated asset; one line on what was checked (flash safety, legibility, the frames looked at); where
the output lives and the one command that renders it again; and every downgrade or open look item.

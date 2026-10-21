# Type craft: Korean and Latin in motion

The type kit builds most of these rules into the way it lays text out, and the gate measures them again
from the render log afterwards. That second check exists because a custom scene or an expert override can
step around the kit; when it does, the gate names the rule.

## Script runs (MO-FT-04)

Before layout, every string is cut into runs of one script (`scriptRuns` in `engine/core/text.mjs`).
Digits, punctuation and spaces belong to no script and join a neighbour: between two scripts they stay
with the run on the left, and before the first letter they join the run on the right. So `2026년` is a
single Hangul run, and `LIT팀` is a Latin run followed by a Hangul run, cut exactly where the script
changes. Each run then takes its voice's font for that script (`runFontKey` in
`engine/core/voices.mjs`), and the Node pre-flight resolves fonts through the same function, so the
coverage check and the page always agree on the file.

- A Latin run may track and may step between the Archivo widths 75, 100 and 125.
- A Hangul run is pinned to tracking 0 and width 100, even inside a mixed line whose Latin part is
  animating. Emphasis on Hangul comes from weight alone, and only from the two Pretendard files the
  lit-pptx skill ships (Regular 400 and Bold 700). The engine synthesises nothing: no faux bold, no
  horizontal scaling, no condensed Hangul (MO-A-33).

## Breaking and revealing (MO-A-13, MO-FT-05)

Korean breaks only at the spaces between eojeol, a word together with its particles. A karaoke reveal
step is one eojeol and a list reveal step is one whole item. When a block does not fit, the scene shrinks
the size in steps of about 8 % and wraps again by eojeol, down to a floor of 24 px, instead of breaking
inside a word.

## Kerning across split words (MO-A-32)

When a word is drawn in pieces, for a colour split or a letter-by-letter reveal, piece *i* goes to the
kerned position of glyph *i* in the whole run (`glyphX`). Placing it at the width of the preceding
substring would drop the kerning pair at the split, and that shows on screen as a hairline gap.

## Punctuation (MO-A-34)

Display text passes through `smart()`: three dots become an ellipsis, straight quotes curl, and leading
elisions such as ’90s or ’cause get an apostrophe. The terminalcore preset converts everything back with
`plain()`, as does any machine-voice `sub` line, because those voices show typed input.

## Legibility without outlines (MO-A-35)

No stroked glyph outlines and no halos. When type is hard to read, change the palette role, the size or
the weight. The kit offers no outline call at all; the single-stroke pen fonts are lines by design and are
the only exception.

## Sizes and weights at 1080p (MO-FT-07)

- Pretendard Regular is for held type up to about 32 px cap height. Slams and large moving type use
  Bold, because thin strokes break up under the motion blur of the sub-frame samples.
- Galmuri9 is snapped to whole multiples of 9 px, never below 36 px (`snapSize` in the scene base class).
- VT323 and Galmuri each get their own line in a readout.
- The contrast floor depends on rendered size: 32 px or larger (25 px at weight 700) counts as large and
  needs 3:1; everything smaller needs 4.5:1 (MO-C-06).

## Tracking (MO-C-25)

Display type may tighten down to -0.04 em and no further. The machine voice and small text never take
negative tracking, since a monospace grid with negative tracking fights its own cells.

## Blocks of several lines (MO-C-26, MO-C-27)

Two lines need a line height of at least 1.5 for Latin and 1.6 when the block holds CJK text. A paragraph
card of running Latin keeps 60 to 75 characters per line; for a Korean card 30 to 45 characters is
reported as advice and never fails the gate.

## Reading time (MO-C-07, MO-C-08)

One floor function covers every unit, from `READING` in `engine/core/constants.mjs`. With H the number of
Hangul syllables and W the number of Latin words:

- a line or a scene with text: `max(1.0 if any Hangul else 0.9, 0.2·H + W / 3.3)`, and a Latin pace no
  faster than 17 characters per second;
- a single word shown alone: `max(0.5, 0.2·H + W / 3.3)`;
- a reveal step inside a line that stays up: 0.35 s;
- a scene with no text has no reading floor; its minimum comes from the two-beat rule.

The engine generates holds at 1.25 times the floor, so its own timeline always clears this check. A line
of four eojeol with 14 syllables floors at 2.8 s and is given 3.5 s before the cut snaps to the beat. A
custom `hold` can lengthen a shot and never shorten it below its floor.

## Glyph coverage (MO-D-04)

Before the first frame, every character is looked up in the cmap of the font its run resolves to. A
missing glyph stops the render and names the font and the character; change the text or the preset. The
pen fonts have Latin only, Galmuri9 and Pretendard cover Hangul, and VT323 and Archivo cover Latin.

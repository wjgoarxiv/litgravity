# Brand and imagery

Brand and imagery are contract decisions. Every asset traces to an authorized input, a written specification, and an `inventory.references` entry with its own `sha256` and provenance.

## Authorized brand inputs

Use what the user handed you or what the repository already holds. Anything else is rework.

- Tokens, theme files or CSS custom properties already in the repository.
- A brand guideline document or style page the user pointed at explicitly.
- Logo, icon and font files present under the repository's asset paths.

Report `BLOCKED` when a brand name, a legal mark, an asset license or a final identity decision needs an approval you lack, and name the approval in the report.

## When no brand exists

Build a neutral system that a real brand can replace at one seam. Inventing an identity is outside the brief.

- A single accent role, defined once as a token and referenced everywhere.
- A neutral ramp derived from one hue with fixed contrast steps.
- A system font stack with an explicit per-script fallback.
- Geometric placeholder marks that read as shapes, kept clear of anything that looks like a company wordmark.
- Record the neutral choice under `accepted_exceptions` with an owner.

With no stated visual direction on a new brief, `references/default-editorial-pixel.json` applies as the authored default. It yields to explicit user direction and to existing brand tokens.

## Qualities into interface decisions

Convert each adjective into something a reviewer can measure.

| Quality | Concrete expression |
|---|---|
| Precise | 4 px grid, 2 px radius, single-weight borders, tabular numerals |
| Calm | one accent, two type weights, motion at or under 200 ms |
| Dense | 32 px rows, 8 px gutters, inline row actions, no nested cards |
| Authoritative | high contrast, wide margins, restrained accent, no gradient |
| Warm | rounded radii, humanist sans, tinted neutrals, low elevation |

## Specifying a generated reference image

A generated image states intent. It is a specification and carries no evidence that an interface exists. Say so wherever it appears.

- Name the file `spec-*` or `reference-*`, leaving `screenshot-*`, `capture-*` and `proof-*` to real captures.
- State subject, framing, palette constraint and the exact text that must be legible.
- State what must stay out of frame: logos, real people, trade dress, invented metrics.
- Record it as reference kind `generated`, with the tool and the date in its provenance.
- Keep it out of the verification receipt; only a real capture proves behavior.

When the host offers an image tool (`generate_image` is in the agy binary, UNPROBED), the same rules hold: the prompt, tool and date go into the provenance entry.

## Reference frames

Fix dimensions and a safe area before requesting or producing an image.

- Hero 16:9, with an 8 % inset on all sides kept clear for overlaid text.
- Card 4:3 or 4:5, subject centered, no text rendered into the raster.
- Diagram: fixed `viewBox`, no raster text, theme-following strokes (`lit-diagram-drawer` owns standalone diagrams).

## Asset production record

Keep one row per asset so a reviewer can trace and reproduce it.

- Path, pixel dimensions, format, byte size.
- Origin: repository, user-supplied or generated.
- The generating prompt or the source URL, plus tool and date.
- License or permission basis, naming the party that granted it.
- Accessible name, plus a long description when the image carries information.

## Identity safety

Produce nothing that could pass for a real organization's own material.

- Skip third-party logos, wordmarks, licensed typefaces and trade dress.
- Skip likenesses of real people and endorsements that were never given.
- Skip invented testimonials, review counts, certifications and performance figures (SLOP-041, SLOP-044 and SLOP-045 catch the copy and number versions).
- When a request asks for a lookalike of a real product, stop and confirm the intent first.

## Validation before assets ship

Check each asset against the surface that renders it, using the surface as the reference and leaving the design file aside.

1. Contrast: overlaid text against the image's darkest and lightest regions (CF-204 covers gradients; text over an image is a manual check).
2. Theme: render in light, dark and forced colors.
3. Degradation: alt text, failed load and a slow-network placeholder (SLOP-057 flags broken images).
4. Weight: hero under 200 KB, card under 80 KB, icon under 8 KB.
5. Layout: declare intrinsic width and height so loading causes no reflow.

## Failure patterns

Reject:

- a generated image filed, named or captioned as a screenshot
- text baked into an image, where it cannot be translated, scaled or read aloud
- decorative imagery given a descriptive alt string, or informative imagery given none
- an asset with no license basis, or a mark reused because it "looks generic"
- brand adjectives carried into implementation with no concrete expression behind them

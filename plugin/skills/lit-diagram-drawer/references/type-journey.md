# User journey map

Catalog ID: journey

## Purpose and selection

A journey map explains one persona's actions across the stages of an experience and how those stages feel. The sentiment curve is the defining evidence, and a diagram lacking a meaningful sentiment per stage is a process or timeline. Show the experience from the person's perspective, and keep internal system sequences out of it.

## Exclusions

Swimlane or process covers operational handoffs, timeline covers dated events, and a service blueprint covers cases that need frontstage and backstage responsibilities together. Each map holds one persona, and sentiment scores come from real research, so a fabricated score has no place. With no sentiment evidence at hand, draw a neutral stage map or ask for research.

## Content schema

Provide one named persona and goal; 3–6 ordered stages; one qualitative sentiment level per stage from high, medium-high, neutral, medium-low, or low; one short user action per stage; a touchpoint per stage; and optionally one metric or owner row. Identify the lowest meaningful stage and up to two concrete pain markers. State whether ratings are observed, reported, or illustrative. Include an adjacent legend defining the sentiment levels.

## Deterministic layout recipe

Use a horizontal stage grid with a 64px left label gutter and equal 200px columns separated by 24px. Make the canvas wide enough for all columns; in the canonical five-stage case the first stage starts at x=64 and later columns advance by 224px. Place the stage number and name in a compact header above a 160px sentiment band. Draw high, neutral, and low reference lines 80px apart and map the five named levels to fixed ordinal y positions, with each point at the center of its stage. Join the points with a 1.5px polyline. Below the plot, add action and touchpoint rows separated by full-width hairlines, then an optional third row and the legend. Allocate enough height for pain-marker tags to clear the row beneath.

## Encoding rules

Sentiment is an ordinal level and carries no continuous numerical scale, so the plot prints no 0–100 axis. Draw the whole curve in muted ink and highlight the trough point plus its incoming segment with the accent. Up to two small dashed pain tags may sit at the friction stage, and the remaining stages stay untagged. Set actions in sans text and set touchpoints and row labels in mono. The sentiment curve is a data line. Any additional connector follows the shared routing rules.

## Korean behavior

Write the persona label and action phrases in Korean when the intended audience is Korean. Preserve first-person phrasing when it carries the participant's perspective. Use named ordinal terms in place of unlabeled numeric scores, and translate all five consistently. Keep Korean short enough to scan per column, wrap at phrase boundaries, and mark emotion with text instead of emoji. Pretendard carries the Hangul, and mono is reserved for stage IDs or touchpoint codes.

## Light, dark, and full variants

Light and dark variants preserve stage order, sentiment values, content, and trough selection. Re-map neutral and accent tokens, then re-check curve contrast against the reference lines. Full editorial may add the research context, persona, one-sentence takeaway, and source/date note around the map. The visible caption itself says whether the evidence is measured or an illustrative exercise.

## Accessibility

The SVG description names the persona, stage order, sentiment trend, trough, and whether evidence is measured or illustrative. Supply ordinal labels in the key and a concise text summary, so curve hue is only one of several cues. Point markers and a line style or label keep the trough clear in grayscale. Action, touchpoint, and pain text is large and has sufficient contrast.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for page bounds, text collision, clipping, contrast, skin polarity, SVG title/description, and humanizer checks. Run scripts/verify-type.mjs --type=journey to confirm one persona, 3–6 stages, ordinal values, curve-to-stage binding, trough highlighting, the maximum pain-tag count, and evidence-status labeling. Inspect the plot and row alignment at the final presentation size.

## Anti-patterns

- A journey without a person or sentiment evidence.
- Numeric sentiment that implies unsupported measurement precision.
- Multiple personas on one curve or pane.
- Emoji faces, gradients, or saturated sentiment bands.
- Pain tags on every stage.
- A curve whose focal segment fails to point into the trough.
- An internal platform flow relabeled as a customer journey.
- A full version that makes invented sentiment sound researched.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Annotation primitive](primitive-annotation.md)

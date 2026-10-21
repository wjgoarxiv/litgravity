# Accessible diagrams

Accessibility belongs to the diagram's grammar from the first draft. A picture can look crisp and still fail a reader when it lacks an accessible name, carries labels that are too small, or uses color as its only code.

## SVG semantics

- Put `role="img"` and `aria-labelledby` on the root SVG, pointing at the title and description ids.
- Place a unique `<title>` and a concise `<desc>` first in document order.
- Keep every visible name as live text. Ordinary labels stay text and never become images.
- Give each meaningful group a stable reading order. A purely decorative icon is hidden from assistive technology when the label next to it already carries the meaning.
- When the drawing holds complex relations, state the main direction and the grouping in the SVG description or in the text beside the figure.

## Contrast and redundant cues

- Measure text contrast against the fill actually behind each label: 4.5:1 for ordinary text, 3:1 for large text and for essential non-text marks.
- Pair every color-coded meaning with a second cue: a line pattern, a shape, a word or a position.
- On an interactive diagram, check focus and selection states. A static export gets no added focusability.
- Confirm that arrowheads, boundaries and symbols stay visible in both themes and in grayscale.

## Reading order and sizing

- Make DOM order follow the intended visual reading path.
- Lead with a short title, then detail. Related content shares a clear label and its own spacing.
- Korean names use 12px at minimum. Hangul keeps its natural width at every size.
- Keep line-height readable and keep overlays off the text.
- Test the final image at the size where it will appear in the document or slide.

## Motion and alternate presentation

- A complete static state is the default and stays available when scripts do not run.
- State, sequence and completion are readable without color change or animation.
- `references/motion.md` holds the reduced-motion, keyboard and timing rules.
- A dense diagram earns a short text summary or a companion table. Shrinking the image is the wrong fix.

## Manual checks

Open the accessibility tree and confirm the name and the description. Walk through every control with the keyboard. Compare light and dark at presentation size, and include mixed Hangul and Latin labels in the visual pass.

# Interaction states

Use `references/motion-guide.md` for animation choices. This guide covers what a control does, how it reports state, and where keyboard focus goes.

## State inventory

For each interactive element, name the states it can reach:

- pointer and keyboard: default, hover, pressed, focus-visible, disabled
- selection: selected, expanded, current, checked, indeterminate
- async work: loading, retrying, succeeded, failed
- content: empty, partial, truncated, stale, overflowing

Map each state to its visual treatment, its accessible announcement and its transition. The Design Contract owns the state inventory: `inventory.states` carries the kinds (`loading`, `empty`, `error`, `success`, `disabled`, `permission`, `offline`, `ready`) and `component_behaviors` binds components to them. A state missing from the inventory is a coverage gap.

## Feedback follows consequence

| Action | Feedback |
| --- | --- |
| Reversible local change | Apply immediately; skip the confirmation step. |
| Remote action | Show pending state and offer undo when the operation supports it. |
| Work taking over a second | Keep progress in place and hold the current layout. |
| Irreversible action | Name the object and effect before confirmation. |
| Failure | Keep the user's input, explain the next step, and make retry reachable. |

Validate a single field on blur and cross-field rules on submit. After an error, revalidate as the user edits. Debounce remote checks and cancel requests made stale by newer input.

## Focus and keyboard paths

1. On open, focus the first meaningful control.
2. Keep focus inside a modal; Escape closes it when that discards no unsaved work.
3. On dismissal, return focus to the opener or its nearest surviving control.
4. After removing a row, move focus to the next row, or to the list when it is empty.
5. After navigation, focus the new heading or skip target.

Treat gestures as shortcuts. Swipe-to-dismiss needs a close control; drag-to-reorder needs keyboard controls or a position field; pull-to-refresh needs a visible refresh action (CF-704 flags controls revealed by hover alone).

## Pressed, hover and disabled details

- Pressed feedback scales to 0.95 to 0.96 inside 150 ms (CF-502).
- Hover feedback on repeated controls (list rows, table actions) stays at 150 ms or less, or is instant (CF-506).
- A disabled control keeps its label legible, drops out of the tab order, and states why it is disabled in nearby text or a described-by relation.
- Loading controls keep their width, so the label swap shifts nothing.
- A focus ring never depends on hover, and a hover style never carries information that focus lacks.

## Review record

For each interaction, retain an internal Design Contract or QA record keyed to its hash: the trigger, the accessible name, reachable states, keyboard path, async failure and retry behavior, and how QA reached the state. Keep this record detailed in `.litgravity/evidence/<slug>/`. In the chat reply, mention the limitation that changes the user's next decision and leave the rest in the file.

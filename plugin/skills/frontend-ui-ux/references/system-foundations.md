# System foundations

A design system is three token layers, a finite primitive set, and a gate that proves both. Build it in that order; a skipped gate pushes the cost into feature work.

## Audit before authoring anything

Write nothing until the audit shows that no existing token or primitive fits.

- List tokens, primitives with their variants, and duplicate components.
- Count raw one-off values per file; that count is the migration size.
- Mark each primitive keep, extend or replace, with its replacement cost.
- Every proposed primitive names the existing one it cannot reuse.

Useful commands through `run_command`: `rg -c '#[0-9a-fA-F]{3,8}\b' src` for raw colors, `rg -c '[0-9]+px' src` for pixel literals, `rg -l 'export (default )?function Button' src` for duplicate primitives.

## Split the three token layers

The layers exist so a value change and a meaning change land in different diffs.

1. Foundation: raw values with no meaning, such as `color.slate.700`, `space.16`, `duration.150`.
2. Semantic roles: meaning per theme, such as `color.text.muted`, `color.border.strong`, `radius.control`.
3. Component decisions: `button.primary.bg`, resolving to a semantic role.

## Keep components behind the semantic layer

A component reads layer 3 or layer 2. One reach into layer 1 breaks every theme at once.

- No component references a foundation value, even through an alias chain.
- No cross-component reads: a button reads button tokens and leaves card tokens alone.
- Name roles by function: `text.muted` says what it does, and `text.gray` says what it looks like.

## Complete component anatomy before styling

Declare the whole component up front. A state found in review is a defect, and the anatomy is where it gets prevented.

- Purpose, semantic element and the source of its accessible name.
- Enumerated variants and sizes; open-ended variant sets are rejected.
- States: default, hover, active, focus-visible, disabled, selected, loading, error, empty, overflow.
- Keyboard model, including escape and return-focus behavior.
- Content limits: minimum and maximum characters, wrap or truncate, CJK and RTL.
- Ownership of validation, async progress, retry and destructive confirmation.

## Pass the primitive showcase gate

Build one route rendering every primitive, variant and state before feature work.

- Every state visible without interaction: error, empty and overflow included.
- The longest real label, a CJK sample and an expanded string in each text slot.
- One keyboard pass reaches every control in linear order with a visible focus ring.
- The gate passes when no state is missing, raw values number zero, and contrast is measured per theme.

Run the interface probe on the showcase route. Its seven matrix rows and the slop register give the gate a mechanical half.

## Architect themes as complete sets

A theme is a complete semantic role set. Partial overrides are how theming rots.

- Define every role in every theme; a missing role fails and has no fallback.
- Dark mode raises surface lightness, weakens shadow and strengthens border, which differs from inverting lightness.
- Follow `prefers-color-scheme`; an explicit user choice overrides it.
- Under `forced-colors: active`, use system keywords and keep borders load-bearing.

## Align an existing system in sequence

Alignment is ordered. Mixing a reference migration with a value change ruins review.

1. Stop accepting one-off values; anything new enters as a semantic role.
2. Map existing raw values to the nearest role and list what has no match.
3. Introduce roles as aliases of current values, so this step changes nothing.
4. Confirm parity, then move components onto roles, one primitive at a time.
5. Change the values last, as one diff a reviewer can read end to end.

## Record the system where reviewers read it

The system lives in the contract.

- Write tokens, components and inventory into the contract; keep `omissions` and `accepted_exceptions` filled.
- Validate from the skill directory: `node scripts/validate-design-contract.mjs <path>`. `examples/design-contract.example.json` is a valid v1beta2 starting point.
- Record the contract hash so the independent review pass binds its receipt to those bytes.
- Shipping inside an agy plugin bundle also requires `agy plugin validate <plugin-dir> --json --strict` to report no findings.

## Governance reject-list

Reject:

- a component reaching past the semantic layer to a foundation value
- a primitive or variant introduced for exactly one screen
- a state surfaced by review in place of one declared in the anatomy
- a dark theme assembled from per-component overrides
- a value change bundled into the same diff as a reference migration

# Taste direction

This reference is data. Load it when a Design Contract needs a defensible visual direction, and leave it closed on routine interface questions.

Generic output is a describable defect with named causes. It is what an interface looks like when nobody decided anything. This reference turns "make it feel better" into three numbers a reviewer can argue with, plus checks that run before the first element is written.

## The three dials

The contract carries them as the optional `taste` object in `litfamily.design-contract/v1beta2`. Each is an integer from 1 through 10. Declaring `taste` means declaring all three, and omitting the object leaves the harness default in force.

| Dial | 1 means | 10 means | Decided by |
| --- | --- | --- | --- |
| `variance` | The most conventional arrangement a user could predict | A composition that departs from the expected grid where the departure carries meaning | How much novelty the audience tolerates before the surface feels unfamiliar |
| `motion` | Movement only where it prevents a jump or explains a change | Movement is a primary carrier of meaning and sequence | What the interface must communicate that stillness cannot |
| `density` | One idea at a time, generous rest | Many related facts readable at a glance | Whether the user scans or dwells |

Pick each dial from the audience and the task. A dial you cannot justify in one sentence is a dial you have not chosen.

### `motion` and `motion.policy`

They answer different questions, and both must agree. `motion.policy` decides whether animation is permitted at all: `none`, `functional` or `expressive`. The `motion` dial decides how much meaning animation carries once it is permitted. A contract with `motion.policy: "none"` and a `motion` dial above 1 contradicts itself: it forbids transitions and then leans on them. Set the policy first, then the dial within it.

### Reading the dials

| Dial range | Typical surface | Typical expression |
|---|---|---|
| `variance` 1 to 3 | Admin console, settings, banking | Standard grid, standard patterns, familiar placement |
| `variance` 4 to 7 | Product site, onboarding, dashboards | One distinctive move per screen, otherwise conventional |
| `variance` 8 to 10 | Editorial, portfolio, campaign | A designed composition per section, asymmetry with a reason |
| `motion` 1 to 3 | Tools used hourly | State changes only, 120 to 180 ms |
| `motion` 4 to 7 | Marketing, onboarding | One hero reveal, hover and scroll cues with reduced-motion paths |
| `motion` 8 to 10 | Showcase pieces | Choreographed sequences; every one carries meaning and has a still twin |
| `density` 1 to 3 | Landing pages, confirmations | One idea per viewport, large type |
| `density` 4 to 7 | Mixed products | Grouped content, rows at 36 to 48 px |
| `density` 8 to 10 | Operations consoles | Rows at 28 to 32 px, tabular figures, keyboard-first |

## The failure modes these dials target

Each is a defect you can point at in a review.

- **Undecided hierarchy.** Every element competes because nothing was ranked. Usually a `density` chosen by accident.
- **Default-everything.** Stock radii, shadows, spacing scale and type ramp applied because they were there. A `variance` of 1 that nobody selected.
- **Uniform rhythm.** Identical spacing between unrelated things, so grouping carries no information (SLOP-006).
- **Decorative motion.** Movement that neither prevents a jump nor explains a change, and that reduced-motion users lose nothing by missing. A `motion` dial above what the interface needs.
- **Single-viewport thinking.** A composition that resolves at one width, which the contract's `responsive_transformations` cannot describe honestly.
- **Borrowed voice.** Copy and imagery from a reference product whose audience is another one.

## Pre-flight, before writing any interface code

Run this against the frozen contract. Each answer is one sentence, and a blank answer is the finding.

1. What is the one thing a user must understand within seconds of arrival, and which element carries it?
2. What is deliberately quieter so that element can be loudest?
3. Which grouping is expressed by spacing alone, and does it survive a 200 percent zoom?
4. Which transition would a reduced-motion user lose, and what replaces it for them?
5. Which token is being extended or created, and why was reuse insufficient?
6. Which of the three dials would a reviewer most likely dispute, and what is the argument for it?

If question 6 has no answer, the direction was inherited and nobody chose it.

## Redesign audit, for a surface that already exists

Use this in the `redesign` and `brownfield` lanes. Audit before proposing, so the proposal has something to be measured against.

1. Inventory what is there against `inventory`: routes, regions, components, states. Name what exists and lacks documentation.
2. Record the current dials as observed. An existing surface already sits somewhere on all three, chosen or not.
3. Name the single largest gap between observed and intended dials, and change that first. Moving all three at once makes the result unattributable.
4. List what must be preserved: behavior users depend on, keyboard paths, and any token another surface consumes. This becomes `non_goals` and the preserved-behavior half of the contract.
5. Put the rest in `omissions` with an owner, so the gap has a name.

A redesign that cannot say what it preserved is a rewrite wearing a redesign's name.

## Recording the outcome

Dials belong in the contract, beside the prose that explains them. The acceptance criteria that reference them stay observable: "the primary action is reachable by keyboard within two stops" is checkable, and "the layout feels considered" is a mood. Every dial you set traces to at least one acceptance criterion, or it changed nothing that can be verified.

## Worked example

A clinic scheduling console used all day by front-desk staff: `variance` 2 (staff want predictable placement), `motion` 2 with `motion.policy: "functional"` (state changes only), `density` 8 (rows at 32 px, tabular times). The patient-facing confirmation page uses `variance` 5, `motion` 4 and `density` 3, a separate contract with its own dials. Acceptance criterion on the console: "the next open slot is reachable by keyboard in three stops from the day view." The dial and the criterion tie together, and a reviewer can dispute either with evidence.

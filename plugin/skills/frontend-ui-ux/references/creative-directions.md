# Creative directions

Explore direction after the critical task, the success signals and the surface list exist. A direction is a bounded set of measurable commitments, and a mood is only its starting point.

## Close the brief before exploring

Write the fixed constraints first so exploration ends.

- Critical task, the two frequent secondary tasks, and return frequency.
- Immovable inputs: existing tokens, approved marks, locales, viewport bands.
- Direction count: three, with four as the ceiling.

If the brief names competing directions and leaves them undecided, the choice goes to the user through `ask_question` with a recommended default (`references/production-interview.md`). A recommendation inside the question leaves the axis open until the user answers or delegates it.

## Read the archetype set

Each archetype is neutral. Pick by which risk this product can absorb.

1. Editorial grid: modular columns, visible rules, one restrained accent. Risk: every block weighs the same and no focal point forms.
2. Reduced utility: near-monochrome, one accent, large gutters, few borders. Risk: interactive and static elements look alike.
3. Humanist soft: rounded radii, humanist sans, warm neutrals, low elevation. Risk: casual where the task is financial or clinical.
4. Instrument panel: hairline borders, monospace numerics, tight cells. Risk: it shuts out occasional users and tires the eye after 30 minutes.
5. Layered surface: stacked elevation, translucency, blur behind overlays. Risk: shadows accumulate and text sits on unstable ground.
6. Display-led: oversized headline type, asymmetry, hard crops. Risk: collapses at 200 % zoom and 2.5 × string expansion.
7. Typographic classic: baseline grid, serif hierarchy, thin rules. Risk: hairlines vanish on 1 × displays and the layout breaks below 480 px.
8. Geometric system: geometric sans, square corners, flat fills. Risk: states are hard to separate without hue, and the tone reads cold.

## Blend with one base and one guest

Two archetypes at equal weight produce mush. Subordinate one of them explicitly.

- The base owns grid, spacing scale, radius and density, and those stay fixed.
- The guest contributes exactly one dimension: type, colour or surface treatment.
- A second import is a third direction, so it needs its own card.
- If nobody can say which archetype owns the spacing scale, discard the blend.

## Fill the direction card

One card per direction. A reviewer accepts or rejects from the card alone.

- `direction_id`, base, guest, imported dimension.
- The task it accelerates and the task it slows.
- Type roles with size and line height; the font shopping happens later.
- Semantic colour roles with measured contrast ratios per theme.
- Radius value, elevation ceiling in levels, border weight.
- Density claim: rows or cards per 900 px of viewport height.
- Cost: new primitives, migration size, added dependency, or none.
- Kill condition: the observation that would end this direction.
- Verdict: accepted, rejected or revise, with a reason.
- The three taste dials (`references/taste-direction.md`) with one sentence each.

## Run every direction on the same content

Directions compete on task outcomes, so identical content is the only fair test.

- Render the critical task's primary surface in each direction with identical records.
- Include the longest real label, the empty state and one validation error in each.
- Confirm the keystroke count on the frequent path is unchanged.
- Run the probe on each render. A direction that collects HIGH findings from the craft floor pays that cost in its card.

## Decline imitation as a rationale

A direction that exists because another product looks that way carries no reason.

- Ask which measurable fact the reference supplies; keep it and drop the rest.
- Reject any justification that depends on naming a competitor.
- Report `BLOCKED` for protected marks, licensed typefaces and lifted assets.
- Restate every kept observation as a consequence of the critical task.

## Close and record the choice

Selection ends exploration. Rejected work stays readable so the decision stays closed.

- Write the accepted direction into `direction.name` with three to seven principles and a token strategy.
- Keep each rejected `direction_id` with a one-line reason.
- Freeze before token work; a later change needs an `accepted_exceptions` entry with owner and expiry.
- Record the contract hash that the independent review binds its receipt to.

## Worked example

Brief: a clinic scheduling tool, used all day by front-desk staff, with an occasional patient-facing confirmation page. Three cards:

- A, instrument panel with a humanist guest (type): accelerates booking, slows first-time use, kill condition "a new staff member needs more than 10 minutes to book".
- B, reduced utility with a layered-surface guest (modal sheets): accelerates reading, slows scanning dense days, kill condition "double-booking appears in two usability runs".
- C, humanist soft: friendliest for patients, slows the all-day staff view, kill condition "row height above 40 px halves visible appointments".

Recommendation A, because the staff view runs hourly (density 6 of 10), with the confirmation page as a separate surface using the humanist guest more strongly.

## Failure patterns

Reject:

- directions differing only in accent hue or corner radius
- a blend with two imported dimensions and no owning base
- "modern", "clean" or "premium" standing in for a decision
- a direction with no kill condition, which can never be wrong

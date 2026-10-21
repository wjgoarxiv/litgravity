# Redesign playbook

A redesign changes how a product looks and leaves what a user can finish where it was. Capture the old behavior first: after the first edit nobody can tell a regression from an intended change.

## Baseline capture

Capture before touching a file. With no baseline there is no parity list and no regression guard.

- Pin the pre-change revision; its `source_hash` is the baseline identity.
- Capture every affected route at `compact` and `expanded` (the probe's 390 and 1440 rows, plus boundary widths).
- Capture `loading`, `empty`, `error`, `disabled` and overflow per route.
- Record tab order, focus targets and step count for each critical task.
- Save the captures and a copy of the probe's `findings.json` under `.litgravity/evidence/<slug>/baseline/`.

## Debt map

Classify debt before proposing a treatment; the category decides how far the fix reaches.

1. Structural: buried primary action, wrong heading order, grouping that misleads.
2. Systemic: duplicated raw values, two spacing scales, forked copies of a component.
3. Accessibility: missing names, suppressed focus, contrast failures, unreachable controls.
4. Responsive: overflow, content hidden with no named alternative, targets lost.
5. Behavioral: no recovery path, destroyed input, missing progress feedback.
6. Aesthetic: dated treatment with no functional cost.

Rank by what a user cannot do. Aesthetic debt alone does not justify opening a surface.

## Decision per surface

Record exactly one of four decisions per inventory surface, with one line of reasoning.

- Preserve: it works, so it stays out of the diff.
- Change: same structure and behavior, new visual treatment.
- Replace: a new implementation of identical guarantees, with the migration path named.
- Remove: deleted, with a statement of where the capability now lives or why it is gone.

An undecided surface is out of scope. `Remove` requires the user's explicit approval (`ask_question`, recommended default: keep).

## Staged sequence

Order the work so the product ships at the end of every stage.

1. Land tokens and primitives with no visual change and prove parity.
2. Migrate one low-traffic route end to end as the pattern the rest copy.
3. Migrate remaining routes in traffic order, one route per stage.
4. Keep behavioral fixes in their own stages, apart from visual stages.
5. Delete the superseded path after its last consumer moves.

A stage that cannot ship alone is too large. Split it.

## Parity list

These hold at every stage boundary. Check the captured baseline, and leave memory out of it.

- Every task completable at baseline completes in the same or fewer steps.
- URLs, deep links and query parameters resolve to the same surfaces.
- Data meaning, units, precision, sort order and permissions are unchanged.
- Keyboard reach, focus order and accessible names are equal or better.
- Every baseline state still exists and stays reachable.

A surviving break is a defect until an owner accepts it in `accepted_exceptions` with an expiry.

## Settling a design debate

Time-box the argument and end it in a written decision.

1. Restate the disagreement as a question about a user outcome.
2. Put at most two options on the table, each with its cost named.
3. Settle it with the baseline, a measurement or a rule in the contract.
4. After two rounds, take the reversible option, log the other as an owned assumption, and reopen on new evidence only.

## Regression guards

Add the guard in the same stage as the change it protects.

- Keep existing assertions passing; a rewritten assertion hides the regression.
- Add one test per behavioral fix that fails against the baseline.
- Recapture each migrated route at both widths and compare it with the baseline folder.
- Re-run the accessibility, build and lint gates every stage.
- Run the interface probe every stage. A HIGH that the baseline lacked is a regression the stage introduced.

## Closeout

Close when the record is complete.

- Every surface carries one of the four decisions plus matching evidence.
- The parity list holds, or each break has an owner and an expiry.
- The final artifact reached the independent review pass bound to the design contract hash.
- The receipt states `PASS`, `FAIL` or `BLOCKED` and names unresolved deviations.

## Worked example

A billing app moves from a hand-rolled stylesheet to tokens. Debt map: systemic (three spacing scales), accessibility (focus rings suppressed on buttons), aesthetic (dated shadows). Decisions: invoice list Change, invoice detail Replace (the form fields adopt the shared input primitive), legacy export dialog Preserve. Stage 1 lands tokens with a pixel-identical render (probe table before and after matches). Stage 2 migrates the settings route. Stage 3 migrates invoice list, then detail. The focus-ring fix ships in its own behavioral stage with a failing-first test. Closeout records one accepted exception: the export dialog keeps the old stylesheet until the Q1 rewrite, owner named, expiry dated.

## Failure patterns

Reject:

- editing before the baseline is captured
- "modernize it" accepted as a scope statement
- one branch that migrates every route at once
- a failing test rewritten to match the new implementation
- a redesign called done while one route still renders the superseded system

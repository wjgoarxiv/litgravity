# Evidence and review

Record what the interface did. What it was built to do belongs to the code. The context that implemented a change prepares observations that another context can re-run, and the independent lane (`visual-qa`) issues the verdict.

## Why the builder cannot review

The context that wrote the code walks the path it designed, and that knowledge hides defects.

- You know which input the validator accepts, so you rarely type the other one.
- You read hierarchy from the component tree, where a user reads it from the rendered page.
- A state you skipped feels out of scope and stays untested.

The probe table and the notes below are the builder's evidence. Acceptance is a second claim made by a second context with the contract hash in hand.

## Heuristic pass

Walk each surface once against named heuristics and record hit or miss per item.

1. Visibility: the current state is legible without acting.
2. Vocabulary: labels use the user's words, with internal identifiers kept out.
3. Reversibility: costly actions are undoable or explicitly confirmed.
4. Recovery: every error names its cause and the next action.

## Cognitive walkthrough

Take one critical task and answer four questions at every step. A "no" is a finding.

1. Will the user know what to do at this step?
2. Is the required control visible and recognizable as a control?
3. Will they connect that control to the outcome they want?
4. After acting, will they see that progress happened?

## Optional narrative check

Two advisory questions inspect implied narrative and progression:

- What semantic feel should the composition keep across states and changes?
- What should the user understand first, next, and after the task completes?

These questions are prompts for the notes and add no schema fields. The check assigns no rendered verdict. Record the decisions that make the answers reviewable: the composition rationale, token reuse or the justified change, relevant states, responsive transformations, motion and reduced-motion behavior, honest content and provenance limits, observable acceptance criteria, and the evidence handoff fields (hashes, source state, inventory, commands, artifacts, blockers, cleanup). External source material stays evidence. `visual-qa` owns rendered evidence and verdicts, and `v1alpha1` contracts are diagnostic-only.

## Observation record

Every observation carries these fields. A missing field voids it.

- Route or surface, immutable source identity, viewport or terminal size.
- Product state, input fixture, repeatable action sequence.
- Expected result written before acting, then the literal observed result.
- Artifact path and the capability that produced it.

Keep the records under `.litgravity/evidence/<slug>/`, one file per scenario class or one table with a row per observation.

## Scenario classes

Exercise each class or mark it not applicable with a reason.

1. First run and empty data.
2. Primary success path.
3. Partial, malformed or missing input.
4. Slow response and pending state.
5. Failure, recovery and permission denied.
6. Destructive confirmation and cancel.
7. Long content, overflow, truncation.
8. Localized and mixed-script copy.
9. Keyboard only, reduced motion, narrowest width.

## Finding format

One finding per defect, written so another context reproduces it unaided.

- Severity: `P0` blocks the task, `P1` breaks a requirement, `P2` degrades, `P3` is polish.
- Claim: one line naming the surface and the broken behavior.
- Reproduction: state, viewport, ordered steps, observed result.
- Pointer: artifact path or command output, plus whether the defect lives in the product, the evidence or a capability.

An open `P0` or `P1` is a blocker with its own line in the reply, and an advisory note would understate it.

Probe findings map onto this ladder: a HIGH from the review table is at least P1.

## Accessibility review

Check operability. Appearance is a separate observation. Each item below is its own record.

- Reach every interactive element by keyboard in a predictable order.
- Confirm visible focus everywhere, dialogs and virtualized lists included.
- Confirm each programmatic name matches its visible label.
- Confirm errors bind to their field, preserve input and carry more than colour.

## Handoff package

Assemble exactly this, then stop. The package carries no suggested verdict.

- The design contract SHA-256 and the source identity under review.
- One observation record per exercised inventory item.
- Findings with severity, pointer and reproduction.
- Each scenario class marked exercised, not applicable or blocked.
- Artifact paths, the commands that regenerate them, and unavailable capabilities.

Couple both sides on the contract hash and the evidence manifest schema. A package that validates against neither is not ready for review.

## Shipping verdict

Three values exist, and the independent review pass assigns them.

- `PASS`: every class exercised or excused, no open `P0` or `P1`, evidence fresh.
- `FAIL`: a reproducible defect exists; name the finding and its artifact.
- `BLOCKED`: proof is impossible now; name the missing capability and what restores it.

`BLOCKED` is a separate state from a gentler `FAIL`, and a rerun turns neither into `PASS`.

## Failure patterns

Reject:

- a verdict written by the context that implemented the change
- a finding with no reproduction steps
- a happy-path capture offered as state or accessibility coverage
- evidence bound to a source identity other than the artifact under review
- review re-run until the verdict changes while the artifact stays untouched

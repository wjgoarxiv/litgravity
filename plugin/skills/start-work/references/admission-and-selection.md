# Admission and plan selection

The full steps behind Phases 1 and 2 of `SKILL.md`. Nothing is edited until admission ends.

## Selecting the plan

1. An argument names the plan (slug, partial file stem or path): use it.
2. Otherwise search `plans/` for files containing `- [ ] `. A partly ticked plan this conversation started is the resume target, and a single qualifying plan is used.
3. Several candidates: list each with ticked over total and its `Status`, and ask which one with `ask_question`. A headless run picks the most recently modified candidate and logs the default as a `decision`.
4. No unticked rows anywhere: run `check-plan.mjs --complete` on the newest plan, report that every plan is complete and stop.
5. One active plan per run. A second plan waits for this one to finish or for an explicit switch.

## Admission checklist

1. **Read.** `read_file` the whole plan. Note Scope, Must have, Must NOT have, Bootstrap (PIN facts, dirty paths to leave alone, approvals withheld), Verification strategy, the dependency matrix, the Commit strategy and the first open row whose dependencies are ticked.
2. **Structure check.** `check-plan.mjs --check plans/<slug>.md`. A failure is `BLOCKED` with the checker's lines, because execution never starts on a plan whose rows the tooling cannot see. For a risky or large plan, recommend `review-work` in plan mode when no `decision` line records a plan-review `PASS`, and proceed once the user declines or the review passes.
3. **Approval.** Apply the approval-state table in `SKILL.md`. The approving fact is the user's own message in this conversation or the `Status` header that `lit-plan` wrote after the user's okay.
4. **Resume reread.** When the ledger or the evidence folder already holds work for this slug, reread the ledger tail, the goal record, the evidence files, `git status --short` and `git log --oneline -5`. Earlier green output is stale unless its artifact exists and names its command and an exit line. Every ticked row needs an evidence line and its files; a ticked row without them is reopened by editing the box back to `- [ ]` and recording a `note` that says why. Gates the ledger records as passed on unchanged inputs are not repeated.
5. **Pin.** Write one ledger `note` with the plan path and a revision marker (size and mtime, or `git hash-object`), the branch, HEAD, the dirty paths to leave alone, the approvals granted and the first row. Write the same facts to `.litgravity/evidence/<slug>/pin.txt`. Drift between the plan's PIN facts and reality (a moved file, a bumped dependency) is reconciled read-only first, and a drift that changes the method returns to the user.
6. **Baseline.** Run the plan's gate commands once and save `baseline.log` with each command line, working directory, exit status and counts. A red baseline is recorded as a `note` and later rows compare against it. A failure that may predate the run is classified after the same command fails on a clean checkout of the base revision: `git worktree add`, run, remove.
7. **Goal.** Read `.litgravity/goals/<slug>.json`. An active record is kept. A missing record is created from the plan's Goal block by the `litgoal` rules, with criteria taken from Must have and the Success criteria list. The host's goal tool, when agy offers one, follows `../litgoal/references/host-goal-binding.md`. The record decides, and an unavailable or rejected host call is reported once while the run continues on the record.
8. **Checklist.** agy has no todo tool, so the plan file is the checklist. Keep a one-line "now doing row N" note at the top of `pin.txt` and update it when the row changes.
9. **Worktree decision.** Stay in the current checkout unless the user asked for a separate worktree, the plan calls for destructive test setup, or parallel rows need isolation. A worktree is named, based on a recorded revision, owned by the run and removed with a receipt at the end.

## Row classification

LIGHT is the default: a narrow change inside an existing layer with one real-surface proof. HEAVY applies on a fact you can point to:

- a new module, abstraction or domain model;
- auth, permissions or session handling;
- an external integration;
- a schema or migration;
- concurrency, locking or cache invalidation;
- a refactor across modules;
- release-facing or hard-to-revert artifacts;
- three or more files;
- a plan or a user that asked for rigor.

When unsure, HEAVY. A HEAVY fact that surfaces mid-row upgrades the row and the skipped gates are redone. Tiers only go up.

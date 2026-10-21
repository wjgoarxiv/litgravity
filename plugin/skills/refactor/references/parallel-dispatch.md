# Parallel dispatch for file-independent steps

This reference refines Phases 5 and 6 of `refactor`. It adds no authority: one orchestrator (the main conversation) owns the plan, the verification and every commit, and children carry out bounded edits or read-only analysis. agy has no wait or result-reading tool for children. A child reports with a message when it finishes, so the orchestrator keeps its own work moving and reads each message as it arrives. Follow-up goes through `send_message`.

## When to parallelize

Parallel work pays off for three or more steps that touch different files and have no ordering between them. Fewer steps, or steps linked by a shared symbol, run sequentially in dependency order. A headless run may lack `invoke_subagent` permission or the agents themselves; sequential execution is the fallback and the report says so.

## Plan requirement

Ask `lit-planner` (or write it yourself) to append a Parallelism Analysis to the plan:

```text
Parallelism Analysis
- total_atomic_steps: integer
- file_independent_steps: integer (parallelizable, no cross-file blocker)
- cross_file_dependent_steps: integer (has blockers)
- per_step_class: [{step_id, class: mechanical | reasoning, blockedBy: [step_ids], rationale}]
- dispatch_recommendation: parallel-batch | sequential, with the reason
- rationale for the grouping
```

`mechanical` means rename, extract variable, inline, simple move, or a signature change without call-site logic. `reasoning` means logic-preserving work that needs thought: extract function, restructure a conditional, pattern transformation, cross-file API change. Recommend `parallel-batch` when `file_independent_steps` is at least 3, otherwise `sequential`. When a field is missing, send the plan back asking for the exact missing field names. Batching from a partial plan guesses at independence, and a wrong guess shows up as a merge collision.

## Preconditions

All three hold, or the batch does not start:

1. Every batched step is file-independent (empty `blockedBy`). Steps with blockers run sequentially in dependency order.
2. No two children in one batch touch the same file. Children share no state, and overlapping edits race.
3. Each child brief is self-contained. A child sees none of this conversation, so the brief inlines the step, files and line ranges, rollback, codemap summary, constraints and established patterns.

## Child authority

- Edit lanes use `lit-executor` (`TypeName` set). It can write files, so the brief lists the files it may touch and forbids commits, test-suite runs and files outside the list.
- Read-only lanes (mapping importers, reviewing a diff, reading docs) use `lit-planner`, `librarian-researcher`, `quality-reviewer` or `lit-verifier`.
- A spawn without `TypeName` makes a general-purpose child with every tool, including shell and file writes. Every spawn in this skill names its type.
- A child never commits, publishes, runs destructive git or widens scope. Those stay with the orchestrator and need the user's separate authorization.

## Child briefs

**Mechanical step.** Apply the step verbatim with no scope expansion. Run the checker CLI on the touched files. Return the files touched, the diagnostics status and a diff summary. The suite and the commit belong to the orchestrator.

**Reasoning step.** Read the plan step carefully. Preview any structural rewrite first, review the preview, then apply. When the step is ambiguous or needs out-of-scope changes, return `UNCLEAR` with the reason instead of guessing. Return the files touched, the diagnostics status and a diff summary. Leave the suite to the orchestrator.

Both briefs end with the same closing line: "Reply with your report as one message; the files in this list are the only files you may change."

## After the children report

Account for every child. The orchestrator owns verification.

- Run the verification yourself, or start a read-only `lit-verifier` whose brief inlines the touched files and the verify commands and asks for `PASS` or `FAIL:<failing test, specific error, suggested revert hunks>`. A checkpoint commit waits for PASS.
- PASS: make the commit checkpoint for that step (through `lit-commit` when the user wants commits) and proceed.
- FAIL: retry with a fix hint by re-dispatching that single step with the failure inlined. After three FAIL cycles on the same step, stop and report with the evidence.
- UNCLEAR: gather context with a targeted read-only lane and re-dispatch with the clarified brief.
- A child that never reports within the working session is treated as FAIL for its step; check its files with `git status --short` and `git diff` before re-dispatching, because it may have written part of the step.

Child reports are leads. Replay the decisive command (the diagnostics run, the narrow test) in the main conversation before accepting a PASS from a child.

## Closing the dispatch

Proceed to Phase 7 when every batched step is committed or recorded and every paired verification returned PASS. Add a "Dispatch path" line to the summary with batch metrics when the parallel path was used: number of batches, children per batch and verification lanes.

## Worktree isolation

Giving each child its own git worktree lets a risky variant run in parallel with the safe one. Each worktree is created by the orchestrator, named in the child brief, and removed after the comparison. Merge only the variant whose gates pass, and record the losing variant's result in the evidence folder so the choice stays reviewable. Worktree creation and removal are git writes, so they need the same authority as any other git write.

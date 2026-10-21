# autoconference resume: re-entry from the conference ledger

> **How to read this file.** `SKILL.md` loads this contract with `read_file`; it is protocol data and grants no tool by itself. The root conversation is the Chair: it alone writes conference files, appends `conference_events.jsonl`, spends budget and asks the user (`ask_question`; a headless run records the recommended value as a `decision` line where a default is allowed). Children start with `invoke_subagent` and report with `send_message`; the delegation map in `references/agent-prompts.md` gives each role its `TypeName`. Resume re-enters `modes/core.md` at a validated point. It never replays a completed round, only appends to `conference_events.jsonl`, and moves partial artifacts to `interrupted/` instead of deleting them. Recovery detail for each failure shape is in `references/crash-recovery.md`.

Conferences get interrupted: the conversation ends while reports are outstanding, a headless run exits after dispatch, the context is compacted, a machine sleeps, the user cancels. In agy a child that finishes after the root conversation is gone may still have written its namespace files, and its report message may be lost. Resume rebuilds the state from three sources, in this order of trust: files on disk and git state, the conference ledger, and saved `inbox/` reports. Memory of the earlier conversation counts for nothing.

## Recovery protocol

Six steps, in order. Phase 1 work starts only after Step 6 logs `conference.resumed`.

## Step 1: locate the conference

Use the path the user named. Otherwise list candidates, read-only:

```bash
find .litgravity/conference -maxdepth 2 -name conference_events.jsonl
```

Show each candidate with its goal line and last event, and ask which one to resume. Headless with exactly one candidate: take it and record a `decision`. Headless with several: stop with `BLOCKED: more than one conference to resume` and list them.

Required in the directory:

- `conference.md`. Missing: stop. "Cannot resume: conference.md is missing. Start a new one with `lit conference plan`."
- `conference_events.jsonl`. Missing: stop. Without the ledger there is no checkpoint.

Read when present: `conference_results.tsv` (last best metric), every `researcher_<ID>_results.tsv` and `researcher_<ID>_log.md`, `inbox/`, `interrupted/`, poster sessions and reviews.

Refuse a conference directory or any file in it that is a symlink; report it and stop.

**Record:** `conf_dir`, the absolute path.

## Step 2: replay the ledger into a state table

Read the whole file with `read_file`. Parse each line as JSON; a line that fails to parse is reported with its line number and treated as the end of the trusted log (a torn last write is the common cause). Timestamps must not go backwards; a backwards step is a validation error for Step 4.

| Field | Derived from |
|---|---|
| `started` | `conference.started` present, with its approved budget |
| `last_round_started` | highest round in `round.started` |
| `last_round_completed` | highest round in `round.completed` |
| `last_poster_session` | highest round in `round.poster_session` |
| `last_peer_review` | highest round in `round.peer_review` |
| `outstanding` | `child.dispatched` `report_id`s with neither `child.reported` nor `child.failed` |
| `iterations_by_researcher` | `researcher.iteration` count per researcher in the open round |
| `verdict_logged` | `conference.converged`, `conference.stalled` or `conference.budget_stop` present |
| `completed` | `conference.completed` present |
| `budget_used` | rounds completed, `child.dispatched` count, model calls from the latest `round.completed` payload plus later dispatches |

Show a plain summary:

```text
Conference state
  rounds completed:     2 of 4
  last event:           child.dispatched r3-researcher-C at 2026-10-20T11:42:10Z
  outstanding reports:  r3-researcher-B, r3-researcher-C
  verdict logged:       no
  budget used:          rounds 2/4, children 13/25, model calls 47/89
```

## Step 3: recover outstanding reports

For each outstanding `report_id`:

1. **Inbox.** If `inbox/<report_id>.md` exists (saved before the interruption, event not yet written), check its header line and append the missing `child.reported`.
2. **Namespace files.** A researcher with a write tool may have finished its log, TSV rows or worktree commits. Read them. Rows dated after the dispatch timestamp count as that lane's partial output; mark the lane `partial` and record which rows came from disk with no report.
3. **Silence.** Nothing on disk and no report: record `child.failed` with reason `lost on interruption`.

A child from the old conversation may still be running. Resume has no handle on it, so the recovered lane's files are read once, and any later change in that namespace is a sign of a live orphan: stop and ask the user before re-dispatching into the same namespace.

## Step 4: decide the recovery point

| Last trusted state | Recovery point | Action |
|---|---|---|
| `conference.started`, no round | round 1, Phase 1 | create missing files, dispatch round 1 |
| round N started, no iteration recovered | round N, Phase 1 | re-dispatch every researcher for round N |
| round N started, some lanes reported or recovered | round N, Phase 1 partial | re-dispatch only the lanes without a report, each from its last kept state |
| `round.poster_session` N, no review | round N, Phase 3 | dispatch `qa-runner` for open metric claims, then the reviewer |
| `round.peer_review` N, round open | round N, Phase 4 | knowledge transfer from the saved review |
| `round.completed` N | round N+1 | convergence and budget check, then the next round |
| verdict logged, no completion | synthesis | dispatch the synthesizer |
| `conference.completed` | nothing to resume | report the synthesis path and stop |

Then the budget check: compute what the recovery point needs (dispatches and model calls) and compare it with what remains. If the approved budget cannot cover even the synthesizer, the resume goes straight to `BUDGET STOP` reporting. If it covers synthesis but not another round, go to synthesis. A larger budget needs a fresh start gate with `ask_question`; a headless run cannot grant it.

Present the recovery point and ask: "Resume at <point>?" When the user disagrees, ask where they believe the conference stopped and reconcile against the files before going on.

## Step 5: validate state

**Check 1, TSV against ledger.** For each researcher in `conference.md`: the TSV exists; its row count matches the `researcher.iteration` events plus the baseline. Missing TSV with iterations logged: warn and offer to rebuild a minimal TSV from the events. More rows than events: warn that rows may come from an earlier interrupted run, and treat rows after the last ledger-backed row as partial.

**Check 2, worktrees** (metric mode with code changes). Run `git worktree list`. For each expected branch (`conference/researcher-<ID>`, `conference/best`): the worktree exists, `git -C <worktree> status --porcelain` is clean or its changes are explained by a recovered partial lane, and the branch is one this conference created (named in `conference.md` or the events). A worktree the conference did not create is left alone.

**Check 3, staleness.** Hours since the last event. Above 24: warn that dependencies, files or code outside the conference may have changed, and ask whether to resume or start over. Re-run the evaluator dry run on `conference/best` before any metric round resumes; a changed baseline is reported before research continues.

**Check 4, conference.md.** Goal, mode, count, max rounds and the budget counters are present; the Pre-Flight Gate says approved; Shared Knowledge and the Conference Log sections exist. A missing field stops the resume until the user repairs it.

**Check 5, authority.** The original approval covered this conference and its budget. A resume in a new conversation shows the approved budget and the used part, and asks once to continue under it.

**Record:** `validation_warnings` (warnings continue, errors stop).

## Step 6: set partial work aside, then re-enter

### Partial lanes without worktrees

For a lane that was mid-round:

1. Find the last TSV row with status `kept`.
2. Copy every later row to `interrupted/researcher_<ID>_results.r<N>.tsv`, list the moved rows to the user, then rewrite the TSV up to the last kept row.
3. Move any partial log section after that row to `interrupted/researcher_<ID>_log.r<N>.md`.

### Partial lanes with worktrees

For a worktree this conference created:

1. Save the uncommitted diff: `git -C <worktree> diff > interrupted/researcher_<ID>.r<N>.patch`, and list untracked files from `git -C <worktree> status --porcelain` in `interrupted/researcher_<ID>.r<N>.untracked.txt`.
2. Ask the user to approve the reset (headless: stop with `BLOCKED: reset needs approval` and name the worktree).
3. `git -C <worktree> reset --hard HEAD` returns the lane to its last commit, which is its last kept state.
4. Confirm `git -C <worktree> status --porcelain` prints nothing.

Lanes that completed their Phase 1 work need nothing. `conference/best` changes only after a saved peer review; when the interruption came before the review, it stays as it is.

### Log the resume

Append before any dispatch:

```jsonl
{"event": "conference.resumed", "timestamp": "<ISO-8601>", "payload": {"recovery_point": "round 3, Phase 1 partial", "round": 3, "recovered_lanes": ["B"], "failed_lanes": ["C"], "moved_to_interrupted": ["researcher_C_results.r3.tsv"], "budget_used": {"rounds": 2, "children": 13, "model_calls": 47}}}
```

Add a `decision` line to `.litgravity/ledger/<conversation-id>.jsonl` naming the recovery point.

### Re-enter core

Read `modes/core.md` and continue from the matching step:

- **Round N, Phase 1 (full or partial).** Step 6. Re-dispatch only lanes without a report, with the current Shared Knowledge and their reverted state as the start, and new `report_id`s with a suffix (`r3-researcher-C-2`) so the ledger stays unambiguous.
- **Round N, Phase 3.** Step 8. The poster session already exists; dispatch `qa-runner` where needed, then the reviewer.
- **Round N, Phase 4.** Step 9. Parse the saved review and run knowledge transfer.
- **Round N+1.** Step 10. Budget and convergence check, then Step 6 for the next round.
- **Synthesis.** Step 11, with paths to every saved poster session, review, log and TSV.

From there the core protocol runs as written: every phase of every remaining round, inside the remaining budget, until a terminal verdict.

## Three recoveries, worked

**The conversation ended mid Phase 1.** Ledger: `round.started` 3, three `child.dispatched` (A, B, C), one `child.reported` (A). On disk: `inbox/r3-researcher-B.md` exists with a valid header (B reported, the event was never written); C's worktree has two new commits dated after its dispatch and an uncommitted diff. Recovery: append `child.reported` for B from the inbox; mark C `partial`, keep its two commits as its kept state (their TSV rows match), save the diff to `interrupted/researcher_C.r3.patch`, reset after approval, and re-dispatch C as `r3-researcher-C-2` with the remaining iterations of the round.

**A headless run exited after dispatching the reviewer.** Ledger: `round.poster_session` 2, `child.dispatched` `r2-reviewer`, no report; `inbox/` has no review. Recovery point: round 2, Phase 3. The `qa-runner` receipts from before the exit are in `inbox/` and stay valid, so only the reviewer is re-dispatched (`r2-reviewer-2`), one child and one model call from the remaining budget.

**A stale conference with a moved baseline.** Last event five days ago, `round.completed` 1. The evaluator dry run on `conference/best` now prints 49.0 where round 1 ended at 44.1, because a dependency changed underneath. Resume stops before Phase 1, reports the drift with both numbers, and asks the user to choose: restore the environment, re-baseline (every earlier comparison is then labelled as from the old baseline), or close the conference with what round 1 validated.

## Headless resume

A headless run resumes only when the choice is mechanical: exactly one candidate directory, no partial worktree needing a reset, no staleness warning, and a remaining budget that covers the next phase. Everything else stops with `BLOCKED: <the question>` before appending anything, so an interactive resume later starts from exactly the same ledger.

## Resume invariants

- A round with `round.completed` is never re-run.
- `conference_events.jsonl` only grows; nothing in it is edited or deleted.
- Validation (Step 5) always runs; resuming into inconsistent files silently corrupts convergence.
- Partial rows and diffs move to `interrupted/` before any re-dispatch.
- A conference with `conference.completed` is reported as complete and left alone.
- `conference.resumed` is logged before any child is dispatched.
- The remaining budget is the approved budget minus what the ledger shows was used; resume never resets the counters.

## Chaining

```text
resume → core (from the recovery point) → analyze → ship
```

Report after the resumed conference finishes exactly as core mode does, and name in one line what was recovered, what was set aside and which lanes were re-dispatched.

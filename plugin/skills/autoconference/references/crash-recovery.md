# autoconference: crash recovery

A conference can stop anywhere: the root conversation is compacted or restarted, the machine sleeps, a headless run ends on a refused command or before the reports arrive, the user closes the session mid-round. This file tells the root how to find the exact point where the conference stopped and how to continue from it without replaying finished work, inventing missing results or losing partial ones. `modes/resume.md` drives the procedure step by step; this file is its lookup table, one recovery type per phase.

Three facts about agy shape every recovery:

- **Children of a lost conversation are out of reach.** A child started with `invoke_subagent` reports by `send_message` to the conversation that started it. After a restart, the new root cannot message the old children and will not see their reports.
- **A write-capable child may have finished anyway.** A `lit-executor` researcher writes its TSV, log and worktree commits as it goes, so its namespace can hold finished iterations that no report announced. Read-only children leave nothing on disk; their work exists only if their report reached `inbox/`.
- **Trust goes in a fixed order.** Files on disk and git state first, then the conference ledger (`conference_events.jsonl`), then the reports saved in `inbox/`. A summary from the previous conversation or a handoff note counts only as a pointer to those sources.

## Before choosing a type: validate the state

Run these checks with `read_file` and `run_command`. Warnings let the resume continue; errors stop it with `BLOCKED: resume state <check>` until the user repairs the state. Every result goes into the `conference.resumed` payload.

1. **Identity.** `conference.md` names the same slug as the directory, its Pre-Flight Gate is approved, and the first event is `conference.started`. A copied or renamed directory is an error. A symlinked directory or file is an error.
2. **Ordering.** Timestamps only move forward and round numbers rise by one. The first line that fails to parse as JSON ends the trusted log; when it is the last line (a torn append), copy it to `interrupted/events_tail.txt` and continue with the log up to the previous line.
3. **Outstanding reports.** List every `child.dispatched` `report_id` with neither `child.reported` nor `child.failed`. For each: an `inbox/<report_id>.md` whose header line is valid gets its missing `child.reported`; a write-capable lane with rows or commits dated after its dispatch is recovered as `partial`, and the event says the rows came from disk with no report; silence becomes `child.failed` with reason `lost on interruption`.
4. **Live orphans.** A child of the old conversation may still be running. Read each recovered namespace once, note its file sizes and the worktree HEAD, and check again just before re-dispatching into it. Any change in between means a live orphan: stop and ask the user before writing into that namespace.
5. **Row counts.** For every round with `round.completed`, each lane's TSV holds the rows the `researcher.iteration` events say it holds. Rows after the last ledger-backed row belong to the interrupted round. Missing rows in a completed round are an error.
6. **Hashes.** For every file a `child.reported` event listed with a hash, recompute it. A mismatch in a completed round is an error (a finished artifact was edited); a mismatch in the interrupted round marks that lane `partial`.
7. **Worktrees** (worktree mode). `git worktree list` shows the worktrees the `worktree.created` events name, and each branch is one this conference created. A dirty worktree is explained by a recovered partial lane or reported. A worktree the conference did not create is left alone.
8. **Staleness.** Hours since the last event. Above 24, warn that dependencies or code outside the conference may have changed, and re-run the evaluator dry run on `conference/best` before any metric round resumes; a changed baseline is reported before research continues. If the user's branch moved past the conference's start commit, ask whether to continue on the old base (recommended, with the result labelled as targeting it) or start over.
9. **Budget left.** Take the counters from the latest `round.completed` payload and add the dispatches and model calls logged after it. The resumed conference spends only what remains of the approved budget. A larger budget needs a fresh start gate; a headless run cannot grant one.
10. **Authority.** A resume in a new conversation shows the approved budget and the used part and asks once to continue under it (headless: the approval in `conference.md` stands, recorded as a `decision`).

## Finding the stop point

Read the ledger backwards and find the last phase event of the last round:

| Last phase event | Missing | Recovery type |
| --- | --- | --- |
| `conference.started` only | `round.started` | 0, nothing ran: create missing files and start round 1 |
| `round.started` N, with or without `child.dispatched` and some `child.reported` | `round.poster_session` N | 1, interrupted research |
| all Phase 1 lanes closed, a partial `poster_session_round_<N>.md` or none | `round.poster_session` N | 2, interrupted poster session |
| `round.poster_session` N | `round.peer_review` N | 3, interrupted review (re-measurement may be done) |
| `round.peer_review` N | `round.completed` N | 4, interrupted knowledge transfer |
| `round.completed` N, no verdict | `round.started` N+1 | none: run the convergence and budget check, then the next round |
| `conference.converged`, `conference.stalled` or `conference.budget_stop` | `conference.completed` | 5, interrupted synthesis |
| `conference.completed` | nothing | finished: report the synthesis path and offer analyze mode |

A single-researcher conference has no poster session; type 1 then leads straight to type 3.

## Type 1: interrupted research (Phase 1)

**Signs.** `round.started` for round N; some `report_id`s reported, others outstanding (check 3 above settled each one as reported, partial or failed).

**Recovery.**

1. Lanes with a valid report and matching hashes keep their rows and log entries for round N.
2. Partial lanes (rows from disk, no report): keep their rows up to the last `kept` row as the lane's round-N output, labelled `recovered from disk` in the poster session context. Copy later rows to `interrupted/researcher_<ID>_results.r<N>.tsv` and later log sections to `interrupted/researcher_<ID>_log.r<N>.md`, list the moved rows to the user, then rewrite the TSV up to the last kept row.
3. Partial lanes in worktree mode: save the uncommitted diff to `interrupted/researcher_<ID>.r<N>.patch` and the untracked file list to `interrupted/researcher_<ID>.r<N>.untracked.txt`; then, with the user's approval (headless: `BLOCKED: reset needs approval`), `git -C <worktree> reset --hard HEAD` returns the lane to its last commit, which is its last kept state.
4. Failed lanes: a `failed` row for round N in `conference_results.tsv`.
5. Choose, and record the choice as a `decision`:
   - **Dispatch the missing lanes again** for round N with suffixed `report_id`s (`r3-researcher-C-2`), starting from their last kept state with the current Shared Knowledge. Recommended when the round would otherwise lose its quorum.
   - **Close them** and continue to Phase 2 with what exists, when the quorum holds and the budget is tight.

**What stays.** Every reported lane's work, recovered rows, the ledger up to the stop, and the saved partial diffs, which the Reviewer may read as context in a later round.

**Re-entry.** Phase 1 of round N for the re-dispatched lanes, then Phase 2.

## Type 2: interrupted poster session (Phase 2)

**Signs.** Every Phase 1 `report_id` of round N is closed, and `poster_session_round_<N>.md` is missing, or exists without its `round.poster_session` event.

**Recovery.**

1. A poster file that has a section per lane and ends with the Round overview section is complete: append the missing event and continue.
2. A Session Chair report in `inbox/` with no poster file: save the body as the poster file, then append the event.
3. Otherwise move any partial file to `interrupted/poster_session_round_<N>.partial.md` and dispatch the Session Chair (`lit-verifier`) again from its saved prompt in `prompts/`, with a suffixed `report_id`. It holds no state, so the same inputs give an equivalent summary.

**What stays.** All Phase 1 output.

**Re-entry.** Phase 2 of round N.

## Type 3: interrupted review (Phase 3a or 3)

**Signs.** `round.poster_session` for round N, no `round.peer_review`.

**Recovery.**

1. A `qa-runner` report in `inbox/` stands; copy its runs into `remeasure_round_<N>.jsonl` if that step was cut off. Claims without runs need a new re-measurement dispatch.
2. A Reviewer report in `inbox/`, or a `peer_review_round_<N>.md` without its event, is complete when it has a verdict for every candidate finding and the Tally table; then save it and append the event. Otherwise move it to `interrupted/`.
3. Dispatch what is missing, with suffixed `report_id`s: the `qa-runner` lane for unmeasured claims, then the Reviewer (`quality-reviewer`) from its saved prompt with the new values filled in.

**What stays.** Phase 1 and Phase 2 output, saved re-measurement runs.

**Re-entry.** Phase 3a or Phase 3 of round N.

## Type 4: interrupted knowledge transfer (Phase 4)

**Signs.** `round.peer_review` for round N, no `round.completed`. Phase 4 changes several files, so some of them may already carry round N's results.

**Recovery: check, then complete.** Each Phase 4 step checks before it writes (`conference-protocol.md`, section 1), so the root runs them all again:

1. Re-read `peer_review_round_<N>.md`; it is the authority for what was validated.
2. Shared Knowledge: append only validated findings of round N that are missing (match on finding id).
3. Worktree mode: `git log --format='%H %B' conference/best` shows which picks landed; the `-x` trailer `cherry picked from commit <sha>` names each source. Apply only the missing ones. A pick left in progress (`git status` says so) is aborted first and then redone.
4. `conference_results.tsv`: fill only the empty `peer_review_verdict` cells of round N.
5. Conference Log in `conference.md`: add only the missing lane rows for round N.
6. Append `round.completed` with the budget counters.

Phase 4 is completed forward and never rolled back, because each of its writes is already correct on its own.

**Re-entry.** The budget and convergence check after round N.

## Type 5: interrupted synthesis

**Signs.** A verdict event (`conference.converged`, `conference.stalled` or `conference.budget_stop`) with no `conference.completed`. `synthesis.md` or `final_report.md` is missing or ends mid-section.

**Recovery.**

1. A Synthesizer report in `inbox/` holds both documents: save them.
2. A complete pair on disk (every section heading present) needs only the remaining steps.
3. Otherwise move partial files to `interrupted/` and dispatch the Synthesizer (`lit-planner`) from its saved prompt, or build the prompt fresh from `agent-prompts.md`, Role 6. The budget check keeps one child in reserve for exactly this.
4. Then the worktree question (`conference-protocol.md`, section 5), the `review-work` pass, and `conference.completed`.

**What stays.** Every round artifact.

**Re-entry.** The synthesis step.

## General rules

1. **Disk, then ledger, then inbox.** A claim that none of the three supports did not happen.
2. **Finished artifacts are never rewritten.** Files carry their round number in the name, so a recovery creates the missing ones and leaves the others alone.
3. **Partial work is set aside.** Anything from the interrupted step moves into `interrupted/` with its round and lane in the name. Recovery deletes nothing, and analyze mode reads `interrupted/` to report what was lost.
4. **Stateless roles are dispatched again with the saved prompt.** The Session Chair, Reviewer, re-measurement lane and Synthesizer read inputs and return text; the saved prompt in `prompts/` reproduces their input exactly.
5. **Researchers resume from their last kept row.** The last `kept` or `baseline` row in a lane's TSV is its state; in worktree mode the lane's last commit, or `conference/best` after a reset, is the code state.
6. **Results come from evidence.** A lane whose round left neither a report nor rows on disk has an empty result for that round. Every row the root writes traces to a report, a file or a receipt, and memory or a previous conversation's summary is no source.
7. **New dispatches get new ids.** A suffixed `report_id` keeps the ledger unambiguous when a late report from the old dispatch turns up after all.
8. **Budget carries over.** A resumed conference spends from what remains; when that cannot cover the recovery point, it goes to synthesis or straight to a `BUDGET STOP` report.
9. **Every recovery is logged before any dispatch.** One `conference.resumed` event with the recovery point, recovered and failed lanes, the files moved to `interrupted/` and the budget used; one `decision` line in `.litgravity/ledger/<conversation-id>.jsonl` in plain words.

## Cancel and pause, so the next resume is easy

- **Cancel.** Send every running child a stop request with `send_message` and save any report that arrives while you write. Append `conference.cancelled` with the outstanding `report_id`s and the budget used, and write a ledger note starting `CANCELLED:` so the Stop hook releases the turn. Leave worktrees in place and list them.
- **Pause** (`pause_every`, or the user asks to stop for now). Finish the current phase, append `conference.paused` with the next round number and any outstanding `report_id`s, and write a ledger note starting `PAUSED at row <N>:` with the round number. A later `lit conference resume` enters `modes/resume.md`, which finds a clean stop point after `round.completed`.
- **A headless run about to end with reports outstanding.** Make sure every `child.dispatched` event is written and `conference.md` reflects the last completed phase, then report `BLOCKED: reports outstanding` with the `report_id`s. Type 1 recovers them later.

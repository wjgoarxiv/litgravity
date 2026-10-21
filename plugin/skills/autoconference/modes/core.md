# autoconference core: the full conference protocol

> **How to read this file.** `SKILL.md` loads this contract with `read_file`; it is protocol data for the skill and grants no tool by itself. The root conversation is the Conference Chair. It alone writes `conference.md`, the TSV files, `conference_events.jsonl` (the conference ledger), poster sessions, reviews and the synthesis, and it alone talks to the user through `ask_question`. Every other role is a child started with `invoke_subagent` (`TypeName`, `Prompt`, `Role`) that reports back with one `send_message`. There is no wait or read-result tool: reports arrive as messages, the Chair saves each one to `inbox/<report_id>.md`, and the phase closes when every dispatched `report_id` has a report or a recorded failure. The delegation map in `references/agent-prompts.md` fixes the `TypeName` per role. State lives in `.litgravity/conference/<slug>/` (CONF_DIR) unless the user names another directory. If `invoke_subagent` is missing, stop with `BLOCKED_MULTI_AGENT_UNAVAILABLE`; if a required agent type is refused, stop with `BLOCKED: agent <TypeName> not available`.

## Pre-flight (mandatory)

Phase 1 of round 1 starts only after the start gate below has an explicit yes. Defaults the user has not seen and approved are never used to start.

### The start gate: inputs, conditions, confirmation

Required inputs:

- **Researcher count.** An exact integer, 1 to 6. Two suits an A/B comparison, three is the recommended balance, four to six suit a broad space and cost proportionally more.
- **Iterations.** `iterations_per_round` and `max_rounds`, or an exact `max_total_iterations` from which both are derived.
- **Budget counters.** `children` (the total number of `invoke_subagent` calls allowed) and `model_calls` (researcher iterations plus every child turn the Chair requests, including nudges and debate relays). Recommended starting values: `children = max_rounds × (researcher_count + 3) + 1` (researchers, Session Chair, reviewer and one `qa-runner` per round, plus the synthesizer) and `model_calls = max_total_iterations + children + max_rounds` (one nudge allowance per round). Show the arithmetic.
- **Time.** `time_budget` for the whole conference and `researcher_timeout` per lane per round (default `time_budget / max_rounds`, shown before approval).
- **Success definition.** Metric mode: metric name, target and direction, plus an evaluator command. Qualitative mode: explicit Success Criteria.
- **Devil's Advocate.** Yes or no. The adversarial reviewer runs every round regardless of this answer.

Gate behavior:

1. With every input exact, compute `researcher_count × iterations_per_round × max_rounds = max_total_iterations`, show researcher count, the three counters, time limits, the success definition, the Devil's Advocate setting and the read, write and execute roots, then ask with `ask_question`: "Proceed with these conditions?" Offer `Proceed`, `Change values` and `Cancel`.
2. With any input missing or vague, ask for exact values first (each question carries a recommended value), recompute, and ask for the final confirmation.
3. Only an explicit yes continues to STARTUP. "Use the recommended values" counts once the values were on screen. Record the answer as a `decision` line in `.litgravity/ledger/<conversation-id>.jsonl` and set `**Final confirmation:** approved <date>` in the Pre-Flight Gate section of `conference.md`.

A headless run (`agy -p`) cannot answer `ask_question`. It continues only when the prompt itself states every value and the word approved; otherwise it stops with `BLOCKED: budget not approved` and lists the values to approve.

### Remaining setup questions

Ask these after the gate, or confirm them when `conference.md` already answers them.

**Devil's Advocate role.** When enabled, one researcher slot (by convention the last) pursues contrarian strategies: it tests the assumptions the others share, tries the opposite of the obvious move, and is judged by the blind spots it exposes more than by its own metric. The brief comes from `references/agent-prompts.md`, section Devil's Advocate.

**Pauses.** `pause_every: never` runs every round inside this conversation without stopping. `pause_every: N` stops after the peer review of every Nth round and asks for feedback with `ask_question`. There is no detached loop and no shell background job: the conference needs a live root conversation to receive child reports. Progress is visible at any time with `bash "<skill-folder>/scripts/check_conference.sh" <CONF_DIR>` or by reading the tail of `conference_events.jsonl`.

**Partitioning.** `assigned` (recommended) gives each researcher its own focus area, so coverage grows and overlap shrinks. `free` gives everyone the full space, which buys competition at the cost of redundancy.

## When the format pays off

Use a conference when the search space is wide enough that partitioned lanes cover more than one lane in sequence, when strategies are likely to inform each other, when self-evaluation has blind spots that an outside reviewer catches, and when combining findings beats choosing a winner. A single `autoresearch` loop covers small spaces and problems with one obvious approach; work without a metric or criteria goes to `plan` first.

## The conference.md format

Start from `assets/conference_template.md`, a file in `templates/`, or `python3 "<skill-folder>/scripts/init_conference.py"` (standard library only).

| Section | Purpose |
|---|---|
| Goal | What to achieve, specific and checkable |
| Mode | `metric` or `qualitative` |
| Success Metric | name, target, direction (metric mode) |
| Success Criteria | the reviewer's rubric (qualitative mode) |
| Researchers | count, iterations per round, max rounds |
| Pre-Flight Gate | the values shown at the gate and the confirmation state |
| Budget | rounds, children, model calls, time budget, researcher timeout |
| Search Space | allowed and forbidden changes, passed verbatim to every researcher |
| Search Space Partitioning | `assigned` with one Focus section per researcher, or `free` |
| Guard | a safety invariant; any change that breaks it is reverted whatever its metric |
| Noise Handling | evaluator repeats and the minimum consensus delta |
| Current Approach | the baseline |
| Shared Knowledge | validated findings, appended by the Chair each round |
| Conference Log | one row per researcher per round, maintained by the Chair |

## Orchestration protocol

### STARTUP

**1. Read conference.md.** Parse every section. Missing or invalid required fields stop the run with a list of what to fix. `**Final confirmation:** pending` is a hard stop: summarize the gate and ask.

**2. Validate.** `mode` is `metric` or `qualitative`; `count` ≥ 1; metric mode has name, target, direction and an evaluator that passed its dry run; qualitative mode has non-empty criteria; `max_rounds`, `max_total_iterations`, `children` and `model_calls` are positive integers; the reserved synthesizer dispatch fits inside `children`.

**3. Decide on worktrees.** Metric mode with code changes uses per-researcher git worktrees (`conference/researcher-<ID>`) and a `conference/best` branch, created outside the user's checkout. Prompt-only, config-only and qualitative conferences isolate by file namespace. The lifecycle is in `references/conference-protocol.md`, section 5.

**4. Initialize files.** For each researcher ID in `A, B, C, …`: `researcher_<ID>_log.md` with a header and `researcher_<ID>_results.tsv` with the header and baseline row. Create `conference_results.tsv` (header only), `inbox/`, and an empty `conference_events.jsonl`, then append `conference.started` with mode, researcher count and the approved budget.

**5. Partition.** `assigned` reads each Researcher Focus section; `free` gives every researcher the full space.

### ROUND LOOP

**6. Phase 1, research (parallel).** Before dispatch, check that `children_used + researcher_count` and the projected model calls stay inside the budget; when they do not, skip to SYNTHESIS with `BUDGET STOP`. Append `round.started`, then in one turn append a `child.dispatched` event and call `invoke_subagent` for each researcher: `TypeName` from the delegation map (`lit-executor` for code or config work in its own worktree, `librarian-researcher` for literature and analysis), `Role` `researcher-<ID>`, and a `Prompt` that carries:

- the five-stage inner loop (understand, hypothesize, experiment, evaluate, log) from `autoresearch`;
- this researcher's partition, or the full space under `free`;
- Allowed Changes, Forbidden Changes and the Guard, verbatim;
- Shared Knowledge so far (empty in round 1), copied into the brief, since the child cannot read other lanes;
- its log and TSV paths, or the instruction to return rows as text when its type has no write tool;
- its worktree path in worktree mode;
- `iterations_per_round` and the per-experiment timeout;
- the evaluation rule: the evaluator command in metric mode, a 1 to 10 self-score against the Success Criteria in qualitative mode;
- on the last round, the line `ENDGAME: exploit what works; no new directions`;
- the report contract: finish with one `send_message` to the root, first line `REPORT <slug> r<N>-researcher-<ID> <done|partial|blocked>`, then best result, kept and reverted iterations, rows, a diff summary and open questions.

Then keep moving: update the Conference Log row stubs, prepare the poster-session input list, and end the turn with the outstanding `report_id`s when nothing else is left. As each report arrives, save it to `inbox/`, append `child.reported` and one `researcher.iteration` event per reported iteration, check rows against the researcher's TSV or worktree (the Chair appends rows a read-only lane returned as text), and note any mismatch as `unverified`. A lane silent past `researcher_timeout` gets one `send_message` nudge; still silent at the next check it becomes `child.failed` and a `failed` row in `conference_results.tsv`. The phase closes when every dispatched researcher has a report or a failure. A failed researcher is re-dispatched next round from its last kept state.

After Phase 1, refresh `conference_progress.png`: one line per researcher (iteration against metric), a best-of-conference envelope and the target line, Okabe-Ito colours, a single panel, written by a small script that calls `rcparams()` from `scripts/style_presets.py` and runs through the `sciviz` engine of `lit-scientific-visualization` (`node "<skills-dir>/lit-scientific-visualization/scripts/sciviz-runtime.mjs" run -- <script>`). Rules are in `references/visualization-guide.md`. When the engine is not ready, skip the figure, note it, and keep the round going.

**7. Phase 2, poster session.** Dispatch one Session Chair child, `TypeName` `lit-verifier` (read-only). Its brief lists every researcher TSV path, the last ten log entries per researcher (summaries keep the context small), worktree diff summaries in worktree mode, and asks for a per-researcher summary: approach, iterations run, best result, key findings, notable failures. It returns the text by `send_message`; the Chair saves `poster_session_round_<N>.md` and appends `round.poster_session`.

**8. Phase 3, adversarial peer review.** For every metric claim that would change Shared Knowledge, first dispatch `qa-runner` to re-run the evaluator in that researcher's worktree with the noise-run count, and save its receipt (command, stdout, exit status) under `inbox/`. Then dispatch one reviewer, `TypeName` `quality-reviewer` (read-only), with the poster session text, the Success Metric or Criteria, the receipts, read-only diff output the Chair produced (`git diff --stat conference/best conference/researcher-<ID>`), and the instruction to challenge every claim for overfitting, noise, invalid comparison and logical gaps, assigning `validated`, `challenged` or `overturned` with a reason. A review that only read the researcher's own account counts as unreviewed. The Chair saves `peer_review_round_<N>.md` and appends `round.peer_review`.

**9. Phase 4, knowledge transfer.** Append every `validated` finding to Shared Knowledge in `conference.md`. In worktree mode, cherry-pick validated commits onto `conference/best` (conflict rules in `references/conference-protocol.md`, section 5). Fill `peer_review_verdict` in `conference_results.tsv`, add the Conference Log rows, and append `round.completed` with the best metric, the convergence state and the budget used so far.

**10. Budget and convergence check.** Details in `references/conference-protocol.md`, section 2, and `references/convergence-guide.md`.

| Condition | Verdict |
|---|---|
| Target reached and validated | TARGET_REACHED |
| Metric mode: best metric unchanged for 2 consecutive rounds | CONVERGED |
| Qualitative mode: every output scored ≥ 8/10 by the reviewer for 2 consecutive rounds | CONVERGED |
| `max_rounds`, `max_total_iterations`, `children`, `model_calls` or `time_budget` reached | BUDGET STOP |
| Every researcher at stuck level 2 or worse in the same round | STALLED, early synthesis |

On any verdict, go to SYNTHESIS. When the next round is the last, put the ENDGAME line in its briefs. Otherwise honor `pause_every`, increment the round and return to step 6.

### SYNTHESIS

**11. Synthesizer.** Dispatch one `lit-planner` child (read-only) with the paths to every `poster_session_round_*.md`, `peer_review_round_*.md`, researcher log and TSV, the Goal, the Success Metric or Criteria, and `assets/synthesis_template.md` and `assets/report_template.md`. It combines complementary validated findings across researchers, records dissent and overturned claims, and returns the text of `synthesis.md` and `final_report.md`. The Chair saves both. This dispatch was reserved at the gate, so a budget stop still reaches it.

**12. Worktree disposition** (worktree mode). Ask with `ask_question`, no default: merge `conference/best` into the original branch (the Chair prints the exact command; the user decides and nothing is pushed), keep the worktrees for inspection, or delete the worktrees and branches this conference created (listed first). Headless runs keep them and say so.

**13. Completion.** Append `conference.completed` with links to the synthesis and the report, run `review-work` over changed files and worktrees, then report rounds run, iterations, children and model calls used, best validated result, dissent and the synthesis path. Offer `lit-recap` or `lit-handoff`.

## Turns, pauses and silence

The Chair works in turns. A turn that dispatched children ends with a status line once there is no root work left, and the children's reports start later turns. Three situations need a rule.

**A turn ends with reports outstanding.** Before ending it, the Chair makes sure the ledger already holds every `child.dispatched` event and that `conference.md` reflects the last completed phase. The status line names the outstanding `report_id`s and the deadline implied by `researcher_timeout`, for example: `Round 2, Phase 1: waiting on r2-researcher-B, r2-researcher-C (timeout 11:40).` Nothing else needs saving, because the next turn rebuilds its view from the ledger and `inbox/`.

**The user writes while reports are outstanding.** A status question is answered from the ledger (run `scripts/check_conference.sh` or read the tail of the events) and the conference continues. A correction to scope or budget goes through `ask_question` and a `decision` line before the next dispatch; children already running finish under their original brief, and the Chair discards results that the correction made irrelevant, recording why. A cancel follows step 9 of `SKILL.md`.

**A report arrives for a closed phase.** A late report (after its lane was recorded `failed`) is still saved to `inbox/` and logged as `child.reported` with `"late": true`. Its rows do not enter the closed round; the Chair offers them to the same researcher's next brief as context.

**pause_every.** At a pause the Chair writes the round summary into the Conference Log, appends `conference.paused` with the next round number, and asks with `ask_question`: continue, adjust the focus of some researchers (each change recorded as a `decision`), or stop and synthesize now. Budget changes at a pause need the full gate again. When the question cannot be answered (headless), the conference keeps its `pause_every: never` behavior only if the gate approved that; otherwise it stops at the pause with `BLOCKED: pause needs an answer`, which resume can pick up.

**Headless runs.** In `agy -p` the conversation may end before any child reports. The Chair therefore dispatches only after every file of the phase exists on disk, keeps each brief self-contained (a child must be able to finish and write its namespace without further messages), and reports `BLOCKED: reports outstanding` with the `report_id`s when the run is about to end. Whether a child's `send_message` can still reach a finished headless run is unconfirmed on this build; resume covers both outcomes.

## A round, end to end

A three-researcher metric conference, round 2, assigned partitioning, approved budget rounds 4, children 25, model calls 89.

1. `round.started` (round 2). Budget check: children used 6, plus 3 researchers = 9 ≤ 25.
2. Three `child.dispatched` events, three `invoke_subagent` calls in one turn (`lit-executor` for A and B in their worktrees, `librarian-researcher` for C, whose focus is the literature on the technique A found in round 1). Each brief carries the round 1 Shared Knowledge line "batching the feature lookups cut p95 by 18 % (validated, 5 noise runs)".
3. The Chair updates the Conference Log stubs and ends the turn: waiting on three reports.
4. A reports: four kept, one reverted, best p95 41 ms. Saved, five `researcher.iteration` events, rows checked against the worktree TSV. C reports three papers with a caching idea and no rows to check. B stays silent.
5. At the timeout the Chair nudges B with `send_message`. B answers with `partial`: two iterations, one kept. The phase closes; B's row is `partial`.
6. Session Chair (`lit-verifier`) dispatched with the TSV paths and the last ten log entries; its poster session text arrives and is saved.
7. `qa-runner` re-runs the evaluator five times on A's worktree: p95 42.3 ± 0.8 ms. Receipt saved.
8. Reviewer (`quality-reviewer`) receives the poster session and the receipt. Verdicts: A's batching-plus-prefetch `validated`; B's thread-pool change `challenged` (gain inside noise); C's caching idea `validated` as a hypothesis for round 3, with no metric claim.
9. Knowledge transfer: A's commit cherry-picked onto `conference/best`; two Shared Knowledge lines added; `round.completed` with best 42.3, children used 12, model calls 41.
10. Convergence: best improved this round, budget remains, so round 3 starts with C's hypothesis assigned to B.

## Output files

```text
conference.md                 configuration, Shared Knowledge, Conference Log
conference_events.jsonl       conference ledger, append-only, Chair only
conference_results.tsv        every round, every researcher
conference_progress.png       convergence figure, refreshed each round
researcher_<ID>_log.md        per-researcher iteration log
researcher_<ID>_results.tsv   per-researcher rows
inbox/<report_id>.md          every child report, verbatim
poster_session_round_<N>.md   Session Chair summary per round
peer_review_round_<N>.md      reviewer verdicts per round
synthesis.md                  combined result
final_report.md               summary with the full conference history
```

Column schemas and the event envelope are in `references/results-logging.md`.

## Safety and limits

- **Budget counters.** `max_rounds`, `max_total_iterations`, `children`, `model_calls` and `time_budget` are hard caps checked before every dispatch. The conference stops at the first one reached.
- **`researcher_timeout`.** Per lane per round. Past it, one nudge, then `failed`; the conference proceeds with partial results.
- **Per-experiment timeout.** Each evaluator or build command a researcher runs is wrapped in `timeout 5m` (or the value in `conference.md`). Exit 124 is a timeout: revert that experiment and continue.
- **Rollback.** Researchers revert a non-improving experiment before the next iteration, as in `autoresearch`.
- **Forbidden changes and the guard** go verbatim into every brief. A change that touches either is reverted whatever its metric, and the reviewer marks it `overturned`.
- **No escalation.** Children never commit outside their worktree, push, publish, install dependencies or change host configuration. The Chair never does those either without separate explicit approval.

## Stuck detection

Per researcher, as in `autoresearch`:

- **Level 1, plateau.** Three non-improving iterations in a row: switch to a clearly different strategy.
- **Level 2, deep stuck.** Five in a row: a deep pivot, adopting the Shared Knowledge strategy most unlike the current one. Two more without improvement and the researcher reports `STALLED_L2`; the Chair appends `researcher.stuck` and may reassign its focus next round.
- **Level 3, exhausted.** Seven in a row: the researcher reports `STALLED_L3` and stops its round. The Chair re-dispatches it next round with a strategy drawn from other lanes' validated findings. The conference itself carries on.

Conference level: when every researcher reaches level 2 or worse in one round, append `conference.stalled` and go straight to SYNTHESIS. A level 3 researcher is marked `STALLED` in `conference_results.tsv`.

## Qualitative mode

Without a numeric metric the inner loop uses self-assessment as a proxy:

1. After each iteration the researcher scores its result 1 to 10 against the Success Criteria by asking whether this output satisfies them better than its previous best.
2. That score drives keep or revert inside Phase 1, and it is logged as `metric_value`.
3. The reviewer's score in Phase 3 is authoritative and may overturn any self-assessment.

This trades the mechanical verification of `autoresearch` for reach into literature synthesis, hypothesis generation and design exploration. The independent reviewer compensates each round, and reports label which scores are self-assessed. Details: `references/conference-protocol.md`, section 6.

## Git worktrees

| Mode | Change type | Worktrees |
|---|---|---|
| metric | code | yes, one branch per researcher plus `conference/best` |
| metric | prompt or config only | no, file namespaces suffice |
| qualitative | any | no, researchers produce analysis |

```text
<user's branch>                 left untouched
  conference/researcher-A       per-researcher worktree
  conference/researcher-B
  conference/researcher-C
  conference/best               validated improvements, cherry-picked by the Chair
```

Each round: reset every researcher worktree to `conference/best`, research, cherry-pick validated commits onto `conference/best`. The Chair watches state with `git worktree list` and `git -C <worktree> status --porcelain`. Full lifecycle and conflict handling: `references/conference-protocol.md`, section 5.

## Conference ledger events

`conference_events.jsonl` holds one JSON object per line, appended only by the Chair:

```jsonl
{"event": "conference.started", "timestamp": "2026-10-20T10:00:00Z", "payload": {"researchers": 3, "mode": "metric", "budget": {"rounds": 4, "children": 25, "model_calls": 89}}}
{"event": "child.dispatched", "timestamp": "2026-10-20T10:00:05Z", "payload": {"round": 1, "report_id": "r1-researcher-A", "role": "researcher-A", "type_name": "lit-executor", "namespace": "worktrees/researcher-A"}}
{"event": "child.reported", "timestamp": "2026-10-20T10:14:40Z", "payload": {"round": 1, "report_id": "r1-researcher-A", "status": "done", "inbox": "inbox/r1-researcher-A.md"}}
{"event": "round.completed", "timestamp": "2026-10-20T10:31:00Z", "payload": {"round": 1, "best_metric": 0.82, "children_used": 6, "model_calls_used": 21}}
```

| Event | When |
|---|---|
| `conference.started` | after the gate and file setup |
| `round.started` | each round begins |
| `child.dispatched` | before each `invoke_subagent` |
| `child.reported` | a report arrived and was saved to `inbox/` |
| `child.failed` | silence past the timeout after a nudge, a refusal, or a crash message |
| `researcher.iteration` | one per iteration a researcher reported |
| `researcher.stuck` | a researcher reports level 2 or worse |
| `round.poster_session` | poster session saved |
| `round.peer_review` | review saved |
| `round.completed` | knowledge transfer done |
| `conference.converged` / `conference.stalled` / `conference.budget_stop` | the verdict before synthesis |
| `conference.paused` / `conference.cancelled` | Chair checkpoint with outstanding `report_id`s |
| `conference.resumed` | resume mode re-entered |
| `conference.completed` | synthesis saved |

Anyone can follow progress by reading the tail of the file; `scripts/check_conference.sh` summarizes it. The base envelope and TSV columns are defined in `references/results-logging.md`.

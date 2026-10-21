# autoconference: results logging

The exact shape of every record a conference keeps: the per-lane TSV, the conference TSV, the events log, the re-measurement receipts, the ledger lines in the agy conversation ledger, and the layout of the conference directory. Scripts, analyze mode and a resumed root all read these files, so the column names and event names below are a contract. Write them exactly.

Only the root writes the shared files. A write-capable `lit-executor` Researcher writes its own lane TSV and log; a read-only lane returns its rows as text in its report and the root appends them.

## The conference directory

```text
.litgravity/conference/<slug>/
  conference.md                    configuration, Shared Knowledge, Conference Log
  conference_results.tsv           every lane, every round, with review verdicts
  conference_events.jsonl          append-only event stream
  conference_progress.png          progress figure, redrawn each round
  baseline_runs.tsv                the noise-floor runs from the start gate
  researcher_<ID>_log.md           one per lane, iteration notes
  researcher_<ID>_results.tsv      one per lane, iteration rows
  poster_session_round_<N>.md      one per round
  peer_review_round_<N>.md         one per round
  remeasure_round_<N>.jsonl        re-measurement runs, when Phase 3a ran
  inbox/                           every child report, verbatim, as <report_id>.md
  prompts/                         every filled prompt, as <report_id>.md, saved before dispatch
  diffs/                           per-lane diffs for the Reviewer (worktree mode)
  interrupted/                     partial artifacts set aside by cancel or resume
  synthesis.md, final_report.md    after the last round
  analysis-report.md, debate-report.md, survey-report.md, ship-log.md   mode outputs
```

Slugs are lowercase kebab-case, at most 40 characters, taken from the goal (`api-latency-p95`, `caching-survey`). The directory sits under the workspace's `.litgravity/` unless the user named another one at the start gate.

## 1. Lane TSV: `researcher_<ID>_results.tsv`

One file per lane, tab-separated, header on the first line. Rows are appended; none is edited after it is written.

| Column | Type | Meaning |
| --- | --- | --- |
| `round` | int, from 1 | the conference round |
| `iteration` | int, from 0 | iteration inside the round; 0 is the round's baseline row |
| `metric_value` | number | the measured value, or the self-score 1 to 10 in qualitative mode |
| `delta` | number or `-` | change from this lane's round baseline (`-` on the baseline row) |
| `delta_pct` | text | the same change in percent, with sign (`-21.4%`) |
| `status` | enum | `baseline`, `kept`, `reverted`, `failed` |
| `description` | text | the change in one line; tabs and newlines replaced by spaces |
| `evaluator_source` | text | `cmd:<evaluator name>`, `self-assessment`, or `reviewer` |
| `commit` | text or `-` | the worktree commit for a kept change (worktree mode) |
| `timestamp` | ISO 8601 UTC | when the iteration finished |

Example (a lane minimizing p95 latency in milliseconds):

```tsv
round	iteration	metric_value	delta	delta_pct	status	description	evaluator_source	commit	timestamp
1	0	182.4	-	-	baseline	unchanged service	cmd:bench-p95	-	2026-10-20T09:00:00Z
1	1	171.9	-10.5	-5.8%	kept	batch the two profile queries into one	cmd:bench-p95	3f1c2aa	2026-10-20T09:06:00Z
1	2	174.0	-8.4	-4.6%	reverted	raise pool size from 32 to 96	cmd:bench-p95	-	2026-10-20T09:11:00Z
1	3	149.2	-33.2	-18.2%	kept	cache rendered profile fragments for 60 s	cmd:bench-p95	8b07de1	2026-10-20T09:17:00Z
```

Notes:

- The round's first row is its baseline: the lane's starting value for that round, measured, with `status` `baseline`.
- `delta` compares with the round baseline, so a lane's numbers stay readable when a round starts from a better `conference/best`.
- A `failed` row is written by the root when a lane is closed without a report; its `metric_value` is empty and its description names the reason (`timeout`, `malformed report`).
- In qualitative mode the self-score sits in `metric_value`; the Reviewer's authoritative score goes into the conference TSV.

## 2. Conference TSV: `conference_results.tsv`

One file for the whole conference, written only by the root. It holds every lane row of every round, plus the review verdict.

| Column | Type | Meaning |
| --- | --- | --- |
| `round` | int | conference round |
| `researcher` | text | lane ID (`A`, `B`, ...) |
| `iteration` | int | as in the lane TSV |
| `metric_value` | number | as in the lane TSV |
| `delta`, `delta_pct` | number, text | as in the lane TSV |
| `status` | enum | `baseline`, `kept`, `reverted`, `failed` |
| `description` | text | as in the lane TSV |
| `evaluator_source` | text | as in the lane TSV |
| `reviewer_score` | number or `-` | qualitative mode: the Reviewer's 1 to 10 score for the lane's best row of the round |
| `remeasured_value` | number or `-` | the median of the re-measurement runs for this row, when it was re-measured |
| `peer_review_verdict` | enum | `validated`, `challenged`, `overturned`, `-` |
| `timestamp` | ISO 8601 UTC | as in the lane TSV |

Example:

```tsv
round	researcher	iteration	metric_value	delta	delta_pct	status	description	evaluator_source	reviewer_score	remeasured_value	peer_review_verdict	timestamp
1	A	0	182.4	-	-	baseline	unchanged service	cmd:bench-p95	-	-	-	2026-10-20T09:00:00Z
1	A	3	149.2	-33.2	-18.2%	kept	cache rendered profile fragments for 60 s	cmd:bench-p95	-	151.0	validated	2026-10-20T09:17:00Z
1	B	2	176.5	-6.1	-3.3%	kept	gzip level 4 for profile JSON	cmd:bench-p95	-	180.9	challenged	2026-10-20T09:15:00Z
1	C	-	-	-	-	failed	timeout after 25 min	-	-	-	-	2026-10-20T09:30:00Z
2	A	0	149.8	-	-	baseline	round 2 from conference best	cmd:bench-p95	-	-	-	2026-10-20T09:45:00Z
```

### Status values

| Value | Meaning |
| --- | --- |
| `baseline` | the lane's starting point for the round |
| `kept` | the change beat the lane's best by more than the noise floor and stayed |
| `reverted` | the change did not beat it and was undone |
| `failed` | the lane crashed, timed out, sent a malformed report, or the iteration was cut off |

### Verdict values

| Value | Meaning |
| --- | --- |
| `validated` | the Reviewer accepted the claim; it may enter Shared Knowledge |
| `challenged` | plausible, with evidence missing; it waits for a later round |
| `overturned` | the Reviewer rejected the claim, with a reason in the review |
| `-` | not reviewed: baseline and reverted rows, rows that were not offered as findings, or a round still in progress |

## 3. Events log: `conference_events.jsonl`

The conference ledger: one JSON object per line, appended only by the root. Dispatch events are written before the `invoke_subagent` call, result events after the result is on disk. Resume reads this file first, so a missing event costs more than a redundant one.

```json
{"event":"<type>","timestamp":"<ISO 8601 UTC>","payload":{"round":<int, when the event belongs to a round>, ... }}
```

| Event | When | Payload |
| --- | --- | --- |
| `conference.started` | after the start gate | `slug`, `mode`, `researchers`, `goal`, `budget` (every counter), `conversation_id` |
| `worktree.created` | per worktree | `lane`, `path`, `branch`, `base_commit` |
| `round.started` | before Phase 1 | `round`, `lanes` with focus, `endgame` (true on the final round) |
| `child.dispatched` | before each `invoke_subagent` | `round`, `report_id`, `role`, `type_name`, `namespace`, `deadline`, `prompt`, `prompt_sha` |
| `child.reported` | a report was saved to `inbox/` | `round`, `report_id`, `status` (`done`, `partial`, `blocked`), `lane_status`, `inbox`, `files` with hashes, `late` (true after the lane failed), `source` (`message` or `disk` for rows recovered on resume) |
| `child.nudged` | the deadline nudge was sent | `round`, `report_id` |
| `child.failed` | silence after the nudge, a refusal, a crash message, or loss on interruption | `round`, `report_id`, `reason` |
| `child.hash_mismatch` | a listed hash did not match | `report_id`, `path`, `expected`, `actual` |
| `researcher.iteration` | per row the root appends or confirms | `round`, `researcher`, `iteration`, `metric_value`, `delta`, `status` |
| `researcher.stuck` | a lane reports level 2 or 3 | `round`, `researcher`, `level` |
| `researcher.retired` | a level-3 lane with no family left | `round`, `researcher`, `reason` |
| `round.poster_session` | poster session saved | `round`, `path`, `lanes_covered`, `candidates` |
| `round.peer_review` | review saved | `round`, `path`, `validated`, `challenged`, `overturned` |
| `round.review_missing`, `round.failed` | quorum failures | `round`, `reason` |
| `relay.sent` | per relay | `round`, `from`, `to`, `bytes`, `stripped` |
| `merge.conflict` | Phase 4 conflict | `round`, `file`, `winner`, `rule` |
| `merge.regressed` | combined result below the best single lane | `round`, `combined`, `best_single` |
| `round.completed` | end of Phase 4 | `round`, `best`, `best_researcher`, `counting`, `plateau_count`, `budget_used` (`rounds`, `iterations`, `children`, `model_calls`, `elapsed`) |
| `conference.paused` | at a pause | `next_round`, `outstanding` |
| `conference.cancelled` | at a cancel | `outstanding`, `budget_used` |
| `conference.resumed` | resume, before any dispatch | `recovery_point`, `round`, `recovered_lanes`, `failed_lanes`, `moved_to_interrupted`, `warnings`, `budget_used` |
| `conference.converged`, `conference.stalled`, `conference.budget_stop` | the verdict before synthesis | `rule`, `best`, `rounds`, `code` |
| `conference.failed` | two total round failures | `reason`, `partial_report` |
| `conference.completed` | after synthesis and the worktree answer | `synthesis_path`, `final_report_path`, `total_iterations`, `budget_used`, `worktree_choice` |

Example:

```jsonl
{"event":"conference.started","timestamp":"2026-10-20T08:58:00Z","payload":{"slug":"api-latency-p95","mode":"metric","researchers":3,"goal":"p95 below 120 ms on the profile endpoint","budget":{"iterations_per_round":5,"max_rounds":4,"max_total_iterations":60,"children":25,"model_calls":89,"time_budget":"3h","researcher_timeout":"25m","noise_runs":3},"conversation_id":"<conversation-id>"}}
{"event":"round.started","timestamp":"2026-10-20T09:00:00Z","payload":{"round":1,"lanes":[{"id":"A","focus":"queries"},{"id":"B","focus":"serialization"},{"id":"C","focus":"caching","devils_advocate":true}],"endgame":false}}
{"event":"child.dispatched","timestamp":"2026-10-20T09:00:02Z","payload":{"round":1,"report_id":"r1-researcher-A","role":"researcher-A","type_name":"lit-executor","namespace":"worktrees/A","deadline":"2026-10-20T09:25:02Z","prompt":"prompts/r1-researcher-A.md","prompt_sha":"5d0e9a11c2f4"}}
{"event":"child.reported","timestamp":"2026-10-20T09:19:40Z","payload":{"round":1,"report_id":"r1-researcher-A","status":"done","lane_status":"COMPLETED","inbox":"inbox/r1-researcher-A.md","files":["researcher_A_results.tsv@9c41e0d2a7b3"],"late":false,"source":"message"}}
{"event":"child.failed","timestamp":"2026-10-20T09:31:00Z","payload":{"round":1,"report_id":"r1-researcher-C","reason":"timeout"}}
{"event":"round.peer_review","timestamp":"2026-10-20T09:41:10Z","payload":{"round":1,"path":"peer_review_round_1.md","validated":2,"challenged":1,"overturned":0}}
{"event":"round.completed","timestamp":"2026-10-20T09:43:00Z","payload":{"round":1,"best":151.0,"best_researcher":"A","counting":true,"plateau_count":0,"budget_used":{"rounds":1,"iterations":14,"children":6,"model_calls":21,"elapsed":"45m"}}}
```

Write a line with `run_command` (`printf '%s\n' '<json>' >> conference_events.jsonl`) or, when the host refuses shell appends, by reading the file and writing it back whole with `write_file` (older builds: `write_to_file`). When the payload carries text from a child, check that the line parses first (`node -e "JSON.parse(process.argv[1])" '<json>'`).

## 4. Inbox and re-measurement runs

- `inbox/<report_id>.md`: every child report, verbatim, saved as it arrives and before anything is parsed out of it. Multi-part reports are assembled into one file in part order. The inbox is evidence; the root never edits a saved report.
- `remeasure_round_<N>.jsonl`: the runs from the `qa-runner` report, one object per evaluator run, copied out of its inbox file:

```json
{"finding":"r1-A-3","worktree":"<abs path>","commit":"8b07de1","command":"<evaluator>","run":1,"value":151.3,"exit":0,"wall_s":41.2,"stdout_head":"...","stderr_head":"","timestamp":"2026-10-20T09:33:00Z"}
```

The root writes the median per finding into `remeasured_value` and hands the values to the Reviewer.

## 5. Ledger lines in the agy conversation ledger

The hooks append a line per tool call to `.litgravity/ledger/<conversation-id>.jsonl` while a route is active. The conference adds its own lines there, shaped `{"ts","kind","text","path"}`:

| `kind` | Written when | Example `text` |
| --- | --- | --- |
| `decision` | start-gate answer, defaults taken headless, re-dispatch or close after a crash, convergence call, worktree choice | `start gate approved: 3 lanes x 5 iterations x 4 rounds, Devil's Advocate on C` |
| `evidence` | a round completes, the synthesis is saved, the review-work verdict arrives | `round 2 completed: best 131.7 ms (B), 3 validated` |
| `note` | pauses, cancels, blockers | `PAUSED at row 3: pause_every=2 reached, waiting for the user` |

`path` points at the conference file that holds the detail (repo-relative). Keep each line short; the conference directory holds the rest. Never put a secret or a full child report into the ledger.

## 6. What the files are for

| File | Read by | Purpose |
| --- | --- | --- |
| `conference.md` | the user, every prompt | configuration, Shared Knowledge, Conference Log |
| lane logs | Session Chair, Synthesizer, the user | reasoning per iteration |
| lane TSVs | root, Session Chair, scripts | machine-readable lane history |
| `conference_results.tsv` | analyze mode, scripts, the final report | the whole conference in one table, with verdicts |
| `conference_events.jsonl` | resume, analyze mode, status checks | ordering, timing, budget, recovery |
| poster sessions | Reviewer, Synthesizer | neutral round summaries |
| peer reviews | root (Phase 4), Synthesizer | verdicts, conflicts, scores |
| `inbox/`, re-measurement runs | Reviewer, resume, analyze mode | what each child actually said; independent measurements |
| `prompts/` | resume, analyze mode | the exact input of every child |
| `interrupted/` | resume, analyze mode | what was set aside and why |

Typical uses: plot each lane's curve from the conference TSV; check in CI whether the last validated value met the target; compare reviewer verdicts with what the synthesis kept to judge review quality across conferences; follow a live run with `tail -n 20 conference_events.jsonl` through `run_command`.

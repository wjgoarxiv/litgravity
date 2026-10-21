# Core principles of the measured loop

Read this file with `read_file` when you set up a `core` run, when a contract draft looks shaky, or when a run starts to drift and you need to name which rule it is breaking. The eight principles come from Karpathy's autoresearch, which ran overnight training experiments against a single validation number; this skill applies the same discipline to any artifact whose quality a command can score.

## Where authority comes from

These principles describe how a run behaves once it is allowed to run. They grant nothing by themselves. Before the first change, the user approves the objective, the evaluator, a finite budget, the roots the loop may read and write, the rollback method and the review gate, either through a `lit-plan` packet or through `ask_question`. The approved run (`start-work`, or the main conversation inside that approved packet) then makes the bounded writes, runs the commands, scores and reverts. When no approval exists, every mode stays read-only: it analyses what the user supplied, proposes experiments and reads public sources.

## The eight principles at a glance

| # | Principle | One-line rule | Where it lives in `research.md` |
|---|---|---|---|
| 1 | One metric | The run optimises exactly one number, with a declared direction. | `## Success Metric` |
| 2 | Mechanical scoring | A command produces the number; a person's impression does not. | `## Success Metric` target expression, `Evaluator:` line |
| 3 | One change per iteration | Each iteration varies one thing, so the result can be attributed. | loop procedure (SKILL.md step 5) |
| 4 | Keep or revert | Improvement beyond noise is kept; everything else is reverted the same iteration. | `## History` result column |
| 5 | Complete history | Failures are logged with the same care as wins. | `## History`, `research_log.md`, the TSV |
| 6 | Fenced search space | Allowed and forbidden changes are written down before iteration 1. | `## Search Space` |
| 7 | Uninterrupted inside the budget | Once approved, the loop does not stop to ask between iterations. | `## Constraints` → `pause_every` |
| 8 | Spend the budget | The run ends at the target, at the budget, on cancellation or on a real blocker. | autonomy rule in `modes/core.md` |

## What each principle protects against

### 1. One metric

A loop that chases two numbers learns to trade one against the other and calls the trade progress. Pick the number that matters and make the others guards (principle 6 and the guard checks in `modes/core.md`). "Raise top-1 accuracy on the held-out split" is a metric. "Raise accuracy, cut latency and grow coverage" is three runs; split it, or make two of them guards with fixed thresholds.

Failure sign: the History table shows the metric moving up and down while the description column keeps changing which goal it serves.

### 2. Mechanical scoring

The evaluator is a command whose output parses to a number (`references/evaluator-contract.md`). This is what lets the loop run a dozen iterations an hour without waiting on anyone. When the only judge available is a model or a person, record `evaluator_source` as `agent` or `manual` and treat every keep decision as weaker evidence in the final report.

Good: `node perf/sort.mjs --json` prints `{"pass":true,"score":-1.84,"metric_value":1.84}`. Weak: "the output reads better now".

### 3. One change per iteration

Changing the algorithm and the buffer size in one commit makes a gain unattributable and can hide a harmful change behind a helpful one. Split compound ideas into consecutive iterations. A change may touch several files when they express one idea (a renamed parameter and its two call sites); it may not carry two ideas.

Failure sign: a description column entry that needs the word "and" to explain what changed.

### 4. Keep or revert

A neutral change still adds complexity and interacts with later changes. The decision is binary: the score beats the best kept score by more than the declared tolerance and every guard passes, or the change is reverted. A delta inside the noise band is a revert. A guard failure is a revert even when the metric jumped.

Example: median runtime moved from 2.401 s to 2.389 s with an observed spread of 0.03 s. That is noise; revert and log it.

### 5. Complete history

The log is the loop's memory across iterations and across conversations. A reverted idea recorded with its reason stops iteration 9 from repeating iteration 3. Keep three layers in step: the History table in `research.md` (one line per iteration), `research_log.md` (reasoning, commands, raw evaluator output) and `autoresearch-results.tsv` (`references/results-logging.md`). Add a `decision` line to `.litgravity/ledger/<conversation-id>.jsonl` for every keep and revert.

### 6. Fenced search space

Given room, an optimiser finds the cheapest route to a better number, and the cheapest route is often editing the test set, loosening a threshold or catching an exception the benchmark used to count. Write `Allowed:` and `Forbidden:` lists before the baseline. The evaluator, its data, its thresholds and the guard commands always belong in `Forbidden:`. This is Goodhart's law in practice: a measure that becomes a target stops measuring once the loop may touch it.

### 7. Uninterrupted inside the budget

The value of the loop compounds with iterations, and every pause for approval resets that clock. So the approval happens once, up front, and covers the whole budget. Inside it the loop asks no further questions. `pause_every: N` exists for safety-critical work where a human checkpoint every N iterations is part of the contract; record it in the plan when the user wants it. Leaving the approved roots, raising the budget or adding a new action class is outside the budget and needs a fresh `ask_question`.

### 8. Spend the budget

Four iterations usually find a local optimum; the structural improvements tend to show up after several pivots (`references/stuck-detection.md`). Treat `max_iterations` as an allowance to use. The run ends on one of four terminal reasons: `TARGET_MET`, `BUDGET_EXHAUSTED`, `CANCELLED`, `BLOCKED`. Running out of budget is a normal ending and produces `final_report.md` like any other.

## Checking a contract against the principles

Before asking for approval, read the draft `research.md` (template: `assets/research_template.md`) and confirm each line below. A "no" is a gap to fix with the user before the baseline.

1. Exactly one metric with a direction and a target expression a command can test.
2. An evaluator command, its timeout, its parse rule, and the keep policy (`score_improvement` or `pass_only`).
3. Noise handling: `noise_runs` and `min_delta`, or an explicit note that the metric is deterministic.
4. At least one guard command that stays green, usually the test suite.
5. `Allowed:` and `Forbidden:` lists, with the evaluator and its data in `Forbidden:`.
6. A finite `max_iterations`, a wall-clock cap and a per-command timeout.
7. A rollback path: a dedicated branch such as `autoresearch/<slug>` and `git revert` as the default undo.
8. An artifact root, by default `.litgravity/evidence/<slug>/autoresearch/`.

## Principles in the other modes

The analysis modes reuse the principles in their own shape:

| Mode | Its "metric" | Its "one change" | Its keep/revert |
|---|---|---|---|
| `debug` | hypotheses eliminated | one probe per iteration | hypothesis confirmed, rejected or still open |
| `fix` | error count from one command | one minimal fix | count drops and guards pass, or revert |
| `security` | mitigation coverage percent | one threat or category per pass | finding recorded with evidence or marked unverified |
| `scenario` | dimension × domain cells covered | one cell per iteration | cell written with evidence or marked not applicable |
| `predict`, `reason` | convergence of positions | one round | round logged; judge decides at the end |
| `ship` | readiness checklist items verified | one phase | item verified, failed or blocked |
| `learn`, `plan` | none; they produce a packet | one section | packet section complete or flagged |

Whatever the mode, the run keeps one outcome per step, logs every step and stays inside the approved budget and roots.

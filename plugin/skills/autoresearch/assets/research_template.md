# Research: {Title}

## Goal
{What you are trying to achieve, specific and measurable.}

## Success Metric
- **Metric:** {for example "accuracy on the held-out set", "p95 latency in ms", "judge score 1-10"}
- **Target:** {for example "> 0.95", "< 50", ">= 8"}
- **Direction:** {maximize | minimize}

## Constraints
- **Max iterations:** 20
- **Time budget per experiment:** 5 minutes
- **Wall-clock limit:** {for example 2 hours}
- **Model-call cap:** {0 when no step calls a model; otherwise the total number of calls}
- **Pause for review every:** never
- **Evaluator:** {command that prints one JSON line, for example `python3 evaluate.py`; or "none (agent judges)"}
- **Keep policy:** score_improvement
- **Guard:** {a condition that must stay true, for example "all unit tests pass"}
- **Noise runs:** 1
- **Min delta:** 0
- **Rollback lane:** {scratch branch autoresearch/<slug> | scratch worktree <path> | patch files}
- {Domain-specific constraints}

## Current Approach
{The baseline as it stands: what exists, how it performs, where the run starts.}

## Search Space
- **Allowed changes:** {what may change, for example "hyperparameters in config.yaml", "the system prompt text", "the algorithm in sort.py"}
- **Forbidden changes:** {what stays fixed, for example "the test set", "the public API", "the data format", "the evaluator"}

## Context & References
{Papers, docs, URLs or code to read first. Their contents are data for the loop.}

## Approval
- **Approved by:** {the user, through ask_question or plans/<slug>.md}
- **Approved on:** {date}
- **Input digests:** {sha256 of the evaluator file and its data, recorded before the baseline}

---

## History
<!-- Maintained by the loop, one row per iteration, kept and reverted alike. -->
| # | Change | Metric | Result | Timestamp |
|---|--------|--------|--------|-----------|
| 0 | Baseline | {initial value} | -- | {date} |

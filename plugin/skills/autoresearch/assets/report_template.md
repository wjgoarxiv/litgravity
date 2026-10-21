# Research Report: {Title}

**Generated:** {date}
**Total Iterations:** {n} of {max_iterations} approved
**Model calls used:** {calls} of {model_call_cap}
**Final Metric:** {best value} ({direction}: {metric name})
**Baseline:** {baseline median} (spread {spread} over {noise_runs} runs)
**Terminal reason:** {TARGET_MET | BUDGET_EXHAUSTED | PLATEAU | CANCELLED | BLOCKED}
**Rollback lane:** {branch, worktree or patch files} ({first commit} .. {last commit})

---

## Executive Summary
{Two or three sentences: what was optimized, the best confirmed result, the main insight.}

## Best Result
- **Iteration:** #{n}
- **Change:** {what differs from the baseline}
- **Metric Value:** {confirmed median} (baseline {baseline}, gain {delta}, noise tolerance {tolerance})
- **Configuration or code:** {the winning setup, or the commit to merge}

## Iteration Summary
| # | Change | Metric | vs Baseline | Kept? |
|---|--------|--------|-------------|-------|
{rows, including reverted and guard_violation rows}

## Key Findings
1. {A pattern the experiments showed}
2. {What worked repeatedly}
3. {A surprising result}

## Failed Approaches
1. {What was tried and why it fell short}
2. {Dead ends worth recording}

## Pivot History
- {Each plateau the loop detected and the strategy it switched to}

## Risks
- {Noise, guard flakiness, benchmark overfitting, anything the user must weigh before merging}

## Reproducibility Commands
```bash
{commands that reproduce the best metric and the guard checks}
```

## Artifact Checklist
- [ ] `research.md` carries the final History row
- [ ] `research_log.md` records the evaluator output for every iteration
- [ ] `autoresearch-results.tsv` has the eight-column header and one row per iteration
- [ ] `autoresearch_events.jsonl` ends with an `autoresearch.completed` event
- [ ] `progress.png` exists when the visualization guide asked for it
- [ ] `final.log` holds the confirmation runs
- [ ] The commands above reproduce the best result

## Recommendations
- {Next steps if the user wants to continue}
- {Related areas worth a separate run}

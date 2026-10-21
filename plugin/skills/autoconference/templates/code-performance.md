# Conference: Code Performance Optimization

> **Template: Code Performance.** Three researchers attack execution time at three layers: algorithm, data structures, low-level hot paths. Each works in its own conference worktree (`conference/researcher-<ID>`), validated commits land on `conference/best`, and the user's branch stays untouched. Copy to `.litgravity/conference/<slug>/conference.md`.

## Goal
Minimize the execution time of the target code while every existing test still passes. Each researcher optimizes a different layer so that their gains combine.

## Mode
metric

## Success Metric
- **Metric:** execution_time_seconds
- **Target:** {for example "< 0.5"}
- **Direction:** minimize
- **Evaluator:** `{benchmark command that prints the median seconds as one number}`
- **Evaluator timeout:** 5m

## Researchers
- **Count:** 3
- **Iterations per round:** 5
- **Max rounds:** 3
- **Researcher agent type:** lit-executor, one conference worktree each

## Pre-Flight Gate
- **Max total iterations:** 45
- **Children (invoke_subagent calls):** 19
- **Model calls:** 67
- **Critic / Devil's Advocate:** {enabled in slot C | disabled}
- **Roots:** write only inside the three conference worktrees; execute the benchmark and the test suite
- **Final confirmation:** pending

## Budget
- **Max rounds:** 3
- **Max total iterations:** 45
- **Children:** 19 (3 rounds x 6 + synthesizer)
- **Model calls:** 67 (45 iterations + 19 children + 3 nudges)
- **Time budget:** 2h
- **Researcher timeout:** 40m

## Search Space
- **Allowed changes:** implementation code, algorithm choice, data structures, caching, memory layout, vectorization
- **Forbidden changes:** the benchmark harness, input data, public API contracts, the tests

## Search Space Partitioning
- **Strategy:** assigned

### Researcher A Focus
Algorithms: lower complexity (quadratic to n log n), better algorithms for the problem class, removing repeated work, memoizing expensive calls.

### Researcher B Focus
Data structures: the right containers (list, dict, set, arrays), index structures, object layout, fewer repeated lookups, batched operations.

### Researcher C Focus
Low level: caching hot paths, memory layout for locality, vectorization, interpreter overhead (comprehensions over loops, array libraries where they fit), changes guided by a profiler run saved with each iteration.

## Guard
The full test suite passes and outputs on the benchmark inputs are byte-identical to the baseline.

## Noise Handling
- **Noise runs:** 5
- **Min consensus delta:** {about twice the spread of the five baseline runs}

## Pause Policy
- **pause_every:** every_round

## Current Approach
{What the code does now, its baseline time from the dry run, and the files involved.}

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
- Target code: {paths}
- Benchmark: {path and command}
- Baseline: {seconds, from the dry run}
- Hardware: {CPU, memory, OS, for reproducibility}

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|

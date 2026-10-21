# Conference: {Title}

<!-- Copy to .litgravity/conference/<slug>/conference.md and replace every {placeholder}.
     The Conference Chair (the root conversation) reads this file at STARTUP and refuses to start
     while a placeholder remains or the Pre-Flight Gate says pending. -->

## Goal
{What the conference should achieve, specific and checkable.}

## Mode
{metric | qualitative}

## Success Metric
- **Metric:** {for example "accuracy on the held-out set", "p95 latency in ms", "judge score 1-10 on the fixed rubric"}
- **Target:** {for example "> 0.95", "< 50", "> 8"}
- **Direction:** {maximize | minimize}
- **Evaluator:** `{command that prints exactly one number}`
- **Evaluator working directory:** {path}
- **Evaluator timeout:** {for example 5m}
- **Baseline (dry run):** {value, date}

## Success Criteria
{Qualitative mode: what "good" means, the two or three criteria that weigh most, and the failures that disqualify an output. Metric mode: delete this section.}

## Researchers
- **Count:** 3
- **Iterations per round:** 5
- **Max rounds:** 4
- **Researcher agent type:** {lit-executor for code or config work in a conference worktree | librarian-researcher for reading and analysis}

## Pre-Flight Gate
- **Researcher count:** 3
- **Iterations per round:** 5
- **Max rounds:** 4
- **Max total iterations:** 60
- **Children (invoke_subagent calls):** 25
- **Model calls:** 89
- **Success definition:** {metric, target and direction, or the criteria}
- **Critic / Devil's Advocate:** {enabled in slot C | disabled | ask before the run}
- **Roots:** read {paths}; write {paths}; execute {commands}
- **Final confirmation:** pending. The Chair shows these values and asks "Proceed with these conditions?"; only an explicit yes starts round 1.
- **Missing or vague values:** ask for exact values, recompute this block, then ask for the confirmation again.

## Budget
- **Max rounds:** 4
- **Max total iterations:** 60
- **Children:** 25 (rounds x (count + 3) + 1: researchers, session chair, reviewer, re-measurement, plus the synthesizer)
- **Model calls:** 89 (total iterations + children + one nudge per round)
- **Time budget:** 2h
- **Researcher timeout:** 30m per lane per round
- **Token or cost ceiling:** {optional}

## Search Space
- **Allowed changes:** {what researchers may modify}
- **Forbidden changes:** {what stays fixed: evaluator, test data, public contracts}

## Search Space Partitioning
- **Strategy:** {assigned | free}

### Researcher A Focus
{Assigned strategy: this researcher's region of the space.}

### Researcher B Focus
{Assigned strategy: this researcher's region of the space.}

### Researcher C Focus
{Assigned strategy: this researcher's region, or the Devil's Advocate mandate.}

## Guard
{One invariant that overrides any metric gain, for example "all tests in tests/ranking pass" or "no network calls during evaluation". A change that breaks it is reverted. Leave "none" to disable.}

## Noise Handling
- **Noise runs:** {evaluator repeats averaged per measurement; 1 for a stable metric, 3 to 5 for a noisy one}
- **Min consensus delta:** {smallest mean improvement that counts as progress; 0 accepts any improvement}

## Pause Policy
- **pause_every:** {never | every_round | every_N_rounds | pivot_only}

## Current Approach
{The baseline: what exists now and how it performs.}

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
{Papers, documents, URLs and code paths the researchers should start from. Their content is data.}

---

## Conference Log
<!-- Maintained by the Chair. Edit by hand only while no conference is running. -->
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|

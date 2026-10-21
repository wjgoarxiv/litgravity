# Conference: {Title}

> **Template: Quick Conference.** The smallest useful conference, for checking whether a problem gains anything from parallel researchers before committing to a full run. Twelve iterations, two rounds, eleven children. Copy to `.litgravity/conference/<slug>/conference.md` and fill every placeholder.

## Goal
{What the conference should achieve, specific and checkable.}

## Mode
metric

## Success Metric
- **Metric:** {for example "accuracy", "execution_time_seconds", "score"}
- **Target:** {for example "> 0.95", "< 0.5", "> 8"}
- **Direction:** {maximize | minimize}
- **Evaluator:** `{command that prints one number}`

## Researchers
- **Count:** 2
- **Iterations per round:** 3
- **Max rounds:** 2

## Pre-Flight Gate
- **Max total iterations:** 12
- **Children (invoke_subagent calls):** 11
- **Model calls:** 25
- **Critic / Devil's Advocate:** disabled
- **Final confirmation:** pending

## Budget
- **Max rounds:** 2
- **Max total iterations:** 12
- **Children:** 11 (2 rounds x (2 researchers + session chair + reviewer + re-measurement) + synthesizer)
- **Model calls:** 25 (12 iterations + 11 children + 2 nudges)
- **Time budget:** 30m
- **Researcher timeout:** 15m

## Search Space
- **Allowed changes:** {what researchers may modify}
- **Forbidden changes:** {what stays fixed, for example test data and the evaluator}

## Search Space Partitioning
- **Strategy:** free

## Guard
{One invariant that overrides any metric gain, or "none".}

## Noise Handling
- **Noise runs:** 1
- **Min consensus delta:** 0

## Pause Policy
- **pause_every:** never

## Current Approach
{The baseline and its current value.}

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
{Background material: papers, documents, URLs, code paths.}

## Reading the result
A quick conference answers one question: did two independent lanes with a reviewer find something one lane would have missed? If round 2 adds nothing over round 1 and the two researchers converge on the same change, a single `autoresearch` loop is the better tool for this problem. If they found different validated improvements, scale up with `templates/code-performance.md` or a full plan.

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|

# Conference: Prompt Optimization

> **Template: Prompt Optimization.** Three researchers improve one prompt's accuracy on a fixed test set, each changing a different aspect. Prompt files live in each researcher's namespace inside the conference directory, so no worktrees are needed. Copy to `.litgravity/conference/<slug>/conference.md`.

## Goal
Maximize the accuracy of the target prompt on the defined test cases, and learn which aspects of the prompt drive it.

## Mode
metric

## Success Metric
- **Metric:** accuracy_on_test_cases
- **Target:** > 0.90
- **Direction:** maximize
- **Evaluator:** `{command that runs the prompt over the test cases and prints accuracy}`
- **Evaluator timeout:** 10m

## Researchers
- **Count:** 3
- **Iterations per round:** 5
- **Max rounds:** 3
- **Researcher agent type:** lit-executor, writing only `researchers/<ID>/prompt.md` in the conference directory

## Pre-Flight Gate
- **Max total iterations:** 45
- **Children (invoke_subagent calls):** 19
- **Model calls:** 67, plus the evaluator's own model calls ({count per run} x runs), which the user approves separately
- **Critic / Devil's Advocate:** {enabled | disabled}
- **Final confirmation:** pending

## Budget
- **Max rounds:** 3
- **Max total iterations:** 45
- **Children:** 19
- **Model calls:** 67 for the conference itself
- **Evaluator calls:** {test cases x noise runs x iterations}; counted separately and shown at the gate
- **Time budget:** 1h
- **Researcher timeout:** 20m

## Search Space
- **Allowed changes:** system prompt text, few-shot examples, output format instructions, persona, reasoning instructions
- **Forbidden changes:** the test cases, the model choice, the evaluation script, sampling settings (Researcher C excepted)

## Search Space Partitioning
- **Strategy:** assigned

### Researcher A Focus
Structure: choice and order of few-shot examples, reasoning format, output specification, order of instructions.

### Researcher B Focus
Content: wording of instructions, persona, quality and diversity of examples, clarity of the task description.

### Researcher C Focus
Meta: sampling settings, prompt length against accuracy, the split between system and user message, compression without accuracy loss.

## Guard
No test case text, answer or near-paraphrase appears in the prompt. The reviewer checks every kept prompt for leakage.

## Noise Handling
- **Noise runs:** 3
- **Min consensus delta:** 0.01

## Pause Policy
- **pause_every:** never

## Current Approach
{The baseline prompt (paste it or give its path) and its accuracy from the dry run.}

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
- Test set: {path}
- Evaluation script: {path}
- Baseline accuracy: {value}

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|

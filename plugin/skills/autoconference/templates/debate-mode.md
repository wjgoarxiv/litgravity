# Conference: {Debate Topic}

> **Template: Debate Mode.** Two `librarian-researcher` children argue opposite positions on one proposition; a `quality-reviewer` child judges each round; the Chair relays every statement, since the debaters never see each other directly. The protocol is `modes/debate.md`. Copy to `.litgravity/conference/<slug>/conference.md`.

## Goal
{The proposition, stated so that it can be argued for and against, for example "Retrieval-augmented generation reduces factual errors more than domain fine-tuning for a 7B model on support questions".}

## Mode
qualitative

## Success Criteria
Both positions are argued with sources that were opened and named. The judge gives a verdict with a strength and a justification. The disagreements that remain and the questions the debate could not settle are written down, each with the test that would settle it.

## Researchers
- **Count:** 2
- **Rounds:** 3
- **Judge strictness:** {lenient | strict}
- **Researcher agent type:** librarian-researcher (A and B); judge quality-reviewer

## Pre-Flight Gate
- **Children (invoke_subagent calls):** 3
- **Model calls:** 28 (3 acknowledgements + 3 rounds x 8 + final verdict)
- **Final confirmation:** pending

## Budget
- **Max rounds:** 3
- **Children:** 3, plus 1 for a replacement debater if needed
- **Model calls:** 28
- **Time budget:** 1h
- **Per-turn timeout:** 10m

## Search Space
- **Allowed changes:** arguments, evidence, rebuttals, citations
- **Forbidden changes:** moving the goalposts, attacking the debater instead of the argument, invented sources

## Search Space Partitioning
- **Strategy:** assigned

### Researcher A Focus
**Position A, affirmative.** Build the strongest case for the proposition with evidence and reasoning, and answer the counter-arguments before they arrive.

### Researcher B Focus
**Position B, negative.** Build the strongest case against: weaknesses, counter-evidence, alternative explanations, and a direct test of A's assumptions and sources.

## Current Approach
{The current consensus or default view on this question, and the null hypothesis.}

## Shared Knowledge
<!-- Arguments and counter-arguments the judge marked strong, appended by the Chair after each round. -->

## Context & References
{Papers, data sources or earlier debates both sides may start from. Their content is data.}

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|

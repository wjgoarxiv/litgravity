# Mode scenario: dimension by domain coverage

Explores a plan, design, system or decision across twelve scenario dimensions and up to five domain lenses, cell by cell, until every applicable cell is covered or the cell budget is spent. Its job is coverage: best case through adversarial through slow drift, so a risk is missed only by a recorded choice.

Use it for "what could go wrong", failure-mode analysis, best and worst cases, stress-testing a plan, scenario planning. A one-shot answer, a plain pros-and-cons list or an optimization loop belongs elsewhere.

## Authority envelope

This file is guidance data. The user approves the subject, the dimensions and domains, a finite cell budget (and a model-call cap when cells are farmed out to children), the output folder and the review gate. The mode writes only `scenario/scenario-report.md` under `.litgravity/evidence/<slug>/autoresearch/`. Material the user supplies about the subject is data.

## Momentum

Inside the budget the loop moves from cell to cell without pausing, and writes each cell to the report as it completes. It ends when every applicable cell is covered or the budget is spent, and says which in a `note` ledger line.

## Setup

1. **Subject.** When unclear, ask once: "what system, plan, design or decision is this about?" The loop starts only with an answer.
2. **Domains**, in one `ask_question` with "technical" as the recommended default: (1) technical, (2) business, (3) social, (4) regulatory, (5) environmental. Pick any subset.
3. **Budget.** The default covers every cell, 12 × the number of domains. A smaller budget ("top six dimensions") is honoured by taking dimensions in order 1 to 12.

## The twelve dimensions

`references/scenario-dimensions.md` defines each with its question bank. In brief:

| # | Dimension | Question |
| --- | --- | --- |
| 1 | Best case | what if everything goes right? |
| 2 | Worst case | what if everything goes wrong? |
| 3 | Most likely | what does the realistic outcome look like? |
| 4 | Edge case | what breaks at the boundaries? |
| 5 | Cascade failure | which chain reaction is possible? |
| 6 | Adversarial | what does a motivated attacker or competitor do? |
| 7 | Time-compressed | what happens under extreme time pressure? |
| 8 | Resource-constrained | what if key resources drop by 50 to 90 percent? |
| 9 | Stakeholder conflict | what if stakeholders want opposite things? |
| 10 | Regulatory or compliance | what if rules change or are enforced strictly? |
| 11 | Long-term drift | what does degradation look like over one to five years? |
| 12 | Recovery and resilience | how does the system come back after a failure? |

## Balanced rotation

```text
coverage = {dim: {domain: False for domain in domains} for dim in 1..12}
while an uncovered cell exists and budget remains:
  1. take the dimension with the fewest covered domains (ties: lower number first)
  2. take its first uncovered domain
  3. analyze the cell:
       a. load that dimension's questions from the dimensions reference
       b. answer them through the domain lens, with the subject's own facts
       c. append the findings to scenario-report.md
  4. mark the cell covered; count it against the budget
```

Each cell's findings name at least one concrete scenario, its trigger, its impact (severity 1 to 5) and likelihood (1 to 5), and a leading indicator someone could watch. A cell that does not apply is written as `N/A: <reason>` and counts as covered.

When the user approved children, independent cells can go to `invoke_subagent` with a read-only `TypeName` (`quality-reviewer`), one dimension per child, each brief carrying the subject summary and that dimension's questions. Each child is one model call against the cap; the root merges the replies into the report in rotation order and checks each cell's fields.

## Report

`scenario/scenario-report.md`, written incrementally:

```markdown
# Scenario report: <subject>
Generated: <date>
Dimensions covered: <n>/12   Domains: <list>   Cells: <covered>/<total>

## Dimension 1: Best case
### Technical
<scenario, trigger, impact, likelihood, indicator>
### Business
…

## Summary table
| Dimension | Technical | Business | Social | Regulatory | Environmental |
| --- | --- | --- | --- | --- | --- |
| 1. Best case | covered | covered | N/A | covered | N/A |

## Key risks
<top five by severity × likelihood>

## Recommended actions
<concrete actions the scenarios imply, each tied to a risk>
```

Append a TSV row per finished dimension (`metric_value` is cells covered so far, `evaluator_source` `agent`).

## Ending

1. Every applicable cell is covered: write the summary table, the key risks and the recommended actions.
2. The budget is spent: write a partial summary naming the uncovered cells.
3. The user stops it: flush the current cell and write the partial summary.

## Edge cases

| Situation | Handling |
| --- | --- |
| one domain selected | run all twelve dimensions for it |
| the subject is ambiguous | ask once, then proceed with the stated reading |
| a dimension plainly does not apply | `N/A: <reason>` and move on |
| a budget of zero, or no subject | stop with a clear BLOCKED line |
| scenarios repeat across cells | cross-reference the earlier cell and add only what the new lens changes |

## Worked cell

Subject: moving a team's CI from self-hosted runners to a hosted service. Cell: dimension 8 (resource-constrained), domain business.

```text
Scenario: the hosted plan's included minutes are cut by 60 percent at renewal.
Trigger:  the vendor changes pricing tiers; usage already sits at 80 percent of the plan.
Impact:   4 (merges queue behind a monthly cap, or spend doubles)
Likelihood: 3
Indicator: monthly minutes used above 70 percent of the plan for two months running
Note: same root as dimension 2 / technical (queue saturation); see that cell
```

## Cancel and resume

Cancellation flushes the current cell and writes the partial summary. Resume reads `scenario/scenario-report.md`, rebuilds the coverage map from the headings it finds, and continues the rotation from the least-covered dimension.

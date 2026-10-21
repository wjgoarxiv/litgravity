# Stuck detection and pivots

A plateau is information: the current region of the search space is used up. The response is a change of strategy that keeps iterating inside the approved budget. Read this file with `read_file` when the non-improving counter reaches 3, and again at 5.

## Authority

A pivot changes which ideas the loop tries next. It leaves the approved packet as it was: the same evaluator, roots, forbidden list, rollback method and budget. When the only promising direction needs a file outside the approved roots, a new dependency or more iterations, the loop stops and asks with `ask_question` (headless: record the recommended default as a `decision` and stop with `BLOCKED`).

## Counting

- An iteration is **non-improving** when its score does not beat the best kept score by more than the tolerance. Kept-but-flat cannot happen under `score_improvement`; reverted, failed, timed-out and guard-violation iterations all count as non-improving.
- The counter **resets to 0** on every keep.
- The counter **keeps running** across a Level 1 pivot. A new strategy that fails to improve extends the same plateau, so Level 2 fires at 5 even if a Level 1 pivot happened at 3.
- `reference` rows do not touch the counter.

## Level 1: plateau (3 non-improving in a row)

1. Stop tuning the current approach. Small variants of an exhausted idea spend budget without information.
2. Name the strategy you are leaving and pick one from a different region of the space. Options, in the order to try them:
   - a different family of solution (comparison sort → counting sort; rule-based prompt → example-based prompt);
   - a narrower target (do less work, cache, short-circuit the common case);
   - a different representation (data structure, file layout, prompt format);
   - the inverse move (if additions failed, try removals).
3. Give the new strategy at least two iterations before judging it.
4. Log the pivot (format below) in `research_log.md` and add a `decision` line to the ledger.
5. Continue. A plateau gives no reason to summarise or ask the user.

## Level 2: deep plateau (5 non-improving in a row)

1. Make a paradigm shift: the opposite of the pattern so far. If every attempt added complexity, try deleting code. If every attempt was conservative, try the bold version.
2. Re-read `## Context & References` in `research.md` and the reverted rows of the TSV. Look for two near-misses whose ideas could combine.
3. Question the setup: is the baseline right, is the evaluator measuring the bottleneck, is there a cost you have not profiled? A measurement probe that changes no product file may run as an iteration and gets a `reference` row.
4. Log a deep pivot.
5. Continue while budget remains.

Further moves at this level:

- profile before optimising again (the hot path may have moved after earlier keeps);
- test the evaluator: when a large intended change leaves the score untouched, the evaluator may be insensitive to it, which is a blocker to report;
- apply the change in the other direction to see whether the metric responds at all.

## Level 3: budget spent

Reaching `max_iterations` is a normal end with terminal reason `BUDGET_EXHAUSTED`.

1. Run the confirmation measurement on the final kept commit.
2. Write `final_report.md` from `assets/report_template.md`, with the best result, the full list of approaches tried (kept and reverted), the pivots and why they happened, and a short "next run" section with the most promising untried ideas and the budget they would need.
3. Append the terminal event (`references/results-logging.md`).

## Signs of a different problem

Some stalls are blockers dressed as plateaus. Stop with `BLOCKED` and report when you see one:

| Sign | What it usually means |
|---|---|
| three different changes produce byte-identical evaluator output | the evaluator does not exercise the changed code |
| every iteration times out | the deadline is too tight, or a change made the program hang; inspect before continuing |
| the guard fails on the untouched baseline when re-run | the guard is flaky; the run cannot attribute anything until it is fixed |
| scores drift on a commit that did not change | uncontrolled noise; raise `noise_runs` with approval or fix the environment |
| the only remaining ideas touch `Forbidden:` paths | the search space is exhausted inside the fence; report it |

## Log formats

```markdown
## PIVOT (level 1), iteration <n>
- Leaving: <strategy>
- Why: <k> non-improving iterations (best kept score <s> at iteration <m>)
- Trying: <new strategy>
- Expected effect: <one sentence>
```

```markdown
## DEEP PIVOT (level 2), iteration <n>
- Exhausted: <list of strategies tried>
- New paradigm: <description>
- Source of the idea: <near-miss rows, context reference, profiling result>
```

Ledger line for either: `{"ts":"<utc>","kind":"decision","text":"pivot L1 at iter <n>: <old> -> <new>","path":".litgravity/evidence/<slug>/autoresearch/research_log.md"}`.

## Worked sequences

Code speed:

```text
iter 1-3   quicksort variants                      no gain  -> PIVOT L1 to merge sort
iter 4-5   merge sort variants                     no gain  -> counter at 5 -> DEEP PIVOT to non-comparison sorts
iter 6     radix sort base 256                     kept     -> counter reset
iter 7-8   radix base tuning                       kept, then flat
```

Prompt quality with a scoring script:

```text
iter 1-3   adding more examples                    no gain  -> PIVOT L1 to step-by-step structure
iter 4-5   structure variants                      no gain  -> DEEP PIVOT: strip the prompt to its minimum
iter 6     minimal prompt                          kept     -> counter reset
```

## Mode-specific variants

- `debug`: three iterations with no hypothesis eliminated means switching technique (`references/investigation-techniques.md`).
- `fix`: an error count that stops dropping for three fixes means re-sorting the remaining errors by dependency and starting from the root of the largest cluster.
- `security`: a pass that adds no new finding and no new mitigation ends the re-audit loop.
- `predict` and `reason`: positions that stop changing across two rounds mean convergence; stop and judge.

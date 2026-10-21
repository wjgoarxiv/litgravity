# autoconference: convergence guide

How the Conference Chair decides that a conference is finished, how to set the thresholds for a given problem, and how to recognise the common round-by-round shapes. The decision order itself is fixed in `conference-protocol.md`, section 2; this file explains it and gives the tuning rules. Read it when you set up `conference.md` (plan mode), when a convergence call is close, and when analyze mode asks whether a conference stopped at the right time.

## The end conditions

### Metric mode

| Condition | Fires when | Code |
| --- | --- | --- |
| Target reached | a lane's result meets the target in `Success Metric`, and the Reviewer validated it with a re-measurement receipt | `TARGET_REACHED` |
| Budget | the next round does not fit the remaining iterations, rounds, children, model calls or time (`conference-protocol.md`, section 10) | `BUDGET STOP` |
| All stalled | every lane that reported this round is at stuck level 2 or 3 | `STALLED` |
| Plateau | the conference best has not beaten the previous best by more than the noise floor for two consecutive counting rounds | `CONVERGED` |
| Cancelled | the user stopped it, or the approved authority ended | `CANCELLED` |

The first matching row in the order of `conference-protocol.md`, section 2 wins. The order matters in one common case: a round that both hits the budget and shows a plateau is reported as `BUDGET STOP`, because the budget would have ended it anyway and the plateau was not given the chance to be confirmed.

**Counting rounds.** A round counts toward the plateau only when at least half its lanes reported with valid headers (`conference-protocol.md`, section 8). A round where most lanes timed out says nothing about whether the search space is exhausted, so it neither confirms nor breaks a plateau.

**The conference best.** The best validated value across all lanes and all rounds so far, in the direction of the metric. Unvalidated values never count, even when they look better; they are what the next review is for.

### Qualitative mode

| Condition | Fires when | Code |
| --- | --- | --- |
| Quality plateau | the Reviewer scores every lane at 8 or above in two consecutive counting rounds | `CONVERGED` |
| Early quality | the Reviewer scores every lane at 9 or above in one round, and the Chair records a `decision` to stop | `CONVERGED` |
| Flat below the bar | reviewer scores do not rise for two rounds and stay below 8 | `STALLED` |
| Budget, cancelled | as in metric mode | `BUDGET STOP`, `CANCELLED` |

The scores that count are the Reviewer's, from the Scores table in `peer_review_round_<N>.md`. Researchers' self-scores drive their own inner loop and nothing else.

## Measuring the noise floor before round 1

The plateau rule compares gains with a noise floor, so the floor comes from a measurement. In `conference.md` it is the `min_delta` field, and `noise_runs` says how many evaluator runs back each measured value. At the start gate, with the baseline:

1. Run the frozen evaluator on the unchanged baseline three to five times with `run_command` (each under its deadline), and record every value in `.litgravity/conference/<slug>/baseline_runs.tsv`.
2. Compute the spread: for a continuous metric, the larger of twice the standard deviation and 0.1 percent of the baseline mean; for an integer metric (tests passed, items found), 0 when all runs agree, otherwise the observed range.
3. Set `min_delta` to that spread. Set `noise_runs` to 1 when the runs agreed exactly, and to 3 to 5 when they did not; re-measurement in Phase 3a then uses that many runs and compares medians.
4. Write both values, and how they were computed, into `conference.md` and into a `decision` ledger line.
5. If the runs disagree by more than the hoped-for improvement, the metric cannot judge this conference. Report that at the start gate and offer: more runs per evaluation (the evaluator command then returns a median), a larger benchmark, or qualitative mode.

When the evaluator is too slow for three runs inside the budget, use what fits and say so; with one run the floor is unknown, and every metric claim needs re-measurement values before it can be validated.

## Tuning

### Plateau window

Two consecutive counting rounds is the default.

- One round is too short: a single round where every lane happened to chase a dead end would end the conference just before a pivot pays off.
- Three or more rounds is too long for most budgets: a conference with five rounds and a three-round window has only two rounds in which it can converge early.
- Use three rounds for exploratory conferences with a large search space and a generous budget, and write the choice into the `Goal` section of `conference.md` ("Plateau window: 3 rounds") so a resumed conference uses the same rule.

### Noise floor by metric type

| Metric type | Default floor | Raise it when | Lower it when |
| --- | --- | --- | --- |
| continuous (latency, loss, throughput) | measured as above, at least 0.1 percent of the baseline | the benchmark runs on shared or thermally throttled hardware (1 to 2 percent is common) | the measurement is deterministic and the gains that matter are tiny (exact comparison) |
| integer counts | 0 when runs agree | runs disagree (flaky tests); use the observed range | never below 0 |
| percentages on a fixed set (accuracy) | 0.1 absolute, or one item of the set, whichever is larger | the set is small (one item is a large step) | the set is large and fixed and the evaluator is deterministic |

### Qualitative threshold

| Reviewer score | Meaning | Converge? |
| --- | --- | --- |
| 9 to 10 | exceeds the criteria | yes, after one round at the Chair's recorded discretion |
| 8 | meets the criteria with small gaps | yes, after two consecutive counting rounds |
| 7 | solid, with clear gaps | keep going |
| 6 or less | well short of the criteria | keep going; check whether the criteria are reachable |

A conference where the Reviewer keeps scoring 7 is often asking for something the criteria do not define. At a `pause_every` pause, show the Reviewer's recurring gap notes and ask whether the criteria should be clarified; a change to the criteria is a new start-gate answer and restarts the plateau count.

## Stopping early versus spending the budget

### Early stops that are right

- The validated target is met.
- A true plateau: two counting rounds without a real gain, with lanes on different strategy families. Further rounds would repeat known results.
- Every lane is stalled at level 2 or 3: the search space as defined is exhausted, and the useful output is the record of what failed.

### Early stops that are wrong

- A plateau during a pivot. Lanes at stuck level 1 or 2 are switching strategy families; the next round is when that pays off. The two-round window exists for this case. When most lanes pivoted in the last round, record a `decision` to run one more round before applying the plateau rule, if the budget allows.
- A plateau before a cliff. Some search spaces are flat for a long stretch and then drop sharply (a configuration threshold, a data structure change). A Devil's Advocate lane and level-2 radical shifts are the conference's tools for crossing such a stretch.
- A breakthrough in flight. A lane that reported `PARTIAL` at the deadline with a promising unfinished change has not been measured. Its next round may change the picture.
- A stop because the early rounds "look fine". The user approved a budget; spending it is the expected path unless one of the right early stops applies.

### Spending the whole budget is right when

- The conference is exploratory and the user wanted coverage of the space.
- The metric is noisy, so more rounds give the Reviewer more evidence.
- The mode is qualitative, so self-scores are weak and every round gives the Reviewer another chance to correct course.

### Spending the whole budget is wrong when

- The plateau was clear three rounds ago and the window was set too long. Fix the window for the next conference and record the waste in the analysis.

## Round-by-round shapes

Analyze mode uses these shapes to describe a finished conference. They also help the Chair recognise where it is.

### Quick convergence (2 to 3 rounds)

```text
round 1  lanes try different families; one finds a strong direction
round 2  transfer spreads it; every lane refines it
round 3  no gain above the floor in rounds 2 and 3 -> CONVERGED
```

A small search space with one clear direction. A conference may have been more than the problem needed; analyze mode says so and recommends `autoresearch` for similar problems.

### Gradual convergence (5 or more rounds)

```text
rounds 1-2  broad exploration, moderate gains
rounds 3-4  validated findings from different lanes combine into better configurations
rounds 5-6  diminishing returns -> CONVERGED
```

A large space with complementary strategies. This is where a conference earns its overhead.

### Breakthrough after a plateau

```text
rounds 1-3  steady gains, then flat
round 4     one lane's radical shift, often the Devil's Advocate, beats the best clearly
round 5     transfer spreads it; fast gains
round 6     new plateau -> CONVERGED
```

Local optima in the space. Without the two-round window this conference would have ended at round 3.

### Stalled conference

```text
rounds 1-2  moderate gains
round 3     every lane at stuck level 2 or 3 -> STALLED -> synthesis
```

The space is too narrow, or the problem is harder than the setup allows. The synthesis still has value: the record of failed families tells the user what not to try and which constraint to relax.

### Budget stop while still improving

```text
rounds 1-N  gains every round, no plateau
round N     the next round does not fit -> BUDGET STOP -> synthesis
```

The space still had room. The final report recommends a follow-up conference with a larger budget or narrower lane focuses, and the reply says plainly that the budget ended the run while the metric was still moving.

## What the Chair records for each call

- When an end condition fires: a `conference.converged`, `conference.stalled` or `conference.budget_stop` event with the rule that fired, the current best, the previous best, the floor, and the counting status of the last two rounds. When none fires, the `round.completed` payload carries the same numbers.
- A `decision` ledger line in `.litgravity/ledger/<conversation-id>.jsonl` with the same rule in one sentence.
- In the final report, the end code and its reason in plain words. A `BUDGET STOP` is reported as a budget stop, including when the best value looks close to the target.

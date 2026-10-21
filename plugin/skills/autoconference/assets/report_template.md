# Conference Report: {Title}

Generated: {date}
Rounds run: {n} of {max_rounds}
Total iterations: {sum across researchers} of {max_total_iterations}
Budget used: children {c} of {children}, model calls {m} of {model_calls}, wall clock {t}
Best validated result: {value} ({direction}: {metric name})
Stop verdict: {TARGET_REACHED | CONVERGED | BUDGET STOP | STALLED | CANCELLED}

---

## Executive Summary

{Two or three sentences: what was researched, the best validated result, and the main insight from the synthesis.}

## Best Result

- Source: Researcher {ID}, Round {n}, Iteration {i}
- Change: {what differs from the baseline}
- Metric value: {value} (baseline {baseline}, change {delta})
- Verification: {re-measurement receipt: runs, mean, spread}

## Conference Timeline

| Round | Phase | Key event | Metric |
|-------|-------|-----------|--------|
{rows}

## Per-Researcher Summary

| Researcher | Focus | Iterations | Best metric | Kept changes | Stuck level | Lane status |
|-----------|-------|------------|-------------|--------------|-------------|-------------|
{rows}

## Peer Review Summary

| Round | Validated | Challenged | Overturned |
|-------|-----------|------------|------------|
{rows}

## Key Findings

1. {A pattern seen across researchers}
2. {What worked consistently}
3. {A result that only the combination of lanes produced}

## Failed Approaches

1. {Approaches several researchers tried that failed}
2. {Dead ends worth recording}

## Dissent

{Claims the reviewer challenged that stayed open, and researcher disagreements the synthesis could not settle.}

## Recommendations

- {Next steps}
- {Areas the synthesis identified and nobody explored}

# Scoring rubric

Score only after the user confirmed the criteria and weights. Every criterion uses a 1 to 5 scale where 5 is best for the user, and every score carries an evidence note.

## Default criteria

| Criterion | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Impact | barely moves the goal | a visible gain for some users | transforms the goal for most |
| Effort (scored inverted: low effort is high) | months, many people | weeks, a small team | hours or days, one person |
| Risk | likely to fail or cause harm | known risks with mitigations | well understood, little downside |
| Reversibility | permanent or costly to undo | undoable with real work | undoable cheaply and quickly |
| Time to first value | after the whole build | after a major milestone | in the first step |
| Fit with constraints | strains a soft constraint | meets all, with trade-offs | meets all, with margin |
| Novelty | already common | a fresh angle on a known path | unseen in this context |

Add any criterion the frame implies, such as "works offline" or "adds no dependency".

## Weights

A criterion is a gate (pass or fail), high (3), normal (2) or low (1). The weighted total is the sum of weight times score, divided by five times the sum of the weights, shown as a percentage. Show the unweighted average beside it and report a flip when the two rank the ideas differently.

## Evidence labels

Each score gets one label: `data` (a measured number or a source), `prior` (a cited earlier case), `repo` (read from the code), `judgement` (an estimate by the model or the user). A shortlist entry resting on judgement alone carries that label.

## Ties and close calls

Totals within five percentage points are not reliably ordered. Break the tie by higher reversibility, then faster time to first value, then the user's stated lean, and say which tie-break was used.

## Provisional scores

In a headless run, or when the user left the criteria unanswered, mark every score "provisional: criteria not confirmed". A provisional ranking never overrides the user's own lean.

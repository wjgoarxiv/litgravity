# Convergence matrices

## 1. Affinity clustering

1. Print every idea by id with its one-line text.
2. Put the first idea in cluster 1. Each next idea joins the cluster whose underlying move it shares or starts a new one. Group by the move, not by the wording.
3. Name each cluster with a verb phrase ("Remove the step", "Let the user bring their own").
4. Clusters with a single idea move to an `orphans` group unless the idea is clearly distinct.
5. Record for each cluster: the id list, a one-line summary and its strongest representative.

## 2. Impact versus effort grid

| | Low effort | High effort |
| --- | --- | --- |
| High impact | do first (quick win) | plan carefully (big bet) |
| Low impact | fill-in | drop |

Use the 1 to 5 scores: impact of 4 or more is high, and an effort score of 4 or more (inverted, so cheap) is low effort.

## 3. Weighted matrix

Rows are ideas, columns are criteria with their weights, and the last columns hold the weighted total and the unweighted average. Sort by weighted total and flag every gate failure `OUT`.

## 4. Pairwise duel

For the top five when totals sit within ten percent of each other, compare every pair on one question: "Which would you rather have if only one could ship?" Count the wins. The duel breaks near-ties and is reported next to the matrix.

## 5. Risk and reversibility screen

| | Easily reversed | Hard to reverse |
| --- | --- | --- |
| Low risk | go | go with a checkpoint |
| High risk | pilot first | needs `lit-crucible` before any plan |

An idea in the bottom-right cell triggers the offer of `lit-crucible` at hand-off.

## 6. Shortlist composition check

Before asking for confirmation: at least one safe option; at least one that differs in kind; no two entries sharing an underlying move; a named first step for each. When two entries share a move, replace one with the best idea from a different cluster.

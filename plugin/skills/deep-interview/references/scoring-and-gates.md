# Scoring and readiness gates

The ambiguity score is a bookkeeping device for honest self-assessment. It is only as good as the evidence behind each dimension score, so every score carries a one-line justification and the remaining gap.

## Weights

Greenfield: `ambiguity = 1 - (intent x 0.30 + outcome x 0.25 + scope x 0.20 + constraints x 0.15 + success x 0.10)`.

Brownfield: `ambiguity = 1 - (intent x 0.25 + outcome x 0.20 + scope x 0.20 + constraints x 0.15 + success x 0.10 + context x 0.10)`.

Scores are clarity values from 0.0 (unknown) to 1.0 (settled by the user or by repository evidence). Round the final percent to a whole number for display and keep two decimals in the state file.

## Dimension rubric

| Score | Meaning | Typical evidence |
| ---: | --- | --- |
| 0.0 to 0.2 | Not discussed, or only a guess. | The initial request alone. |
| 0.3 to 0.4 | Mentioned in general terms. | "Make it faster", "improve onboarding". |
| 0.5 to 0.6 | A concrete statement with no example or no boundary. | "Export should include invoices" without a format or range. |
| 0.7 to 0.8 | Concrete, with an example or a stated boundary. | An example row, a stated limit, a named owner. |
| 0.9 to 1.0 | Confirmed by the user after a pressure follow-up, or fixed by repository facts. | User confirmed after a counterexample; a test already pins the behavior. |

Caps that keep the number honest:

- A brainstorm seed counts at most 0.6 per dimension until the user confirms the point in round 1 or 2.
- An accepted default (the user said "your call" or nobody answered) counts at most 0.7, and the spec lists it under Assumptions with a confirmation point.
- Success criteria cannot pass 0.6 without a named command, page or number.
- Context (brownfield) cannot pass 0.6 until a file was actually opened for the named touchpoints.

## The three gates

| Gate | Met when | Evidence kept |
| --- | --- | --- |
| Non-goals explicit | The user confirmed at least one thing the work will not do, or confirmed there is nothing to exclude after being shown candidates. | The confirming round number. |
| Decision boundaries explicit | The spec can list what the implementer may decide alone and what needs the user, and the user agreed to the split. | The confirming round number. |
| Pressure pass done | An earlier answer was revisited with an evidence, assumption or tradeoff follow-up, and the revisit either confirmed it or changed it. | The pair of round numbers. |

A gate that is open keeps the interview going even when the weighted number is already under the threshold. A gate that is met stays met unless a later answer contradicts it; then reopen it and say why.

## Stage order

- Stage 1, intent-first: intent, outcome, scope, non-goals, decision boundaries.
- Stage 2, feasibility: constraints, success criteria.
- Stage 3, brownfield grounding: context clarity.

Aim at the weakest dimension inside the current stage. Move to the next stage when the current stage's dimensions are all at 0.6 or above, or when the round budget's midpoint has passed.

## Stall and exit rules

- Three rounds with movement of 0.05 or less: run the Ontologist mode once.
- All dimensions at 0.9 or above: crystallize before the cap.
- The user says "good enough" from round 4: crystallize with the current numbers and write the residual risk.
- The hard cap is reached: crystallize with the residual risk.
- Ambiguity above the threshold at handoff: the user opts in to proceed with a warning, and the warning is in the spec metadata.

## Worked score sheet

Round 5 of a Standard brownfield interview on "add audit export":

| Dimension | Score | Why |
| --- | ---: | --- |
| Intent | 0.85 | Compliance team needs a quarterly file for the auditor; confirmed with an example from last quarter. |
| Outcome | 0.70 | One CSV per quarter; format agreed, delivery channel open. |
| Scope | 0.75 | Invoices and refunds in, payouts out; date range fixed to calendar quarters. |
| Constraints | 0.60 | Auditor needs UTF-8 CSV; retention rule unknown. |
| Success | 0.45 | No command or page named yet. |
| Context | 0.70 | `src/export/` read; two parsers found. |

Weighted: 0.85x0.25 + 0.70x0.20 + 0.75x0.20 + 0.60x0.15 + 0.45x0.10 + 0.70x0.10 = 0.2125 + 0.14 + 0.15 + 0.09 + 0.045 + 0.07 = 0.7075, so ambiguity is 29%. Success criteria is the weakest dimension and the next question asks which command or page proves the export is right.

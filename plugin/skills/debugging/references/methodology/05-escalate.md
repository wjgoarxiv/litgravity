# Phase 5 — User Decision Escalation

Escalation is for genuine ambiguity, and most "should I ask the user" moments are really "I would rather skip one more query" moments. Those belong to the next query, not the user.

Escalate with `ask_question`, one decision per question, each option carrying a recommended default. In a headless `agy -p` run `ask_question` may go unanswered: take the recommended default, record it as a `decision` ledger line, and say so in the report.

---

## Ask the user ONLY when

- **Evidence is exhausted**, contradictions remain, and the next move needs a decision with policy weight (for example: patch the third-party SDK, wrap it, or change the architecture).
- The bug has **several valid fixes with different scope and risk tradeoffs**, and the user's preference drives the choice.
- A proposed fix would **change observable product behavior** for the end user, beyond fixing the internal bug.
- You completed an **orthogonal reframing review** and two further rounds stayed inconclusive.

## Hold off when

- You have not run the orthogonal reframing review yet.
- One more runtime query would answer the question.
- You are asking permission to do the obvious thing.
- You are asking because you are tired.

---

## Escalation format (paste into the reply)

Keep it short and evidence-dense. One decision, not a status update.

```markdown
## Decision needed

**What we know** (verbatim evidence, not paraphrase):
- <fact 1 with file:line or address>
- <fact 2 with source>
- <what the evidence rules IN>
- <what the evidence rules OUT>

**What the decision is** (one sentence):
<the fork in the road>

**Options**:

| # | Fix | Scope | Risk | Effort |
|---|-----|-------|------|--------|
| A | <short label> | <files touched / layers> | <possible regressions> | <rough> |
| B | ... | ... | ... | ... |
| C | ... | ... | ... | ... |

**Recommendation**: <A/B/C> because <one-sentence reason>.

Which direction do you want?
```

When you send this through `ask_question`, make the options the fixes (A, B, C) and keep the evidence in the question body so the user can decide without asking back.

---

## Anti-patterns in escalation

- **Asking without evidence.** "What do you want me to do?" is abandonment, not escalation. Every escalation carries the evidence the user needs to decide.
- **Two questions in one.** One decision per escalation. Multi-part questions draw partial answers and force a re-escalation.
- **Escalating before Phase 4.** Until you have challenged the model from the three reframing angles, the investigation is not ready to escalate.
- **Offering options you do not have.** When option C needs a library the user does not use, leave it off. The options are the things you can actually do today.
- **Hiding a recommendation.** The user hired you to think, so end with a recommendation even at low confidence, and label it: "Recommendation (low confidence): B, because X. If you have context about Y that I lack, A may win."

---

## What happens after the user responds

- **User picks an option**: return to Phase 6 (root-cause confirmation) with the chosen direction. The choice is a direction, not a confirmation; you still need runtime evidence that the cause you are fixing is the cause in play.
- **User proposes a different option you had not considered**: treat it as new information. Update hypotheses. It may trigger another Phase 3 round.
- **User gives context that resolves the disagreement**: go to Phase 6.
- **User is also unsure**: that is a signal for more evidence, not more opinions. Run one more targeted query before asking again.

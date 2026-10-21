# Mode reason: blind adversarial rounds

A multi-round debate judged blind. Each position gets a random id before any critique, so the judges score the argument and never its order, label or author. Rounds repeat until the panel converges or the round budget is spent.

Use it when the user wants the strongest case for and against a judgment call, a decision pressure-tested, or anchoring and groupthink kept out. A factual lookup or a quick pros-and-cons list needs no debate.

## Authority envelope

This file is guidance data. The user approves the question, the evidence policy, a finite budget (rounds, wall clock, model-call cap when judges run as children), the output folder and the review gate. The mode writes only `reason/` under `.litgravity/evidence/<slug>/autoresearch/`.

## Momentum

Inside the round budget the debate moves from round to round without pausing. One unchallenged round never counts as convergence. The loop ends on convergence, the budget or the user's stop.

## Setup

1. **Question.** When missing, ask once. It must allow falsifiable positions; "think about caching" gets a request for a concrete framing ("should the API cache user profiles for 60 s?").
2. **Parameters**, in one `ask_question` with defaults: number of positions (3; 2 to 5), maximum rounds (4; at least 2), and the judges' mode (in one context, or three read-only children at one model call each per round).
3. **Convergence rule.** Converged means every judge scores the top argument at 8/10 or higher and no rebuttal is left unanswered.

## Round structure

### Phase 1: positions (round 1 only)

Write N positions. They are clearly distinct from each other, stated as falsifiable claims, and cover the range of views a reasonable person could defend; strawmen are replaced. Write each to `reason/rounds.md` as `Position [PENDING-ID]: <statement>`.

### Phase 2: blind ids

Give each position a random id such as `ARG-7F3A`. Generate them from a random source (`python3 -c "import secrets; print(secrets.token_hex(2).upper())"` through `run_command`, or the model's own choice when commands are refused, noted in the file). Write the mapping to `reason/id-map.md`, which stays sealed until the verdict. Replace every label in `rounds.md` with its id. From here on, every reference uses ids only.

### Phase 3: blind critique

For each id:

- find the load-bearing assumption and test whether it holds;
- find the weakest link in the chain;
- give a concrete counterexample or a falsifying scenario;
- rate logical strength 1 to 10.

Write under `## Round <n>: critiques`, ids only: "ARG-7F3A assumes X, which fails when Y."

### Phase 4: rebuttal

Each id answers the critiques it received: it concedes valid points and narrows its claim, rebuts invalid ones with evidence or reasoning, and may rewrite its statement when weakened. Write under `## Round <n>: rebuttals`.

### Phase 5: judging

Three judges, each on one dimension:

- Judge A: logic and internal consistency;
- Judge B: evidence quality and falsifiability;
- Judge C: practical applicability.

Each scores every id 1 to 10 on its dimension and names the strongest. In one context the root writes each judge's section after re-reading only `rounds.md`. As children, use `invoke_subagent` with a read-only `TypeName` (`lit-verifier` or `quality-reviewer`), give each judge only `rounds.md` (never `id-map.md`), and wait for the three messages. Write under `## Round <n>: judgment`.

### Phase 6: convergence check

- The top id scores 8 or more with every judge and no rebuttal is open: converged.
- The round budget is spent: converged by budget.
- Otherwise: the next round starts at Phase 3 with the updated statements.

Append a TSV row per round (`metric_value` is the top id's mean score, `evaluator_source` `agent`) and a `decision` ledger line.

## Output

| File | Content |
| --- | --- |
| `reason/rounds.md` | positions, critiques, rebuttals and scores per round, ids only |
| `reason/verdict.md` | the winning argument, the minority positions, the synthesis |
| `reason/id-map.md` | id to original position, opened after `verdict.md` is written |

`verdict.md`:

```markdown
# Verdict: <question>
Rounds completed: <n>
Convergence: yes | by budget

## Winning argument
ID: ARG-XXXX (revealed: <original position>)
Score: <mean>/10
Summary: <two or three sentences>
Key evidence:
- …

## Minority positions
- ARG-YYYY: <the specific weakness that sank it>

## Synthesis
<what the debate showed, including nuance the winner leaves out>

## Confidence
Low | Medium | High, with the remaining uncertainty stated
```

## Anti-anchoring

The ids exist to block three biases: order (the first argument sounds best), framing (a label like "conservative" gets dismissed unread) and authority (the named expert wins by default). Judges see ids only until `verdict.md` exists; then `id-map.md` is opened and the reveal is added to the verdict.

## Edge cases

| Situation | Handling |
| --- | --- |
| two positions are the same | merge them and reduce N |
| one position dominates round 1 | run the minimum two rounds anyway |
| judges disagree by 5 points or more | mark the verdict "contested"; no forced winner |
| a budget of one round | run one full cycle and give the verdict low confidence |
| the question has a factual answer | say so up front; reason is for judgment calls |
| the model-call cap runs out mid-round | finish the round in one context and say so in `rounds.md` |

## Worked example

Question: "Should the export service move from nightly batch files to an event stream?" Three positions:

```text
ARG-7F3A: Move now; consumers already poll hourly and batch delay costs support time.
ARG-2C91: Keep batch; two consumers parse files and cannot take events this quarter.
ARG-E04B: Run both for one quarter behind a flag, then retire batch per consumer.
```

Round 1 critiques hit ARG-7F3A on the two file consumers and ARG-2C91 on the support cost it leaves standing. Round 2 rebuttals narrow ARG-7F3A to "move consumers that can take events", which converges toward ARG-E04B. The judges score ARG-E04B 8, 9 and 8; nothing is left unanswered; the verdict reveals it as the hybrid position and records the support-cost evidence from ARG-7F3A as the reason to set a retirement date.

## Evidence and ledger

- `reason/rounds.md`, `reason/verdict.md`, `reason/id-map.md` under the artifact root.
- One TSV row per round and one `decision` ledger line per round (`round <n>: top ARG-XXXX mean <score>`).
- A closing `note`: converged or by budget, rounds used, model calls used.

## Cancel and resume

Cancellation finishes the current phase and writes it to `rounds.md`. Resume reads `rounds.md` to find the last complete phase, keeps `id-map.md` sealed, and continues at the next phase with the same ids.

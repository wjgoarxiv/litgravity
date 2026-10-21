# Interview protocol: scoring a deck request

The interview turns a loose request ("make me a deck about the library's new lending service") into a
spec that a writer can build from. It runs as a short loop of scored rounds. Each round asks one
question, aimed at the weakest of four dimensions, and ends with a new ambiguity number. The stage
file `references/stages/interview.md` is the procedure; this file holds the scoring model, the state
file, the question bank, the challenge prompts and the spec that comes out.

## Dimensions and weights

| Dimension | Weight | What a score of 1.0 means |
|---|---|---|
| Topic and purpose | 0.30 | The topic is one sentence and the key message is a claim a reader could disagree with |
| Audience and context | 0.25 | The viewers, what they already know, the room or channel and the decision that should follow are all named |
| Structure and scope | 0.25 | Slide count, sections, the order of the argument and the direction (tonality) are settled |
| Data and evidence | 0.20 | Every number, table, chart and image the deck needs is either in hand or marked as an invented example |

Score each dimension from 0.0 to 1.0 in steps of 0.05. A dimension with no information at all scores
0.0; one with a guess the user has not confirmed scores at most 0.4.

```
ambiguity = 1 - (topic*0.30 + audience*0.25 + structure*0.25 + data*0.20)
```

- `ambiguity <= 0.20`: the spec can be written.
- `ambiguity > 0.20`: ask another question.

Worked example. A bakery chain's planning team asks for "a quarterly results deck". Topic 0.7 (results
for one quarter, key message open), audience 0.5 (executives, decision unknown), structure 0.3 (no
count, no direction), data 0.4 (figures exist in a spreadsheet, not shared). Ambiguity is
1 - (0.21 + 0.125 + 0.075 + 0.08) = 0.51. The weakest dimension by weighted gap is structure
(0.25 x 0.7 = 0.175, against topic 0.09 and audience 0.125), so round 2 asks about structure.

## State file

The interview keeps its state in `.pptx-pipeline/interview-state.json` inside the user's working
directory:

```json
{
  "active": true,
  "rounds": [],
  "current_ambiguity": 1.0,
  "threshold": 0.20,
  "challenge_modes_used": [],
  "direction": { "tonality": null, "alternatives": [], "reason": null },
  "started_at": "<ISO timestamp>"
}
```

Append one object per finished round to `rounds`: the round number, the dimension targeted, the
question, the answer in one line, the four scores and the resulting ambiguity. Evidence worth keeping
beyond the interview (the analyst's extraction, the final scores table) goes to
`.litgravity/evidence/<slug>/`, where `<slug>` is the lowercase hyphenated deck topic.

## Round 1: first assessment

1. Start the read-only analyst child (`references/agents/analyst.md`) on the user's request and any
   files they named. It returns the extraction and a first score for each dimension in its message.
2. Take its scores, apply the weights, and record them as round 1.
3. When ambiguity is already at or under 0.20, jump to the spec. Otherwise show the four scores in a
   small table and ask the first question.

## Rounds 2 and later: one question each

Aim at the dimension that costs the most points (weight times the gap to 1.0). Offer a recommended
default in every question, because `ask_question` can go unanswered in a headless run and the default
then becomes the answer on record.

| Dimension | Question shape | Example in context |
|---|---|---|
| Topic and purpose | Ask for the claim | "When you say 'results', is the claim that the quarter beat plan, or that one product line needs a fix?" |
| Audience and context | Ask who decides what | "Is this read by the board before the meeting, or presented to branch managers who will not see the figures first?" |
| Structure and scope | Offer two concrete shapes | "A 10-slide sequence of cover, agenda, four findings, a decision and a close, or a 6-slide short form?" |
| Data and evidence | Ask where the numbers live | "Are the monthly figures in a file you can share, or should the deck carry clearly marked example figures?" |

## Challenge prompts

Each prompt is used once per interview and then the questions go back to the table above.

| From round | Mode | Prompt |
|---|---|---|
| 3 | Contrarian | "If the audience already knows this story, what would they still need from the deck?" |
| 5 | Simplifier | "Which two slides could be removed without anyone asking where they went?" |
| 7 | Redesigner | "If this were a one-page summary, which sentence would be lost?" |

Record each used mode in `challenge_modes_used`.

## Limits and early exit

- Round 5: ask whether to continue or build with the current clarity.
- Round 10: stop and build with the current clarity; the spec records the ambiguity that remained.
- At any round the user can say "enough", "let's go" or "build it", and the interview closes with the
  unresolved dimensions listed in the spec.

## Output: the spec file

Write `.pptx-pipeline/spec-<slug>.md` when the interview closes:

```markdown
# Deck spec: <title>

## Metadata
- Interview rounds: <n>
- Final ambiguity: <percent>
- Generated: <timestamp>

## Deck configuration
- Direction: <tonality>, alternatives <two tonalities>, reason <one line> (from the direction card in
  references/direction-step.md); a legacy or learned template only when the user named it
- Faces: Pretendard by default; A2Z faces when the user asks for them
- Slide count: <n>
- Language: <the user's language; Korean with English technical terms is fine>

## Slide-by-slide plan
### Slide 1: cover
- Title, date, department, presenter
### Slide 2: agenda (decks over 5 slides)
- Items
### Slides 3..N: content
- Family from the pack, topic label as title, the claim as the first point, key points
### Slide N+1: summary or decision
### Slide N+2: closing

## Data requirements
- Tables: what data, rows by columns
- Images: subject, source or "generate", alt text
- Charts: kind, data source, unit

## Open items
- Dimensions still below 0.8 and what would settle them
```

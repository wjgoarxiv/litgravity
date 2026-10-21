# Question craft for deep-interview

How to turn the weakest dimension into one good question per round. Read this before round 1 and again whenever two rounds in a row move the score by less than 0.05.

## Anatomy of a round question

Every question has four parts, in this order:

1. The evidence line (brownfield only): one sentence naming what the repository already shows, with `path:line`. "`src/export/csv.js:88` writes columns in a fixed order."
2. The question: one sentence the user can answer in a clause or a choice.
3. The recommended answer with its reason: what a plain "yes" settles.
4. The downstream effect: what changes in the plan when the answer flips.

```text
3. Should the new export keep the current column order?
   Evidence: tools/merge.py:14 and tools/diff.py:9 read the CSV by position.
   Recommended: yes - two scripts parse by position and nothing else reads the file.
   Changes: "no" adds a task to update both scripts and a compatibility note.
```

Offer two to four options in `ask_question`, the recommended one first, each with a short label. The free-text escape stays open because the best answer is often a fifth option nobody listed.

## The follow-up ladder

Treat each answer as a claim. After it arrives, climb at most one rung per round:

1. Example: "Which real case from last week would have gone differently with this?" A claim without an example stays at its current score.
2. Assumption: "This works only if X holds. Does X hold for the batch jobs too?"
3. Boundary: "If this had to be half the size, which half would you drop?"
4. Essence: "Is the slow dashboard the problem, or is the problem that nobody knows when the data is stale?"

Stay on one thread while it keeps paying. A thread pays when the latest answer made the weakest dimension at least 0.1 clearer. When it stops paying, switch dimensions.

## Question families per dimension

| Dimension | Opening questions | Pressure follow-ups |
| --- | --- | --- |
| Intent | Who is blocked or annoyed today, and how do they notice? What happens if nothing changes for a month? | Which earlier attempt failed and why? Who else cares about this outcome? |
| Outcome | After this ships, what does one concrete user do differently? What would you demo? | Name a result that looks like success and still disappoints you. |
| Scope | Where does the change start and where does it stop? Which entry points count? | Which adjacent thing is tempting to include, and what does including it cost? |
| Non-goals | What would you refuse even if it were free? What is deliberately left for later? | If a reviewer found X in the diff, would you reject it? |
| Decision boundaries | Which choices may the implementer make alone: naming, libraries, file layout, migration order? Which need you? | If the implementer finds two valid designs, who breaks the tie and by what rule? |
| Constraints | Deadlines, budgets, compatibility promises, forbidden dependencies, review rules? | Which constraint is real and which is habit? |
| Success criteria | Which command, page or number tells you it works? Who checks it? | What observation would make you say it failed even though the tests pass? |
| Context (brownfield) | I found X in Y: should this follow that pattern? | Is the existing pattern a fixed rule or an accident of history? |

## Challenge modes, scripted

Each mode runs once. The question is still a single question with a recommended answer.

- Contrarian. State the opposite of the assumption in the user's last answer and ask what would have to be true for the opposite to hold. Example: "You said every export must stay synchronous. If one report took ten minutes, would you still hold that?"
- Simplifier. Remove half the stated scope and ask whether the user would still ship. Example: "If only the CSV path shipped first and PDF followed later, what breaks?"
- Ontologist. Ask what the thing is, one level above the request. Example: "Is this a reporting feature or an audit trail? The answers lead to different storage."

Record the mode in the round entry (`challenge_mode`) and in `challenge_modes_used`.

## Questions the repository answers

Never ask these. Read the code, then write the answer in the context snapshot under Known facts:

- Which test runner, linter, formatter or package manager the project uses.
- Where a named feature lives, how it is wired, and what its current behavior is.
- Which files an earlier commit touched for a similar change (`git log --oneline -20 -- <path>`).
- Which dependencies and versions are installed.

Ask only what the files cannot say: purpose, priority, tolerance for risk, who decides, what to leave out.

## Bad questions and their repairs

| Bad question | Why it fails | Repair |
| --- | --- | --- |
| "What are your requirements?" | Hands the design back to the user. | Offer two candidate outcomes and ask which is closer. |
| "Do you want it fast, cheap and good?" | Every option is yes. | "If speed and thoroughness conflict on the nightly job, which wins?" |
| Three questions in one message | The answers blur and the score cannot move per dimension. | Ask the highest-leverage one, queue the rest in the state file under `unknowns`. |
| A question with no default | Forces a reply when any answer would do. | Add the recommended answer and what flips. |
| A leading question | The user echoes it. | Show both sides and ask which cost they accept. |

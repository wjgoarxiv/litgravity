# Idea lenses

A lens is a short question that forces an idea of a different kind. Reach for these when the variety check shows one mechanism holding more than half of the board, when a round adds fewer than three new ideas of a new kind, or when the user says "these all feel the same". Pick two lenses per stuck round, write at least two ideas through each, and tag them `[lens:<name>]`.

## The fifteen lenses

| Lens | Question | Typical yield |
| --- | --- | --- |
| Remove | What if the step, the person or the product did not exist? | deletion ideas, "do nothing" baselines |
| Automate | Which part repeats enough for a machine to own it? | triggers, schedules, defaults |
| Move | What if it happened elsewhere (client, server, edge, the user's desk)? | relocation ideas |
| Delegate | Who else could do this better or cheaper? | partner, user-supplied, community ideas |
| Defer | What if it happened later, or only when needed? | lazy, on-demand, batch ideas |
| Advance | What if it happened earlier, before the problem exists? | prevention, validation-at-source ideas |
| Shrink | What is the smallest version a real person would still use? | thin slices, pilots |
| Stretch | What if it had to serve ten times the people or data? | scale ideas that reveal hidden limits |
| Reverse the flow | What if the receiver started instead of the sender? | pull instead of push, subscriptions |
| Make visible | What if the hidden state were shown? | dashboards, receipts, previews |
| Make optional | What if it were a choice and not a rule? | opt-in, tiers, escape hatches |
| Make social | What if others could see, share or review it? | collaboration, review, templates |
| Borrow | Who solved the same shape elsewhere? | transplanted mechanisms |
| Price it | What if it cost something, or paid for itself? | incentive and budget ideas |
| Fail on purpose | What if it were allowed to fail, and how would it recover? | graceful degradation, retries, undo |

## Prompts by problem type

Use the row that matches the frame. Each cell is a prompt for one or two ideas.

| Problem type | Prompts |
| --- | --- |
| Product or feature | Who is the least-served user today and what do they try instead? What would a one-screen version do? Which paid feature could be free if another part carried the cost? |
| Process or workflow | Which approval protects against a risk that no longer exists? Which handoff loses information? What would the process look like with no meetings? |
| Code or architecture | What would this look like with no new dependency? Which module could be deleted if its caller changed? What is the same logic written three times? |
| Documentation or content | What does a reader need in the first ten seconds? What would a table replace? Which section exists because the author needed it and the reader did not? |
| Naming or positioning | What does the user call it when nobody is watching? Which word would a competitor never use? What is the name that needs no explanation? |
| Growth or adoption | What stops the first ten minutes from succeeding? Where do people stop? What would make someone show it to a colleague? |
| Cost or performance | What is measured and what is guessed? Which cost is paid per request and could be paid once? What is the cheapest thing that is good enough? |
| Risk or safety | What is the smallest harm that could happen, and who would feel it first? Which control can be removed because another already covers it? |

## Breaking a mechanism monopoly

When the board has one dominant mechanism:

1. Name it in a sentence ("every idea caches results").
2. Write its opposite ("every request is computed fresh") and ask what that world needs to work.
3. Run the Remove, Defer and Reverse-the-flow lenses once each.
4. Add one idea from outside the domain through Borrow.
5. Re-run the variety check. The round passes when no mechanism holds more than a third of the new ideas.

## Mixing in the user's ideas

User ideas go on the board verbatim. Offer lenses on the user's idea to extend it, for example "this idea through Shrink and Make visible", and record the extensions as new ids with `from:` links and the lens tag. The original stays untouched and unranked.

## Lenses for a stuck user

A user who gives short or no answers is a signal about the prompt. Offer a concrete starting point instead of an open question:

- "Here are three directions on a spectrum, from the smallest change to the biggest. Where on this line does your gut sit?"
- "Which of these two would you be embarrassed to ship?"
- "Finish this sentence: the best outcome is when…"

## Quality bar for a divergent round

- At least two ideas that would surprise the user.
- At least one idea the model considers slightly embarrassing; those are often the unusual ones.
- No two ideas that a reviewer could swap without changing what gets built.
- Every idea names what it changes, in a sentence a stranger could follow.

## Ending a lens session

Stop a lens pass at its count target and return to the main flow: add the ideas to the board with their tags, run the variety check, then continue to the next round or to clustering. A lens pass adds ideas and leaves the judging for the converge phase.

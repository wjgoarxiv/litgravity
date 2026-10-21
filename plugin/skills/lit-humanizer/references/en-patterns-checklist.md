# English review checklist

Run this after a substantive rewrite, once, over the whole revised text. It merges the no-ai-slop evaluation questions with the five stop-slop review dimensions. It helps you reread; it grades nothing and says nothing about authorship.

## Meaning and voice

- Every point, fact, date, name, quotation, number and unit from the source is still there, with the same scope.
- Uncertainty and distinctions survived: "may" is still "may", "some" is still "some", "planned" is still "planned".
- Nothing new arrived: no example, statistic, cause, opinion or source the writer did not supply.
- The writer's vocabulary, cadence, humor, directness and useful rough edges are still recognizable.
- Clear sentences were left alone. Cuts removed only what delayed, repeated or distorted the point.
- The structure is the writer's, unless a specific structural choice made the piece harder to use.

## Sentence and paragraph pass

- Sentences open with the subject or the action when that helps the reader; personal setup that gives real context stays.
- Verbs are direct where the source supports it. An actor appears only when the source names one.
- Generic claims became the supplied fact. Where the source is silent, the gap is named once instead of filled.
- Each surviving transition, contrast, triad, fragment, kicker and recap does a job.
- Paragraph and list sizes fit the genre. Tables, slide labels, checklists and legal sequences can be regular by design.
- Bold, emoji, title case, dashes and quote marks follow the document's style guide.
- Required cautions, citations, legal wording and technical precision are intact.

## Five review questions

Score each from 1 to 10 only when a numeric note helps someone:

| Dimension | Question |
|---|---|
| Directness | Does the text state its point without announcing it first? |
| Rhythm | Do sentence and paragraph lengths follow the ideas? |
| Trust | Does the prose let the reader draw the obvious inference? |
| Authenticity | Does it still sound like the intended writer, in the intended genre? |
| Density | Does every sentence add a fact, a relation, a limit or a needed transition? |

stop-slop suggests revising when the total falls below 35 of 50. Treat that as a prompt to reread. It is not a release gate or a grade, and a genre, a reader or a voice can justify a low score on one dimension.

## Final read

1. Read the full revision once, aloud or in one uninterrupted pass.
2. Compare every changed claim with the source, sentence by sentence.
3. Run `scripts/detect.mjs` on the changed text only. Resolve every block; read every warning in context and keep or revise it on purpose.
4. Return the requested artifact. Mention a material limitation once, in the channel `references/deliverable-channels.md` assigns it.
5. For a detection-only request, report locations and candidate fixes and leave the draft unchanged. Report patterns; never label the author.

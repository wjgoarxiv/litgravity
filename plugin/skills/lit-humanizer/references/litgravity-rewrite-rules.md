# Korean rewrite rules

A restrained rewrite is the goal. Every sentence does not need to become elegant; the passage needs to sound like careful Korean written for its situation, with the original meaning intact. In the Korean deep sequence these rules brief the `korean-prose-editor` agent, which works from the map the `korean-style-analyzer` produced.

## Order of work

1. Lock the meaning. Facts, numbers, names, claims, citations, quotations and the requested tone are constraints, never raw material.
2. Repair unclear logic before touching rhythm.
3. Swap generic wording for concrete wording only when the source already supplies the concrete version.
4. Cut accidental repetition.
5. Stop once the passage reads naturally for its context.

## Meaning-safe editing

- Numbers, units, dates, ranges, percentages, grades, model names, organization names and personal names stay as written unless the user asks for a correction.
- A possibility stays a possibility, a correlation stays a correlation, a limited result keeps its limits.
- Evidential hedges stay: `가능성이 있다`, `추정된다`, `일부`, `대체로`, `현재로서는`. When several stack on one claim, keep the one that sets its strength (G-2).
- Citations, footnote markers, document titles, quoted strings and bracketed references stay where they are.
- An ambiguous sentence is clarified only with information the draft contains; when it lacks the information, ask.
- A tone the user required is part of the meaning.

## Sentence moves

- Turn a passive or noun-heavy phrase into a direct predicate when the actor is known (A-8, A-9, A-12, F-4).
- Split a sentence that carries two claims, or a claim plus a caveat (E-5, C-12).
- Merge short sentences that only restate the topic (E-4, C-4).
- Bring the point forward when setup language hides it (D-8, A-3).
- Replace a filler opening with the real subject or action (H-1, H-3).
- Keep a connective only when it names a real relation: addition, contrast, cause, condition, sequence or summary (H-1, H-2, D-1).
- Choose a word order that lets the reader reach the predicate without holding many modifiers (A-18).

## Paragraph moves

- One job per paragraph: context, claim, evidence, implication, limit or next step.
- Put the strongest sentence where it steers the rest.
- Drop framing the previous paragraph already set up.
- Keep lists parallel only when the items really compare (C-1, C-2).
- A warning or limit stays visible as its own sentence; it is never smoothed into the surrounding prose.

## Tone targets

| Genre | Target |
|---|---|
| Formal report (보고서) | Concise, evidence-aware, low drama, stable `~다` or `~습니다` endings |
| Work email | Clear request or action, respectful phrasing, no inflated praise |
| Academic or technical note | Terms intact, hedges only where the evidence needs them, no promotional adjectives |
| Public notice or explanation | Shorter sentences, concrete nouns, gentle transitions, consistent `~습니다` |
| Slide text | Noun-ending fragments allowed, one claim per line, numbers kept exact |
| Personal voice | The writer's own phrasing kept even when unusual; standardize only what blocks understanding |

## Common machine-prose habits and their fixes

- A repeated `중요합니다` becomes the reason it matters.
- A repeated `도움이 됩니다` becomes the actual benefit or action.
- A vague `부분` or `측면` becomes the named object, step, issue or condition (I-2).
- `다양한` stays only when the source names the variety.
- `효율적` needs time, cost, effort, accuracy or reliability behind it (F-5).
- `전반적으로` stays only for a real whole-picture summary.
- `따라서` stays only when the previous sentence proves the next (D-1).
- `~를 통해` and `~에 있어서` in clusters become plain verbs and particles (A-2, A-3).
- `강화`, `제고`, `확대` attached to abstract nouns become the concrete change, when the draft names it (F-7).

## No change or a minimal one

Choose no change, or a minimal one, when a rewrite would only swap one taste for another.

- If the text already reads naturally, say so and return it unchanged or lightly corrected.
- If one sentence is awkward, edit that sentence and leave the rest.
- If the user wants strict preservation, make smaller changes and note what you left alone.
- If a quotation, citation, legal phrase or named label sounds awkward but must stay exact, leave it and polish around it.

## Output of a pass

Return the revised Korean text. Add a short account of what changed, fidelity notes on facts, names, numbers, citations, quotes and tone when they matter, and open questions only when the text cannot be improved safely without the user.

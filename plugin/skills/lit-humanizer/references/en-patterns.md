# English patterns: index

The English catalog has 51 entries in two shards plus a review checklist. This page tells you which file to open, how the entries were merged from their sources, and what the evidence labels mean.

| File | Entries | Open it when |
|---|---|---|
| `references/en-patterns-content.md` | EN-C01 to EN-C20: significance, promotion, vague authority, stock vocabulary, filler, hedging, empty conclusions | The draft's claims or word choices feel inflated, vague or padded. |
| `references/en-patterns-structure.md` | EN-S01 to EN-S31: contrast formulas, triads, rhythm, lists, headings, bold, emoji, dashes, markup residue, citations, chat residue, passive voice, narrator distance | The shape of sentences, paragraphs or the page feels templated, or the draft carries leftover interface text. |
| `references/en-patterns-checklist.md` | Final review questions | You have finished a substantive rewrite and want one last pass. |
| `references/code-patterns.md` | CODE-01 to CODE-12 | The text is a comment, commit, pull request, README or changelog. |

Detector rules with `en-` ids live in `rules.json`; `references/taxonomy.md` maps each rule to these entries.

## How the sources were merged

Five read-only sources describe overlapping tells: the HumanInk catalog (35 numbered patterns with severity weights), the humanizer pattern list, the no-ai-slop evaluation guide, the stop-slop rules, and the Wikipedia field guide "Signs of AI writing" maintained by WikiProject AI Cleanup. Where several sources describe one habit, this catalog merges them into one entry and names the contributors. The wording and every example here are new.

| Merged family | Entries | Contributing source patterns |
|---|---|---|
| Significance, praise, promotion | EN-C01, EN-C04, EN-C13 | HumanInk 1, 4, 32; humanizer 13, 16; no-ai-slop puffery; Wikipedia significance and promotion |
| Borrowed authority and notability padding | EN-C02, EN-C05 | HumanInk 2, 5; humanizer 17; Wikipedia coverage and attribution |
| Shallow analysis riders | EN-C03, EN-C17 | HumanInk 3; humanizer 15; stop-slop unsupported interpretation |
| Stock vocabulary, filler, throat clearing | EN-C07, EN-C10, EN-C19 | HumanInk 7, 22, 30; humanizer 4, 12; no-ai-slop word list; stop-slop phrase list |
| Generic contrast, false range, dead metaphor | EN-C12, EN-C16, EN-S01, EN-S04 | HumanInk 9, 12, 26; humanizer 1, 3; stop-slop structures |
| Triads, transitions, synonym cycling | EN-S02, EN-S07, EN-C12 | HumanInk 10, 11, 27; humanizer 6, 7; stop-slop rhythm |
| Source gaps and model-limit wrappers | EN-C15, EN-S21, EN-S22 | HumanInk 20; humanizer 23; Wikipedia communication categories |
| Generic conclusions and mirrored openings | EN-C11, EN-S08, EN-S27 | HumanInk 6, 24, 28; humanizer 2, 13; no-ai-slop ending checks |
| Decoration and list templates | EN-S10 to EN-S19 | HumanInk 14 to 18, 34, 35; humanizer 19 to 21; Wikipedia style categories |
| Chat residue and sycophancy | EN-S26 | HumanInk 19, 21, 33; humanizer 4, 22; no-ai-slop conversational residue |
| Paragraph and document rhythm | EN-S03, EN-S09 | HumanInk 29, 31; humanizer 2, 6, 7; stop-slop rhythm rubric |
| Announced points and absolutes | EN-C19, EN-C20, EN-S06 | HumanInk 22, 30; no-ai-slop phrases; stop-slop filler and absolutes |
| Hidden actors and narrator distance | EN-S28, EN-S30, EN-S31 | stop-slop passive, false agency and narrator rules; humanizer voice notes; Wikipedia attribution |

## HumanInk severity weights

Each HumanInk pattern carries a source-side editorial weight from 3 to 10. The entries quote the weight of each contributing pattern. Treat a weight as the source's opinion of how much the habit hurts prose. Adding weights together produces a number with no meaning; there is no probability here.

| ID | Weight | ID | Weight | ID | Weight | ID | Weight | ID | Weight |
|---|---:|---|---:|---|---:|---|---:|---|---:|
| 1 | 9 | 8 | 7 | 15 | 6 | 22 | 6 | 29 | 6 |
| 2 | 7 | 9 | 6 | 16 | 4 | 23 | 7 | 30 | 7 |
| 3 | 8 | 10 | 5 | 17 | 5 | 24 | 8 | 31 | 6 |
| 4 | 8 | 11 | 6 | 18 | 3 | 25 | 8 | 32 | 5 |
| 5 | 7 | 12 | 5 | 19 | 10 | 26 | 6 | 33 | 8 |
| 6 | 6 | 13 | 5 | 20 | 8 | 27 | 5 | 34 | 5 |
| 7 | 9 | 14 | 4 | 21 | 9 | 28 | 7 | 35 | 5 |

## Scope of the field guide

The Wikipedia field guide also covers encyclopedia-specific matters: categories, templates, policy compliance and deletion. This catalog takes the parts that transfer to reports and developer writing (source checks, leftover interface markup, edit narration, formatting residue, abrupt style shifts) and leaves the encyclopedia-only rules behind. The guide itself calls its indicators observations, lists ineffective indicators, and describes signs of human writing; read those sections as false-positive safeguards. An em dash, an old word, or a clean detector run proves nothing about authorship. The guide was read on 2026-09-25 and noted that some current-model details needed updating.

## Evidence labels

- **validated**: an exact communication artifact or a source-reported comparison supports a narrow action, such as removing a pasted greeting or checking a citation that does not resolve.
- **weak**: an editorial observation, a severity weight or a heuristic, without broad evidence that the form identifies generated text.
- **hold**: keep the form by default, or require more context before editing; it is a style choice, a convention or a known weak indicator.

Every entry gives the clue, the reason, a detection hint, two before-and-after pairs and the conditions under which to leave the text alone. Word lists are search aids for finding sentences to reread.

# Korean prose metrics

`scripts/ko-metrics.mjs` turns a few source-tested Korean patterns into repeatable counts. Use the numbers to decide where to look. They do not measure authorship or quality, and a number crossing a threshold is a reason to read a passage, nothing more.

## When to run it

- Before a Korean rewrite, to find the paragraphs with the densest pivots, clefts or connectives.
- After the rewrite, to confirm that the edit thinned the cluster it targeted and introduced no new one.
- Skip it for slides, legal text, notices, dialogue and procedures; those genres cluster these forms naturally and the counts mislead.

## Signals and advisory thresholds

| Signal | Catalog entry | What is counted | Look when | Notes |
|---|---|---|---|---|
| Conclusion-pivot clustering | D-1 | 결론적으로, 따라서, 이를 통해, 그러므로 | 4 or more in one document | The source treats more than three as a reason to inspect the conclusion sequence. Frequency trigger only. |
| Cleft clustering | D-8 | Common 필요/중요/핵심/문제/관건/답 cleft shapes ("중요한 것은 …") | 2 or more in a text of at least 40 whitespace-separated units | The 40-unit floor keeps tiny excerpts from flagging. The threshold is not a calibrated classifier. |
| Paragraph-initial connectives | H-1 | 또한, 따라서, 즉, 나아가, 아울러, 게다가, 더욱이, 그러므로, 반면, 그러나, 하지만 at sentence starts | 3 or more in one paragraph | Results in the source vary by model. Keep connectives that carry logic. |
| Connective-ending commas | C-11 | 고, 며, 지만, 면서, 아서, 어서 followed by a comma | At least 3 hits and a share of 0.5 or more | A surface approximation without a morphological parser; read the sentence before editing. |

The JSON output also reports sentence count, the share of sentences with a comma, mean sentence length and its variation (E-1, E-5), ending variety (E-2) and a count of balance phrases (G-3). These are descriptive and carry no threshold. Commas inside numbers (1,200) are excluded from the prose comma count.

## Method limits

The script strips Markdown headings, tables, blockquotes, inline code and fenced code before counting. Sentence boundaries and Korean units are approximated from punctuation and whitespace. A zero result says only that the listed forms are absent; the prose can still be stiff. A high result can belong to a perfectly good document in a regular genre.

Never combine the values into a score, rank writers or drafts by them, or rewrite until a number drops. Compare each signal with the document's genre, audience and purpose, and keep facts, scope, register and purposeful repetition.

## Running it

From the skill folder (the directory that holds the `SKILL.md` path the activation note gave you), through `run_command`:

```sh
node scripts/ko-metrics.mjs --json <draft-file>
node scripts/test-ko-metrics.mjs
```

The first prints the counts for one file as JSON. The second checks the script against the golden cases in `fixtures/ko-metrics-golden.json`: a positive and a clean comparison for each threshold family, testing counts and the minimum-length gate. Add a paired case there before changing any threshold. When `run_command` is refused (a headless run without permission), skip the metrics, read the paragraphs by hand with the table above, and say once in the reply that the counts were not run.

Save a draft you want to measure under `.litgravity/drafts/` in the workspace; keep the skill folder free of working files.

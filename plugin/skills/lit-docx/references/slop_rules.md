# Slop lint rules

`scripts/slop_lint.py` reads a Markdown source, splits it into sections and applies the prose rules
below; it also audits a finished `.docx` for design faults. `scripts/qa_docx.py` runs the same checks
inside the gate, so a finding here is a gate failure there. The phrase data sits in
`references/slop_phrase_list.yaml`; the thresholds sit in the script.

## How a run works

- Sections are cut at lines that start with `# `. A document written only with `##` headings is one
  section called "Preamble", and every section-level rule then measures the whole text at once.
- English rules always run. The Korean rules (21 to 25) run when the detected locale is `ko` or
  `mixed`, which means more than 1 percent Hangul in the body.
- Output is deterministic: a stdout summary (`rule-id L<line>:C<column> [section] message`), a Markdown
  report written to `--report`, and exit code 0 (clean), 1 (findings) or 2 (bad input). The source is
  left untouched; `--fix-whitespace` writes a separate `<source>.fixed.md` that applies span-safe
  typography fixes (dashes, quotes, unit spacing, ellipsis, double spaces) and nothing else.
- `--kind report` drops the manuscript-only rules 07, 08 and 09. Under `qa_docx.py` a tonality or plain
  document drops rule 08 as well; only a named `--publisher` brings the section order back.
- `qa_docx.py` fails on any remaining prose finding. There is no suppression syntax: rewrite the
  sentence, or move the quoted phrase out of the running text.

## Prose rules

| Rule | Fires when | Typical rewrite |
|---|---|---|
| `rule-01-ai-phrase` | a phrase of `en.ai_tell_phrases` appears (case-insensitive): delve, furthermore, moreover, in recent years, a myriad of, leverage, robust, comprehensive | name the actual claim; use "use" for leverage, "and" or a new sentence for furthermore |
| `rule-21-ko-ai-phrase` | a phrase of `ko.ai_tell_phrases` appears: 최근 들어, 매우 중요한, 지대한 관심을 받고 있다 | state the year, the number or the reason |
| `rule-02-em-dash-cluster` | two or more em dashes in one section's prose lines, or a spaced hyphen between words (`A - B`); table rows are skipped | commas, colons or two sentences |
| `rule-03-hedging-pileup` | one sentence holds two entries of `en.hedging_words` (four modal and adverb qualifiers) | keep the one qualifier that changes the claim |
| `rule-04-stock-boundary` | a section opens with a stock opener or closes with a stock closer (in recent years, in this study; in conclusion, overall) | open on the finding, close on the next action |
| `rule-25-ko-stock-boundary` | a section starts with 본 연구에서는, 본 논문에서는, 최근 들어, or ends with 결론적으로, 요약하면 | the same, in Korean |
| `rule-22-ko-eomi-repeat` | three or more of 하였다, 되었다, 할 수 있다, 라고 볼 수 있다, 로 판단된다, 임을 확인하였다 in a section | vary the endings; state the result as a plain fact |
| `rule-23-ko-translationese` | 에 있어서, 라고 사료된다, 살펴보면 | 에서, 로 보인다, a direct verb |
| `rule-24-ko-loanword` | 리서치, 리뷰, 메리트, 컨센서스 | 조사, 검토, 장점, 합의 |
| `rule-05-sentence-variance` | a section with 4+ sentences and 80+ words whose sentence lengths have a standard deviation under 6 words; reference lists are skipped | merge two short sentences, split one long one |
| `rule-06-passive-ratio` | a section named Methods or Results where more than 40 percent of sentences are passive | name the agent |
| `rule-07-citation-density` | Introduction or Discussion over 40 words with no citation `[n]`, `(Name et al., 2020)` or `[@key]` | cite, or merge the section into a neighbour |
| `rule-08-structure-order` | headings arrive out of the publisher's section order | reorder, or choose the profile that matches |
| `rule-09-section-balance` | 250+ words in total and Introduction over 20 percent, or Methods under 15 percent | cut the Introduction, expand the Methods |
| `rule-10-lexical-diversity` | a subsection of 40+ words with a type-token ratio under 0.45 | cut repetition; vary nouns |
| `rule-11-heading-case` | an English heading breaks the profile's case (title case: each of the first six words is capitalised, small articles, conjunctions and prepositions after the first excepted; sentence case: a capital first letter and a mixed-case remainder) | recase; Hangul headings pass |
| `rule-12-adjective-stack` | a phrase of `en.adjective_stacks` | one specific adjective, or a number |
| `rule-13-redundant-qualifier` | three or more of very, extremely, highly, remarkably, incredibly in a section | delete them |

## Design audit rules (on the finished `.docx`)

| Rule | Fires when | Severity |
|---|---|---|
| `rule-30-cjk-font-fallback` | a Hangul run has no `eastAsia` font, or one of Batang, Gulim, MS Mincho | fail |
| `rule-32-banned-font` | a banned font of the profile remains in `styles.xml` | fail |
| `rule-34-default-margin` | the top margin differs from the profile by more than about 1 mm | fail |
| `rule-35-booktabs-table` | a table exists and the `insideV` nil marker is missing | fail |
| `rule-45-highlighted-text` | a highlight element is in the body | fail |
| `rule-46-tracked-changes` | insertions, deletions or comment ranges remain | fail |
| `rule-55-ellipsis` | an ASCII `...` is anywhere in `document.xml` | fail |
| `rule-60-numeric-column-alignment` | a column whose cells are 70 percent or more numeric (two rows at least) holds a cell not right-aligned (OF-302) | fail when set explicitly, advisory when inherited |
| `rule-61-text-measure` | more than 38 Korean or 90 Latin characters fit on a line at the body size (OF-301) | advisory |

A `qa_docx.py` run without `--publisher` (a tonality or plain document) keeps the shared rules 45, 46, 55
and 60. Rules 30, 32, 34 and 35 apply to runs that name a profile.

## The phrase list

`references/slop_phrase_list.yaml` has two top-level keys, `en` and `ko`. Each holds lists the rules
read by name: `ai_tell_phrases`, `stock_openers`, `stock_closers` in both languages; `adjective_stacks`,
`redundant_qualifiers`, `hedging_words` in `en`; `translationese`, `overused_loanwords`,
`eomi_repetition` in `ko`. Matching is by substring (case-insensitive in English), so add the shortest
phrase that is wrong in every context. A new entry applies to every document at once; try it on two
known-good sources before keeping it.

## Handling findings

- A finding is a pointer to a sentence, with a line and column in the report. Fix the sentence, then
  rerun; the same run in `qa_docx.py` shows the gate result.
- A quoted source that contains a flagged phrase stays out of the running text: paraphrase it or move
  it to a table or a figure caption.
- The structural rules (07 to 09) describe journal manuscripts. A business report, proposal or memo
  runs under `--kind report` and meets none of them.
- A clean lint reports the absence of these patterns and nothing more about the writing; read the
  pages and the draft once more for voice.

```sh
SKILL_ROOT="<directory of this SKILL.md>"
python3 "$SKILL_ROOT/scripts/slop_lint.py" draft.md --publisher korean-generic --kind report --report lint.md
python3 "$SKILL_ROOT/scripts/slop_lint.py" draft.md --publisher korean-generic --kind report --report lint.md --fix-whitespace
python3 "$SKILL_ROOT/scripts/slop_lint.py" --publisher elsevier --audit-output paper.docx --report audit.md
```

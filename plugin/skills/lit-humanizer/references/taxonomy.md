# Pattern taxonomy

This page sorts every tell the skill knows into eight families and says, for each one, whether the detector blocks it, warns on it, or leaves it to the editor's judgment. Read it before a rewrite to decide how hard to push, and read it again when a detector hit looks wrong.

Three ideas run through the whole page.

1. A pattern is an editing cue. It says a sentence may be doing less than it could. It says nothing about who or what wrote the sentence, and it never becomes a score for the writer.
2. The channel decides the edit. A compact status key belongs in a ledger line under `.litgravity/ledger/` and reads as clutter in a report for a manager. The same words can be right in one place and residue in the other. `references/deliverable-channels.md` says where each fact goes.
3. Block and warn are different jobs. A block is high-confidence residue in a reader-facing artifact: fix it before delivery. A warning asks for a second look in context; keeping the sentence after that look is a valid outcome.

The machine rules live in `rules.json` beside `SKILL.md`; `scripts/detect.mjs` applies them line by line or sentence by sentence. Manual cues (the `manual-*` names below) have no detector rule and depend on reading. The Korean catalog (`references/ko-patterns.md`) and the English catalog (`references/en-patterns.md`) hold the full entries with examples; this page is the map between them.

## Severity tiers at a glance

| Tier | Meaning | What the editor does |
|---|---|---|
| block | Drafting residue with almost no legitimate use in a finished artifact (chat greetings, pasted model disclaimers, bracket status keys, attribution trailers). | Rewrite or remove before the artifact leaves. Re-run the detector on the changed text. |
| warn | A shape that is often filler and sometimes exactly right (a hedge, a passive, a list of three, a contrast). | Read the sentence in context. Edit when the shape hides a fact or delays the point; otherwise keep it and move on. |
| manual | A pattern that needs reading across sentences or paragraphs (a staged kicker, a one-use abstraction, a negative list). | Check during the read-aloud pass. Never force an edit to clear it. |

The detector skips fenced code, Markdown blockquote lines that carry user quotations, and (for the label rules) recognizable table and figure captions. Those exemptions come from `context_policy` in `rules.json`.

## 1. Deliverable labels, source footers and limitation clutter

This family covers text that belongs to the working record and leaked into the artifact: bold labels that announce evidence, bare source footers, chained caveats, internal keys, and status tags. The test is the reader. Someone who asked for a report needs the finding and, once, the limit that changes how to read it. They do not need the scaffolding that produced it.

### Rules in this family

- `ko-bold-deliverable-label`, `en-bold-deliverable-label` (block). A bold label such as `**근거:**`, `**한계:**`, `**Evidence basis:**` or `**Confidence:**` opens a line and turns the paragraph into a mini-ledger. Write the claim as a sentence and attach its source the way the document already cites sources.
- `ko-plain-meta-label`, `en-plain-meta-label` (block in prose). A bare `Source:` / `출처:` line standing alone in body text. The one exemption: a plain, non-bold attribution directly under a Markdown table, a Markdown image, an HTML figure or a figure caption, with at most one blank line between them. If that line also carries a caveat ("forecast, not realized"), it is read as prose again, so the caveat stays visible and gets its own sentence.
- `ko-plain-meta-label-warn`, `en-plain-caveat-label` (warn). Headings such as `한계`, `Limitations`, `Caveats`. Technical manuals and review packets use them on purpose. In a short deliverable, check whether the caveat reads better beside the claim it limits.
- `ko-stacked-limitation-chain`, `en-stacked-limitation-chain` (block). Three or four disclaimers joined by mid-dots, semicolons or slashes. Keep each boundary that matters and give it a sentence where it applies.
- `workflow-jargon`, `ko-workflow-jargon` (block). Internal stage names, evidence-bundle labels, claim keys like `[C003]`, lane names and receipt vocabulary. They stay in the ledger. A public citation the reader needs stays a citation.
- `en-demo-self-disclaimer` (block). A synthesis, recommendation or architecture labelled as a demo of itself. Say what is proposed, what is assumed and what was measured.
- `ko-bracket-status-tag`, `en-bracket-status-tag` (block). `[미검증]`, `[확인 필요]`, `[unverified]`, `[evidence-based]`. Replace the key with a sentence naming the condition and its scope.
- `ko-standalone-scope-disclaimer`, `en-standalone-scope-disclaimer` (block). Stock tags such as `허가 판단 아님` or "no sources were available" with no context. A user-requested legal, medical or safety notice is kept and placed once where it applies.
- `ko-negative-pledge`, `ko-negative-pledge-repeat`, `en-negative-pledge` (block). A sentence that promises what the document, table or number is not for: `이 표는 순위가 아닙니다`, `외부 공개용 수치가 아님`, "This is not intended as a head-to-head benchmark". It is a promise about the document, and the reader learns nothing about the data. The single-line Korean rule reads a short list of shapes (a self-referring topic such as 이/본/해당 plus a document noun with a negated claim verb; a comparison or ranking noun with a negated reading verb; a purpose-용 data noun with 아님; a row order said not to be a ranking). The repeat rule reads the whole text and fires when two such sentences end in 해석하지/주장하지/대표하지 않음 or a claim noun plus 아님. The English rule needs a comparison, benchmark or ranking noun, or "makes no claim". Rewrite the pledge as one fact beside the number it affects (`표본은 한 공정 조건만 포함한다`), or move it to the chat reply. Operating rules (`방폭 구역에서는 사용하지 않습니다`), negative findings (`첨가제 B는 수율을 높이지 않았다`), method facts (`단위가 다른 값은 SI로 환산한 뒤 비교한다`) and legal or safety notices stay as written. A quote line that opens with a bold label (`> **참고:** …`) is read like a normal line; a plain quote line stays unread.
- `ko-status-negation`, `ko-mi-status`, `en-epistemic-negation`, `en-not-performed` (warn). `검증하지 않았습니다`, `미실행`, "was not independently verified", "not performed". The negative may be the finding. Name the actor, the action and the scope plainly. Unknown never becomes false, and an estimate never becomes a measurement.
- `en-knowledge-cutoff`, `en-ai-self-disclaimer` (block). Model-status wrappers ("as of my last update", "as a language model") pasted into authored content.
- `en-hope-helps`, `ko-chatbot-signoff` (block). Service sign-offs: "I hope this helps", `도움이 되셨기를 바랍니다`.
- `ko-chatbot-opener`, `en-chatbot-opener` (block). `물론입니다!`, `좋은 질문입니다`, "Certainly!", "Great question" at the start of a deliverable.
- `en-chatbot-closer` (block) and `en-closer-offer` (warn). The fixed offers to produce another version block. The broad "anything else?" question only warns, because ordinary task questions in human manuals use the same words.
- `en-lets-dive` (block). The fixed openers "let's dive in" and "without further ado". Looser invitations are left to judgment.
- `en-testament` (block). "is a testament to" and its relatives: praise with no fact attached.
- `en-left-in-narration` (block). First-person editing narration left in the artifact: "I've updated the section below", "Here is the revised version".
- `code-ai-attribution` (block). Generated-by trailers and co-author lines naming a model in commits and pull requests, under the family rule.

### Real-line rewrite ledger

The 26 positive lines in `fixtures/pos-real.txt` are the anchor for this family. Each row below names the shape and gives a reader-facing rewrite that keeps the named source, the value, the scope, the status and the uncertainty. Proper names are replaced with neutral ones here; the point is the shape.

1. **Forecast hidden in a source footer.** Rewrite: "The operator's 2024 sustainability report lists a 30% productivity gain and a 30% shorter lead time as expected outcomes once its plant programme is complete; neither has been realized."
2. **Pilot recommendations in a source footer.** Rewrite: "The control points are recommendations for the pilot, drawn from the operator's digital-twin and work-order descriptions."
3. **Architecture synthesis in a source footer.** Rewrite: "The architecture combines the vendor's published digital-twin materials into a design proposed for the pilot."
4. **Assumptions in a source footer.** Rewrite: "The leading indicators and baselines are assumptions for the pilot, derived from the programme's expected outcomes."
5. **Claim and source keys inside a fact line.** Rewrite: "The operator expects a 30% productivity gain and a 30% shorter lead time after the programme is complete; these are expectations." The key-to-source map moves to a footnote or the ledger.
6. **HTML evidence-boundary panel.** Rewrite: "This summary describes the vendor's public product pages. Deployment at any particular site is outside what those pages show."
7. **Table caption carrying a ledger name.** Rewrite: "Table 2 groups the evidence by question. It draws on final report v3 and the publisher's source record." A plain attribution line under the table may stay.
8. **Short global data offered as persistence evidence.** Rewrite: "The 100 ps global run is too short to show persistence over a 20–50 ps window."
9. **Upper bound read as absence.** Rewrite: "This upper bound leaves both transition and independent nucleation open; the direction stays undecided."
10. **Figure caption with a receipt term.** Rewrite: "Figure 6. Structure aligned to a single 2.885 µs frame. Source: the checked local frame and its image record."
11. **Unrun work as a table row.** Rewrite: "Remote checks and new simulations wait for explicit approval; neither has run." The full execution record stays in the ledger.
12. **Non-observation versus absence.** Rewrite: "The event did not appear in the data. That leaves open whether the physical process occurred."
13. **Stable sensitivity set, unstarted run.** Rewrite: "All nine sensitivity combinations were stable. The PMF run has not started."
14. **Unvalidated model.** Rewrite: "The force field has no published validation for epoxides; the report quantifies this limit in section 4."
15. **Fitting parameter.** Rewrite: "The model reproduces the experimental dissociation temperature without a fitted parameter."
16. **Indirect value.** Rewrite: "This value comes from the pure systems; the mixed system was measured indirectly."
17. **Classification versus size.** Rewrite: "The test validates the present/absent call. Size estimates need a separate check."
18. **Research and investment disclaimer chain.** Rewrite: "연구용 자료입니다. 투자 조언이 아니며, 실제 체결 여부와 수익성은 확인하지 않았습니다. 미래 성과와 주문 체결은 보장하지 않습니다." Each legal boundary and each uncertainty stays.
19. **Missing forecast.** Rewrite: "이 자료에는 해당 펀드의 가격 전망이 없습니다."
20. **Source packet with a no-refetch caveat.** Rewrite: "The facts come from a packet retrieved on 2026-07-13. The pages were read once and not fetched again."
21. **Confidence label plus scope.** Rewrite: "The claims match the supplied fact packet. Nobody has checked them against the original pages."
22. **Normalized metric versus traded value.** Rewrite: "The figure is the change in normalized holdings multiplied by the latest close. It estimates exposure; traded value was never observed."
23. **Host, run and mechanism boundary.** Rewrite: "The archive has not been checked on the GPU host, the production run has not started, and the mechanism is still open."
24. **Image-sheet measurement.** Rewrite: "높이는 130 mm로 사진 시트에 적혀 있습니다. 실측값은 아니며 아직 확정되지 않았습니다."
25. **Validation checklist phrased as a label.** Rewrite: "관련 검사와 실제 사용 경로를 확인하고, 근거와 가정을 나눠 적습니다."
26. **Selection status with unverified depth and permit.** Rewrite: "선별은 끝났지만 수심과 기준면은 아직 검증하지 않았습니다. 허가 여부는 관할 기관이 판단합니다."

### Further shapes from the research synthesis

- **Bracket status keys.** `[미검증]` becomes `표 3의 추정치는 아직 확인하지 않았다.`; `[unverified]` becomes "The table 3 estimate has not been checked yet."
- **Evidence-status tags.** `[증거 기반]` becomes the named source or measurement beside the claim.
- **Mid-dot caveat chains.** `미검증 · 허가 판단 아님 · 투자 조언 아님` becomes `허가 여부는 관할 기관이 판단합니다. 이 분석은 투자 조언이 아닙니다.` A condition that is true and material keeps its own sentence.
- **Standalone scope tags.** Use a factual sentence only when the supporting fact is known. When authority is missing, name who decides; when evidence is missing, name the gap.
- **Status negatives.** `미실행` becomes `원격 검증은 실행하지 않았습니다.` The sentence names the action and keeps the negative.
- **Source footers carrying caveats.** Attach the source to the claim through a note, a reference list or one plain caption line. The caveat gets a sentence of its own because it changes the reading.
- **Demonstration labels.** Replace "demo synthesis" with the demonstrator's real scope, and say which parts are proposed, simulated or assumed.
- **"Evidence boundary" panels.** State the boundary once, as a sentence beside the conclusion it limits. Keep a formal section when the review format requires one.
- **Empty "limitations" or "challenges" slots.** Name the open item, its owner, the missing test or the date when the draft supplies them. When the draft supplies nothing, cut the slot; inventing a risk to fill it is a fidelity defect.

### Caption exemption contract

A plain attribution line may stay when it directly follows a Markdown table, a Markdown image, an HTML `figure` or `figcaption`, or a table or figure caption, with zero or one blank line between them. A Korean `출처:` line follows the same rule. Nothing else inherits the exemption: a source line two blank lines away, or one standing in the middle of prose, is read as prose. A caveat on the attribution line ("projected figures, not results") keeps the line visible to the detector so the caveat reaches the reader as a sentence. `fixtures/rule-cases.json` covers each attachment shape, one blank line, two blank lines, an embedded caveat and a label alone in prose.

## 2. Structure and contrast

- `en-not-x-but-y` (warn, document scope). Warns when the contrast opens a sentence, or when two such contrasts appear in one document. A single natural contrast in the middle of a sentence stays clean. Rewrite to the positive claim when the negative half corrects a belief nobody holds.
- `ko-negation-contrast` (warn). Repeated `A가 아니라 B` framing. Keep a contrast that carries two distinct facts.
- `en-forced-triad`, `ko-forced-triad` (warn). A list of three built for cadence. Remove a padded member; a real three-part list stays.
- `en-colon-reveal` (warn). "Here's the thing:" and other dramatic takeaway labels. State the point.
- `manual-en-cleft` (manual). "What matters is …", "The key is …". Compare with the Korean cleft entry D-8.
- `manual-negative-list` (manual). A run of "no X, no Y, no Z" sentences that defines a thing by what it lacks.

Catalog entries: Korean C-1, C-7, C-8, D-8; English EN-S01 to EN-S06.

## 3. Openers and endings

- `en-throat-clearing`, `en-conclusion-opener` (warn). "It is worth noting that", "In conclusion". Remove the announcement when the next words carry the point.
- `ko-chatbot-invitation` (warn). `궁금한 점이 있으면 언제든지 말씀해 주세요` in a report. Fine in chat, out of place in a standalone document.
- `manual-fake-profound-kicker` (manual). A final one-line paragraph that turns a finding into a slogan. End on the finding, the decision or the next action the draft already contains.

Catalog entries: Korean D-1, D-6, D-9, D-11, D-13; English EN-C10, EN-C11, EN-S08, EN-S27, EN-S31.

## 4. Attribution

- `en-weasel-attribution`, `ko-weasel-attribution` (warn). "Experts say", `전문가들은 … 지적한다`. Name the source when the draft has it. When it does not, say the statement is the writer's estimate. A made-up source is worse than the vague one.

Catalog entries: Korean I-7; English EN-C05, EN-S21, EN-S22.

## 5. Hedge calibration

- `en-stacked-hedges`, `ko-stacked-hedges` (warn). Two or more qualifiers on one claim ("might possibly suggest", `~할 수도 있을 것으로 보인다`). Keep the qualifier that sets the strength of the claim and drop its duplicates. Legal, medical, scientific, contractual and forecast language keeps its calibrated hedges.

The write guard in the hooks reports stacked hedges (two in a sentence, four in a paragraph) in Markdown that other routes write. The humanizer route is exempt so that a user's own hedged wording survives an edit, which makes the calibration here the editor's responsibility.

Catalog entries: Korean G-1, G-2, G-3; English EN-C14, EN-C15.

## 6. Vocabulary

- `en-lexical-tell` (warn). Words such as delve, tapestry, pivotal, seamless, robust, leverage. The list prompts a meaning check. A word that says exactly what the writer means stays.
- `ko-calque` (warn). Translated stock phrases: `~에 있어서`, `~를 통해`, `~라고 할 수 있다` in clusters.
- `ko-double-passive` (warn). `되어진다`, `보여진다`. Use the direct form; name the actor only when the draft names it.
- `ko-light-verb` (warn). `개선을 진행하다`, `검토를 실시하다`. A direct verb (`개선하다`, `검토하다`) is often shorter and clearer; the light-verb form is kept where the register needs it.

Catalog entries: Korean A-1 to A-24, B-1 to B-4, D-2, D-4, F-1 to F-7, I-1 to I-6; English EN-C01, EN-C04, EN-C07 to EN-C09, EN-C13, EN-C16, EN-C19, EN-C20.

## 7. Rhythm and formatting

- `en-em-dash-cluster` (warn). Several em dashes in one line. Genre and the writer's habit decide.
- `ko-decorative-bold` (warn). Bold on many ordinary phrases in one line.
- Sentence length, paragraph length, list density, heading case and punctuation stay manual. `scripts/ko-metrics.mjs` reports a few Korean counts as reading aids (see `references/ko-metrics.md`).

Catalog entries: Korean C-2 to C-6, C-9 to C-12, E-1 to E-7, H-1 to H-4, J-1 to J-4; English EN-S07, EN-S09 to EN-S19, EN-S29.

## 8. Code and developer writing

- `code-narrating-comment` (warn). A comment that restates the next line. A useful comment states a reason, a constraint or a hazard.
- `code-defensive-guard` (warn). A branch that may repeat a guarantee the type or caller already gives. Remove it only after confirming the boundary is internal and the guarantee holds.
- `code-ai-attribution` (block). Model attribution trailers in commits and pull requests.
- `manual-one-use-abstraction` (manual). A wrapper called once. Inline it when it adds no name, contract, test seam or planned reuse.

Catalog entries: CODE-01 to CODE-12 in `references/code-patterns.md`.

## Detector rule to catalog crosswalk

| Rule id | Tier | Catalog entries |
|---|---|---|
| `ko-bold-deliverable-label`, `en-bold-deliverable-label` | block | C-6, J-1, EN-S10 |
| `ko-plain-meta-label`, `en-plain-meta-label` | block | EN-S20, EN-S25 |
| `ko-plain-meta-label-warn`, `en-plain-caveat-label` | warn | C-3, EN-C06 |
| `ko-stacked-limitation-chain`, `en-stacked-limitation-chain` | block | G-2, EN-C14 |
| `workflow-jargon`, `ko-workflow-jargon` | block | EN-S23, EN-S25 |
| `en-demo-self-disclaimer` | block | EN-S23 |
| `ko-bracket-status-tag`, `en-bracket-status-tag` | block | EN-S20, EN-S22 |
| `ko-standalone-scope-disclaimer`, `en-standalone-scope-disclaimer` | block | EN-C15 |
| `ko-negative-pledge`, `ko-negative-pledge-repeat`, `en-negative-pledge` | block | A-24, EN-S05 |
| `ko-status-negation`, `ko-mi-status`, `en-epistemic-negation`, `en-not-performed` | warn | G-1, EN-C15 |
| `en-knowledge-cutoff`, `en-ai-self-disclaimer` | block | EN-C15, EN-S26 |
| `en-hope-helps`, `ko-chatbot-signoff`, `en-chatbot-closer` | block | EN-S26 |
| `en-closer-offer`, `ko-chatbot-invitation` | warn | EN-S26 |
| `ko-chatbot-opener`, `en-chatbot-opener`, `en-lets-dive` | block | EN-C10, EN-S26 |
| `en-testament` | block | EN-C01, EN-C04 |
| `en-left-in-narration` | block | EN-S23 |
| `en-not-x-but-y`, `ko-negation-contrast` | warn | A-21, EN-S01 |
| `en-forced-triad`, `ko-forced-triad` | warn | C-1, EN-S02 |
| `en-colon-reveal` | warn | C-10, EN-S06 |
| `en-throat-clearing`, `en-conclusion-opener` | warn | D-1, EN-C10, EN-C11 |
| `en-lexical-tell` | warn | D-4, EN-C07, EN-C13 |
| `ko-calque` | warn | A-1 to A-6, B-4 |
| `ko-double-passive` | warn | A-8, A-9, A-12 |
| `ko-light-verb` | warn | A-7, F-4, F-7 |
| `en-weasel-attribution`, `ko-weasel-attribution` | warn | I-7, EN-C05 |
| `en-stacked-hedges`, `ko-stacked-hedges` | warn | G-2, EN-C14 |
| `en-em-dash-cluster` | warn | J-3, EN-S17 |
| `ko-decorative-bold` | warn | J-1, EN-S15 |
| `code-narrating-comment` | warn | CODE-01, CODE-02 |
| `code-defensive-guard` | warn | CODE-03, CODE-12 |
| `code-ai-attribution` | block | CODE-08, CODE-09 |

A catalog entry with no rule in this table is manual: it depends on reading, and a clean detector run says nothing about it.

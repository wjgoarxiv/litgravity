# Korean style patterns: first read

Notes for spotting Korean prose that reads as assembled. A pattern is a question to ask of a sentence; mark it only when it weakens clarity, texture or trust. In the Korean deep sequence this file is the first thing the `korean-style-analyzer` agent reads; the full catalog is `references/ko-patterns.md` with its A-D and E-J shards, and the optional counts are in `references/ko-metrics.md`.

## First reading

Read once for intent before touching style.

- Identify the audience, the situation and the expected register.
- Mark claims with factual weight: dates, quantities, causes, comparisons, names, cited material.
- Separate meaning problems from sound problems. A meaning problem needs a question or a conservative rewrite; a sound problem can usually be polished directly.
- Plain sentences that fit the context survive.

## Surface patterns that matter when they repeat

| Pattern | What it looks like | Catalog |
|---|---|---|
| Long setup | The sentence announces that a point matters before saying it | D-8, H-3 |
| Symmetric enumeration | Every paragraph walks first, second, third whatever each idea weighs | C-1, C-7 |
| Abstract noun stacking | Action hides behind `가능성`, `측면`, `부분`, `과정`, `방향` | I-2, F-4 |
| Softened conclusions | Every claim ends in `볼 수 있습니다` or `의미가 있습니다` | G-1, I-1 |
| Stamped endings | Grammatical but identical closings, sentence after sentence | E-2 |
| Translation order | Modifiers pile up before the noun; cause and result in an unexpected order | A-18, A-19 |
| Empty bridging | `또한`, `따라서`, `이러한` with no logical step behind them | H-1, H-3, D-1 |
| Inflated scope | One narrow observation becomes `모든`, `항상`, `전반적으로`, `근본적으로` | D-2, F-1 |
| Generic benefit language | 효과적, 효율적, 혁신적, 의미 있는, 가치 있는 with no visible effect | D-4, F-5, F-7 |
| False neutrality | Promotional or emotional content dressed in bland analysis | G-3 |
| Chat residue | `물론입니다!`, `도움이 되셨기를 바랍니다` around the content | blocks in `rules.json` |

## Korean texture checks

- **Topic flow.** The topic must stay recoverable. When every sentence restarts with a broad noun phrase, merge sentences or use a lighter subject.
- **Verb energy.** Prefer verbs that show the action. `검토가 이루어졌다` becomes an actor and an action when the actor is known.
- **Ending variety.** Vary endings where the writing explains, and choose each ending to match how the sentences relate. Variety for decoration is its own defect.
- **Particle fit.** Odd particles expose translation residue. Check `은/는`, `이/가`, `을/를`, `에/에서`, `으로` against the relation they express.
- **Honorific consistency.** Hold the requested politeness level from the first sentence to the last (E-7).
- **Term density.** Technical terms are fine when they work. Thin a repeated label with omission or a short reference when that reads better and stays clear.
- **Spacing and spelling.** 띄어쓰기 errors (`할수있다`, `것 이다`) and unit spacing inconsistencies read as careless; fix them in every pass.

## Signals to leave the text alone

- The sentences already sound like a person writing in the requested setting.
- The repetition is deliberate: legal, safety, teaching or ritual emphasis.
- Polishing would bend a quotation, a citation title, a product name, a policy phrase or wording the user specified.
- The only complaint is taste, with readability, accuracy and tone fit all fine.
- The passage is short and clear, and a rewrite would replace the writer's voice with the editor's.

## Annotation labels

When annotating a draft, use these plain labels so the editor and the auditor read the same map:

- `meaning-risk`: a possible change to facts, claims, scope or attribution;
- `sound-risk`: unnatural rhythm, a repeated ending, an empty connector or translation order;
- `tone-risk`: register, politeness, emphasis or emotional temperature that misses the request;
- `no-op`: natural enough; say why and leave it.

Each label carries the sentence location and, where it applies, the catalog ID (for example `sound-risk A-2, paragraph 3`).

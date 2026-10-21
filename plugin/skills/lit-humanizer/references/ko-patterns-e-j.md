# Korean pattern catalog: E to J

Groups E to J of the 85-entry Korean catalog: rhythm and sentence shape (E), repetition and modifiers (F), hedging and balance (G), connectives and topic reference (H), noun-heavy forms (I), and visual punctuation (J). Groups A to D are in `references/ko-patterns-a-d.md`; the index and the evidence labels are in `references/ko-patterns.md`.

The same reading rules apply as in A to D. An entry is a reason to reread, never a judgment about the author. Validated entries sometimes support keeping a form, because people use it too. Rhythm entries in particular depend on genre: a slide, a legal notice, a procedure or a dialogue can be regular on purpose, and evening out its rhythm can damage it.

Group F has no F-6. The source taxonomy retired that ID, and this catalog keeps the numbering so cross-references stay stable.

## E. Rhythm and sentence shape

### E-1 | Low variation in sentence length
- What: Sentences cluster around one length, often with no long sentence at all.
- Why: An even beat makes every idea sound equally weighted and tires the ear.
- Detect: `scripts/ko-metrics.mjs` reports the mean sentence length and its variation. Read the paragraph aloud before acting.
- Before → after:
> Before: 회의는 오전에 열렸다. 안건은 세 건이었다. 모두 승인되었다. 다음 회의는 다음 달이다.
> After: 오전 회의에서 안건 세 건이 모두 승인되었다. 다음 회의는 다음 달에 열린다.
> Before: 점검을 시작했다. 결함은 두 건이었다. 하나는 수리했다. 하나는 남았다.
> After: 점검에서 결함 두 건이 나왔다. 한 건은 바로 고쳤고, 나머지 한 건은 부품이 와야 고칠 수 있다.
- Leave it: Procedures, checklists and slide text whose evenness is the format.
- Evidence: weak. The source describes the rhythm cue without a threshold for this item.

### E-2 | The same sentence ending repeated
- What: Sentence after sentence ends with the same predicate form (`~했다`, `~입니다`, `~할 수 있다`).
- Why: The repetition stamps the paragraph and hides how sentences relate.
- Detect: Ending variety in `scripts/ko-metrics.mjs`; then read for the relation between sentences.
- Before → after:
> Before: 신청 기간은 3월입니다. 신청은 온라인으로 합니다. 결과는 4월에 발표합니다. 문의는 메일로 합니다.
> After: 신청은 3월 한 달 동안 온라인으로 받습니다. 결과는 4월에 발표하고, 문의는 메일로 받습니다.
> Before: 이 도구는 빠르다고 할 수 있다. 정확하다고 할 수 있다. 쓰기 쉽다고 할 수 있다.
> After: 이 도구는 빠르고 정확하며 쓰기 쉽다.
- Leave it: A consistent ending is correct Korean. Vary endings only where the sentences explain or connect; variety for decoration is its own defect.
- Evidence: weak. An editing metric, not a validated predictor.

### E-3 | Every paragraph has the same sentence count
- What: Paragraph after paragraph contains, say, exactly three sentences.
- Why: The template shows through; a big idea and a small idea get the same space.
- Detect: Heuristic. Count sentences per paragraph across a section.
- Before → after:
> Before: (모든 문단이 '배경 한 문장, 사실 한 문장, 의미 한 문장'으로 구성됨)
> After: 사실이 많은 문단은 길게, 단순한 결정은 한 문장으로 쓴다.
> Before: 세 문단이 모두 "~이다. ~이다. 이는 ~을 의미한다."로 끝남
> After: 의미를 따로 해설할 필요가 없는 문단에서는 마지막 문장을 지운다.
- Leave it: Templates readers expect (meeting minutes, case summaries).
- Evidence: weak.

### E-4 | All-short sentence rhythm
- What: Nearly every sentence is short and simple.
- Why: The text reads as clipped notes, and logical links vanish between sentences.
- Detect: Heuristic. Low mean length plus low variation.
- Before → after:
> Before: 비가 왔다. 길이 막혔다. 버스가 늦었다. 회의가 밀렸다.
> After: 비 때문에 길이 막혀 버스가 늦었고, 회의도 그만큼 밀렸다.
> Before: 서버가 멈췄다. 재시작했다. 복구됐다.
> After: 서버가 멈춰 재시작했고, 곧 복구됐다.
- Leave it: Alerts, slide bullets and deliberate dramatic pacing in an essay.
- Evidence: weak. A qualitative observation; it is the opposite failure of E-5.

### E-5 | Long comma-chained clauses
- What: One sentence strings several long clauses together with commas.
- Why: The reader loses which clause carries the main claim.
- Detect: Comma count per sentence and the connective-comma share from `scripts/ko-metrics.mjs`.
- Before → after:
> Before: 조사는 5월에 시작되었고, 응답자는 300명이었으며, 응답률은 60%였고, 결과는 6월에 정리되었다.
> After: 5월에 시작한 조사에 300명이 응답했다(응답률 60%). 결과는 6월에 정리했다.
> Before: 장비가 도착했고, 설치를 마쳤으며, 시험 운전을 했고, 이상이 없었다.
> After: 장비를 설치하고 시험 운전을 했는데 이상이 없었다.
- Leave it: A formal sentence whose clauses must stay bound together.
- Evidence: validated. The source reports a 1.97× difference in one essay corpus and notes it pulls opposite to E-4.

### E-6 | Commas after many different units
- What: Commas appear after a wide variety of grammatical units in one text.
- Why: The punctuation follows English habits instead of Korean phrasing.
- Detect: Metric candidate. Count the distinct comma positions; inspect the outliers.
- Before → after:
> Before: 그러나, 이번 결과는, 지난해와, 비교하면, 낮다.
> After: 그러나 이번 결과는 지난해보다 낮다.
> Before: 다행히, 오후에는, 비가, 그쳤다.
> After: 다행히 오후에는 비가 그쳤다.
- Leave it: Commas that separate list items or prevent a misreading.
- Evidence: validated. The reported 2.44× separation is tied to its genre.

### E-7 | Register shift in addressee endings
- What: A document slides between `~습니다`, `~해요` and `~다` without reason.
- Why: The reader cannot tell who is speaking to whom.
- Detect: Heuristic. Tally ending levels per section.
- Before → after:
> Before: 신청은 3월에 마감합니다. 서류는 꼭 챙기세요. 늦으면 접수가 안 된다.
> After: 신청은 3월에 마감합니다. 서류를 꼭 챙기세요. 마감 뒤에는 접수할 수 없습니다.
> Before: 이번 분기 매출은 증가했다. 다음 분기도 기대됩니다.
> After: 이번 분기 매출은 늘었다. 다음 분기 전망은 5월 회의에서 다룬다.
- Leave it: Quoted speech, dialogue, and a deliberate switch the writer chose.
- Evidence: weak. The source labels this an estimate and did not quantify it.

## F. Repetition and modifiers

### F-1 | Empty degree adverbs (`매우`, `굉장히`, `상당히`, `정말`)
- What: Intensifiers that leave the measurable claim unchanged.
- Why: Every claim sounds equally emphatic, so emphasis stops working.
- Detect: Lexical scan; ask what number or comparison the adverb stands for.
- Before → after:
> Before: 이번 개선으로 처리 속도가 매우 크게 향상되었다.
> After: 이번 개선으로 처리 시간이 12초에서 4초로 줄었다.
> Before: 참여율이 상당히 높았다.
> After: 대상자 80명 가운데 71명이 참여했다.
- Leave it: Speech, essays and personal notes where the intensity is the writer's voice; a report keeps it when no number exists.
- Evidence: weak.

### F-2 | Two modifiers with the same meaning
- What: Adjacent adjectives or adverbs repeat one quality.
- Why: The second word adds length and no information.
- Detect: Heuristic. Look for synonym pairs (`신속하고 빠른`, `명확하고 분명한`).
- Before → after:
> Before: 신속하고 빠른 대응이 필요하다.
> After: 빨리 대응해야 한다.
> Before: 명확하고 분명한 기준을 세웠다.
> After: 기준을 분명히 세웠다.
- Leave it: Legal pairs that are terms of art, and rhetoric the writer chose.
- Evidence: weak.

### F-3 | Function-and-role doublet (`기능과 역할`)
- What: A phrase names both a function and a role when one covers the other.
- Why: The doublet pads the noun phrase.
- Detect: Heuristic. Common pairs: 기능과 역할, 목적과 취지, 방안과 대책.
- Before → after:
> Before: 위원회의 기능과 역할을 재정립한다.
> After: 위원회가 맡을 일을 다시 정한다.
> Before: 사업의 목적과 취지를 설명했다.
> After: 사업 목적을 설명했다.
- Leave it: Fields where the two terms differ in meaning (조직론의 '기능'과 '역할').
- Evidence: weak. A concision cue.

### F-4 | Nominalization suffix chain (`~화`, `~성`, `~적`)
- What: Abstract nouns stack derivational suffixes where a verb would be clearer. Feeds `ko-light-verb`.
- Why: The sentence turns into a string of concepts with no action.
- Detect: Heuristic. Several `~화`/`~성` nouns in one clause.
- Before → after:
> Before: 업무 절차의 표준화 및 효율화를 통한 생산성 극대화를 추진한다.
> After: 업무 절차를 표준으로 맞춰 처리 시간을 줄인다.
> Before: 데이터 활용성 제고를 위한 접근성 강화가 요구된다.
> After: 데이터를 더 쉽게 찾고 쓸 수 있게 해야 한다.
- Leave it: Established technical terms (가용성, 확장성) used in their exact sense.
- Evidence: weak. The source sets a threshold but cautions that genre matters.

### F-5 | Repeated abstract `~적` compounds
- What: Many nouns are modified by a generic `~적` adjective.
- Why: `전략적`, `체계적`, `효과적` pile up without naming what is strategic or systematic.
- Detect: Density of `~적` forms per paragraph.
- Before → after:
> Before: 체계적이고 효과적인 전략적 접근이 필요하다.
> After: 담당자와 마감일을 정하고 주마다 진척을 확인한다.
> Before: 지속적이고 적극적인 소통을 추진한다.
> After: 매달 첫 주에 주민 설명회를 연다.
- Leave it: A single `~적` that is the precise word (법적 책임, 물리적 손상).
- Evidence: weak.

### F-7 | Generic policy verbs with abstract objects (`강화`, `확대`, `제고`, `개선`)
- What: General verbs such as strengthen, expand or improve attach to vague abstract nouns. Feeds `ko-light-verb`.
- Why: The sentence sounds like policy while saying nothing about what changes.
- Detect: Pair a generic verb with its object and ask what concrete change it means.
- Before → after:
> Before: 현장 안전 관리 체계를 강화하고 대응 역량을 제고한다.
> After: 현장마다 안전 관리자를 한 명 두고, 분기마다 대피 훈련을 한다.
> Before: 시민 소통을 확대하고 서비스 품질을 개선한다.
> After: 민원 답변 기한을 7일에서 3일로 줄인다.
- Leave it: A heading or summary line that a detailed paragraph immediately explains.
- Evidence: validated. Large corpus differences for several abstract nouns and verbs.

## G. Hedging and balance

### G-1 | Repeated inference endings (`~로 보인다`, `~것으로 판단된다`)
- What: Statement after statement ends in "appears" or "is judged to be". Related warnings: `ko-status-negation` and `ko-mi-status` cover nearby status endings.
- Why: Everything sounds equally tentative, so the reader cannot tell measurement from guess.
- Detect: Count the inference endings per paragraph; then sort claims by evidence strength.
- Before → after:
> Before: 응답 시간은 줄어든 것으로 보인다. 오류도 감소한 것으로 판단된다.
> After: 응답 시간은 평균 3초에서 2초로 줄었다. 오류 감소는 일주일 자료뿐이라 아직 판단하기 이르다.
> Before: 원인은 설정 오류로 보이며 재발 가능성은 낮은 것으로 보인다.
> After: 원인은 설정 오류였다. 같은 설정을 쓰는 서버는 이제 없다.
- Leave it: Real uncertainty. Keep one inference ending where the evidence is partial; the edit sorts claims, it does not raise confidence.
- Evidence: weak. Source revisions focus on preserving modality.

### G-2 | Several qualifiers around one claim
- What: Two or more hedges wrap one statement (`다소`, `어느 정도`, `~할 수도 있을 것으로 보인다`). Feeds `ko-stacked-hedges` and, for chained caveats, `ko-stacked-limitation-chain`.
- Why: Duplicate hedges blur how uncertain the writer actually is.
- Detect: Count qualifiers per sentence. The write guard counts two per sentence as stacked.
- Before → after:
> Before: 이 방법이 다소 효과가 있을 수도 있을 것으로 보인다.
> After: 이 방법은 효과가 있을 수 있다.
> Before: 어느 정도 개선된 측면이 일부 있는 것 같다.
> After: 일부 지표가 개선되었다.
- Leave it: Medical, legal, scientific and forecast text where each qualifier carries meaning. Keep the one that sets the claim's strength.
- Evidence: weak. With strict domain exclusions.

### G-3 | Safe-balance vocabulary
- What: Both-sides and caution terms (`균형 잡힌`, `신중한`, `종합적으로`) repeated in place of a decision.
- Why: The text performs fairness and never says what it recommends.
- Detect: Judgment. The source's proposed score never reached its threshold in testing.
- Before → after:
> Before: 장단점을 균형 있게 고려하여 신중하고 종합적으로 판단할 필요가 있다.
> After: 비용은 A안이 낮고, 납기는 B안이 2주 빠르다. 납기가 우선이면 B안을 고른다.
> Before: 다양한 측면을 종합적으로 검토해야 한다.
> After: 비용, 인력, 일정 세 가지를 비교한다.
- Leave it: A real call for balance when the writer is deliberately withholding a recommendation.
- Evidence: hold. Five occurrences across 120 items, and no document reached the proposed threshold.

## H. Connectives and topic reference

### H-1 | Sentence-initial connective density (`또한`, `따라서`, `즉`, `나아가`)
- What: Many sentences in a paragraph open with a listed connective.
- Why: Every link is announced, even obvious ones, and the real logic gets lost among them.
- Detect: `scripts/ko-metrics.mjs` flags three or more per paragraph.
- Before → after:
> Before: 또한 비용이 줄었다. 나아가 처리 시간도 줄었다. 따라서 만족도가 높아졌다.
> After: 비용과 처리 시간이 함께 줄었고, 만족도 조사 점수도 올랐다.
> Before: 즉, 이 기능은 선택 사항이다. 또한 기본값은 꺼져 있다.
> After: 이 기능은 선택 사항이고 기본값은 꺼져 있다.
- Leave it: A connective that marks a real step of reasoning.
- Evidence: weak. A high total came mostly from one model family.

### H-2 | Rotating contrast markers (`그러나`, `하지만`, `반면`, `다만`)
- What: Consecutive paragraphs rotate through equivalent contrast words.
- Why: The rotation signals contrast where there may be none.
- Detect: Heuristic. Count contrast openers across neighbouring paragraphs.
- Before → after:
> Before: 그러나 예산은 늘었다. 하지만 인력은 그대로다. 반면 업무는 늘었다.
> After: 예산은 늘었지만 인력은 그대로인데, 업무만 늘었다.
> Before: 다만 일정은 지켰다. 그럼에도 불구하고 품질 문제가 있었다.
> After: 일정은 지켰지만 품질 문제가 두 건 생겼다.
- Leave it: Real contrasts, each against a named claim.
- Evidence: weak.

### H-3 | Repeated "this/that" topic pointer (`이는`, `이러한`, `이를 통해`)
- What: Paragraphs keep opening by pointing back at the previous sentence.
- Why: The pointer delays the real subject and can be ambiguous.
- Detect: Count `이는`/`이러한` at sentence starts; check each referent.
- Before → after:
> Before: 이는 비용 절감으로 이어졌다. 이러한 결과는 의미가 크다.
> After: 재사용률이 오르면서 비용이 15% 줄었다.
> Before: 이를 통해 사용자의 불편을 해소할 수 있다.
> After: 이제 사용자는 비밀번호를 한 번만 입력한다.
- Leave it: A pointer whose referent is unmistakable and whose noun would be clumsy to repeat.
- Evidence: weak. Model-specific count differences do not support a universal detector.

### H-4 | Repeated restatement marker (`즉`, `다시 말해`)
- What: A paragraph keeps restating itself with "that is".
- Why: The restatement suggests the first version was unclear; fix the first version.
- Detect: Heuristic. Two or more restatement markers in a paragraph.
- Before → after:
> Before: 응답은 비동기로 온다. 즉, 바로 오지 않는다. 다시 말해 기다려야 한다.
> After: 응답은 비동기로 오므로 결과를 기다려야 한다.
> Before: 기한은 3일이다. 즉 72시간이다.
> After: 기한은 72시간(3일)이다.
- Leave it: Teaching text that defines a term and then rephrases it on purpose.
- Evidence: weak.

## I. Noun-heavy forms

### I-1 | Repeated "it is that" ending (`~인 것이다`, `~하는 것이다`)
- What: Several paragraphs close with an explanatory `것이다` ending.
- Why: The ending adds a lecturing tone when it repeats.
- Detect: Count `것이다` closers per section.
- Before → after:
> Before: 결국 문제는 인력이 부족했던 것이다.
> After: 인력이 부족했다.
> Before: 이 수치는 수요가 늘었다는 것이다.
> After: 이 수치는 수요가 늘었음을 보여 준다.
- Leave it: The ending is natural Korean in explanation and conclusion. The source's comparison rejects any blanket rule against it.
- Evidence: validated.

### I-2 | Repeated dependent nouns (`점`, `부분`, `측면`, `경우`)
- What: Sentence endings lean on abstract dependent nouns.
- Why: The noun stands where the named object or condition should be.
- Detect: Count per paragraph; ask what each `부분` or `측면` refers to.
- Before → after:
> Before: 보안 측면에서 개선이 필요한 부분이 있다.
> After: 관리자 계정에 2단계 인증이 없다.
> Before: 일부 경우에 오류가 발생하는 점을 확인했다.
> After: 첨부 파일이 10MB를 넘으면 오류가 난다.
- Leave it: A `경우` that sets a real condition (`비가 오는 경우 행사는 실내에서 연다`).
- Evidence: weak.

### I-3 | "The fact that" wrapper (`~라는 사실`, `~라는 의미`)
- What: A proposition is packaged as "the fact that".
- Why: The wrapper adds a noun layer around a plain statement.
- Detect: Heuristic for the fixed wrappers.
- Before → after:
> Before: 일정이 지연되었다는 사실을 알려 드립니다.
> After: 일정이 늦어졌습니다.
> Before: 이것은 비용이 줄었다는 의미를 가진다.
> After: 비용이 줄었다.
- Leave it: A contested fact being established as such ("~라는 사실은 기록으로 확인된다").
- Evidence: weak. A model-skewed subvariant, not a rule for every use.

### I-4 | Need-and-obligation report ending (`~할 필요가 있다`, `~해야 할 것이다`)
- What: Paragraph after paragraph closes with a necessity claim.
- Why: Recommendations pile up with no owner, order or date.
- Detect: Count necessity closers per section. The modality itself must stay.
- Before → after:
> Before: 담당 인력을 보강할 필요가 있다. 교육 체계를 정비할 필요가 있다.
> After: 다음 달까지 담당자를 한 명 늘리고, 교육 일정은 그 담당자가 정한다.
> Before: 관련 부서 간 협의가 이루어져야 할 것이다.
> After: 시설과와 예산과가 6월 첫 주에 협의한다.
- Leave it: Policy text whose force (must, should, may) is binding. Never weaken or strengthen it; the edit adds the owner only when the draft names one.
- Evidence: validated. A 7.22× task-matched difference; modality markers stay intact.

### I-5 | "Need" noun without an actor (`필요성`)
- What: A sentence names a need and no one who can meet it.
- Why: The need floats; nobody acts.
- Detect: Heuristic for `필요성이 대두되다`, `필요성이 제기되다`.
- Before → after:
> Before: 시스템 개편의 필요성이 대두되고 있다.
> After: 운영팀은 올해 안에 시스템을 개편하자고 제안했다.
> Before: 추가 조사의 필요성이 제기되었다.
> After: 심사위원 두 명이 추가 조사를 요청했다.
- Leave it: A finding whose actor the source does not give. Keep the vague form; inventing the actor is worse.
- Evidence: weak.

### I-6 | Repeated ability nouns (`역량`, `능력`, `기능`)
- What: A document keeps describing what something can do through ability nouns.
- Why: The capability stays abstract.
- Detect: Count `역량`/`능력` per section.
- Before → after:
> Before: 팀의 대응 역량과 문제 해결 능력을 강화한다.
> After: 장애 대응 훈련을 분기마다 한다.
> Before: 이 도구는 자동 분류 기능을 보유하고 있다.
> After: 이 도구는 메일을 자동으로 분류한다.
- Leave it: HR and competency frameworks where these are defined terms.
- Evidence: weak.

### I-7 | Unnamed analyst conclusion (`분석에 따르면`, `평가된다`)
- What: A conclusion is credited to an anonymous analysis or evaluation. Related warning: `ko-weasel-attribution`.
- Why: The reader cannot check who concluded it or on what basis.
- Detect: Heuristic for anonymous-source phrases.
- Before → after:
> Before: 전문가들은 이 정책이 효과적이라고 평가한다.
> After: 2025년 구 의회 보고서는 이 정책으로 대기 기간이 줄었다고 적었다.
> Before: 분석 결과 수요가 증가할 것으로 전망된다.
> After: 교통연구팀의 3월 예측은 수요가 5% 늘어난다고 본다.
- Leave it: When the draft names no source, write it as the writer's own estimate. Supplying a plausible source is fabrication.
- Evidence: validated. Human 0 and model 5 in the source, all in interview or citation tasks; genre and attribution context decide.

## J. Visual punctuation

### J-1 | Bold on most body phrases
- What: Bold marks many ordinary nouns or clauses. Related warning: `ko-decorative-bold`; a bold process label is a block under `ko-bold-deliverable-label`.
- Why: Emphasis everywhere is emphasis nowhere.
- Detect: Count bold spans per line and paragraph.
- Before → after:
> Before: **신청 기간**은 **3월**이며 **온라인**으로 **접수**합니다.
> After: 신청은 **3월 한 달** 동안 온라인으로 받습니다.
> Before: 이번 **개선**으로 **속도**와 **안정성**이 모두 **향상**되었다.
> After: 이번 개선으로 처리 속도와 안정성이 함께 좋아졌다.
- Leave it: Scan-first documents (manuals, quick references) with a consistent bold convention.
- Evidence: weak.

### J-2 | Quotation marks used for emphasis
- What: Ordinary concepts sit in quotation marks though nobody is quoted.
- Why: Readers take the quotes as irony or as someone else's words.
- Detect: Quoted spans that are not speech, titles or disputed terms.
- Before → after:
> Before: 이번 개편의 핵심은 '사용자 중심'이다.
> After: 이번 개편에서는 사용자가 자주 쓰는 메뉴를 첫 화면으로 옮겼다.
> Before: 팀은 '빠른 실행'을 목표로 한다.
> After: 팀은 요청을 받은 날 처리를 시작한다.
- Leave it: Real quotations, titles, coined terms on first use and words under discussion.
- Evidence: validated. 2.4× more emphasis quotes in task-matched model text, with task dependence.

### J-3 | Decorative em-dash clusters
- What: Em dashes repeatedly insert asides or dramatic pivots. Related warning: `en-em-dash-cluster` for English text.
- Why: Korean seldom uses the dash this way, and a cluster reads as staged.
- Detect: Count dashes per line or paragraph.
- Before → after:
> Before: 결과는 — 예상과 달리 — 좋았다 — 적어도 이번에는.
> After: 결과는 예상보다 좋았다. 다만 한 번의 결과다.
> Before: 원인은 하나였다 — 설정 파일이었다.
> After: 원인은 설정 파일이었다.
- Leave it: A single dash used for a range, an aside in an essay, or a house style that uses dashes.
- Evidence: weak. The current guidance limits the cue to repeated decoration.

### J-4 | Parenthetical afterthought chain
- What: Many parenthetical remarks interrupt otherwise complete sentences.
- Why: The main line of the sentence breaks into fragments.
- Detect: Count parentheses per paragraph; ignore glosses, units and citations.
- Before → after:
> Before: 시험(1차)은 5월(중순)에 했고 결과(잠정)는 양호(일부 예외)했다.
> After: 1차 시험은 5월 중순에 했다. 잠정 결과는 양호하지만 예외가 두 건 있었다.
> Before: 담당자(필요 시 대리인)가 승인(서면)한다.
> After: 담당자가 서면으로 승인하고, 담당자가 없으면 대리인이 승인한다.
- Leave it: Units, abbreviations defined once, citations and legally required qualifications.
- Evidence: weak.

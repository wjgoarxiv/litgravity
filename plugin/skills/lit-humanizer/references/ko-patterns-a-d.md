# Korean pattern catalog: A to D

Groups A to D of the 85-entry Korean catalog: translation-shaped syntax (A), English terms inside Korean (B), layout and paragraph rhythm (C), and recurring phrases and endings (D). Groups E to J are in `references/ko-patterns-e-j.md`; the index and the evidence labels are in `references/ko-patterns.md`.

How to read an entry. Each one gives what the pattern looks like, why it can weaken a sentence, how to spot it, two Korean before-and-after pairs, when to leave it alone, and the evidence label carried over from the source taxonomy. The pairs are new sentences on neutral subjects. They show a direction of edit; they are not templates to paste.

Three cautions apply to every entry.

- An entry is a reason to reread a sentence. It is never a finding about who wrote it.
- Several entries are marked validated because the source measured them, and some of those measurements show people using the form more often than models. For those, the evidence argues for keeping the form, and only a dense cluster justifies an edit.
- Edit for the reader. A count reaching a threshold is a reason to look; the decision comes from reading.

## A. Translation-shaped syntax

### A-1 | Topic-framing phrase (`~에 대해`, `~에 관해`)
- What: A noun is wrapped again and again in a formal "about this topic" phrase.
- Why: The wrapper delays the verb and can echo an English preposition.
- Detect: Heuristic. Look only when the same wrapper appears three or more times in one paragraph.
- Before → after:
> Before: 신규 규정에 대해 도입 일정에 관해 논의할 필요가 있다.
> After: 신규 규정을 언제 도입할지 논의해야 한다.
> Before: 이 장은 구 예산에 대한 내용을 다룬다.
> After: 이 장은 구 예산을 다룬다.
- Leave it: The source measured this wrapper as more frequent in human Korean than in model text. Ordinary single uses stay.
- Evidence: validated. The measured direction argues for restraint; density is the only edit trigger.

### A-2 | Means-and-pathway phrase (`~를 통해`)
- What: Many different actions are expressed as happening "through" something.
- Why: One connector repeated over distinct processes makes them sound interchangeable and hides the verb.
- Detect: Heuristic. Review three or more uses in a paragraph.
- Before → after:
> Before: 로그 분석을 통해 시간 초과 원인을 파악하였다.
> After: 로그를 분석해 시간 초과 원인을 찾았다.
> Before: 신청서는 온라인 창구를 통해 제출할 수 있다.
> After: 신청서는 온라인 창구에서 제출한다.
- Leave it: The source's corpus comparison found this phrase common in original Korean writing. One use is never a tell.
- Evidence: validated. The comparison rejects the simple "translationese" reading.

### A-3 | Situation-padding phrase (`~에 있어서`)
- What: A sentence opens with a formal phrase meaning "in the matter of".
- Why: It inserts a noun frame where a plain topic or place would do.
- Detect: Regex or heuristic for the fixed phrase near a sentence start. Feeds the `ko-calque` rule.
- Before → after:
> Before: 접근 권한 부여에 있어서 마감일은 금요일이다.
> After: 접근 권한 신청은 금요일에 마감한다.
> Before: 인력 운용에 있어서 두 자리가 비어 있다.
> After: 인력 두 자리가 아직 비어 있다.
- Leave it: Legal and academic prose may need to fence off a formal domain.
- Evidence: weak. A conventional editorial diagnosis without comparative counts.

### A-4 | Reason-label clause (`~라는 점에서`)
- What: A clause ends by labelling the preceding claim a "point" or "aspect".
- Why: The label restates the relation instead of adding evidence, and a causal connector is often clearer.
- Detect: Heuristic. Look for repeated noun-plus-reason endings.
- Before → after:
> Before: 대기 요청이 줄었다는 점에서 대기열이 짧아졌다고 할 수 있다.
> After: 대기 요청이 줄어 대기열이 짧아졌다.
> Before: 다리를 거치지 않는다는 점에서 이 경로는 유용하다.
> After: 이 경로는 다리를 거치지 않는다.
- Leave it: Keep it where a formal distinction really matters ("법적 책임이 없다는 점에서 위탁과 다르다").
- Evidence: weak. The source reports no cases in two comparison sets, which does not make it a strong tell.

### A-5 | Related-to wrapper (`~와 관련된`, `~관련`)
- What: A topic is named through a long "related to" phrase.
- Why: The phrase hides the actual relation or action.
- Detect: Regex or heuristic. Flag clusters; one technical relation stays.
- Before → after:
> Before: 계정 복구와 관련된 문제 두 가지를 제기했다.
> After: 계정 복구 문제 두 가지를 제기했다.
> Before: 공지는 일정 관련 사항에 관한 것이다.
> After: 공지는 일정 변경을 알린다.
- Leave it: "관련" is right when the relation is broad or not yet classified.
- Evidence: weak. No direct comparative measurement.

### A-6 | Basis-wrapper repetition (`~를 바탕으로`, `~에 기반하여`)
- What: Each decision is said to rest on a named basis.
- Why: The wrapper conceals whether the writer used, compared or merely received the basis.
- Detect: Heuristic. Inspect repetition; replace only when the action is known.
- Before → after:
> Before: 예약 기록을 바탕으로 일정을 결정하였다.
> After: 예약 기록을 보고 일정을 정했다.
> Before: 점수는 제출된 합계에 기반하여 산정되었다.
> After: 제출된 합계로 점수를 계산했다.
- Leave it: Keep the phrase when it separates evidence from a rule or an assumption.
- Evidence: weak. A general style recommendation.

### A-7 | Possession verb for a quality (`~을 가지다`, `~을 지니다`)
- What: A quality is framed as something an entity "has".
- Why: A simple property turns into a padded noun phrase. Feeds the `ko-light-verb` rule.
- Detect: Heuristic. Check whether the quality reads better as a predicate.
- Before → after:
> Before: 이 전동기는 높은 효율성을 가지고 있다.
> After: 이 전동기는 효율이 높다.
> Before: 안내 페이지는 우수한 가독성을 지닌다.
> After: 안내 페이지는 읽기 쉽다.
- Leave it: Literal possession, inventory, or an object held by a person.
- Evidence: weak. Extended from light-verb studies without a count for this form alone.

### A-8 | Double passive (`되어지다`, `보여지다`)
- What: Two passive layers stack on one action.
- Why: The extra layer lengthens the predicate and blurs the actor. Feeds the `ko-double-passive` rule.
- Detect: Regex for doubled passive endings; confirm the actor before switching to active.
- Before → after:
> Before: 요청은 대기열에서 처리되어진다.
> After: 요청은 대기열에서 처리된다.
> Before: 이 결과는 오류로 보여진다.
> After: 이 결과는 오류로 보인다.
- Leave it: A single passive is ordinary Korean; keep it when the actor is unknown or beside the point.
- Evidence: weak. Linked to translation studies, no per-item corpus result.

### A-9 | Agent phrase plus passive (`~에 의해 ~되다`)
- What: A sentence names its agent in a "by" phrase and keeps a passive predicate.
- Why: The agent arrives late though it could lead the sentence.
- Detect: Heuristic. Requires both an explicit agent phrase and a passive verb.
- Before → after:
> Before: 이미지는 렌더링 서비스에 의해 생성되었다.
> After: 렌더링 서비스가 이미지를 만들었다.
> Before: 해당 파일은 정리 작업에 의해 삭제되었다.
> After: 정리 작업이 그 파일을 지웠다.
- Leave it: The passive fits when the affected object is the topic of the paragraph.
- Evidence: weak. A translation-shaped cue without direct measurement.

### A-10 | Repeated ability modality (`~할 수 있다`)
- What: Several adjacent claims all end in "can".
- Why: The repetition sounds mechanically parallel and can blur which outcomes are likely.
- Detect: Heuristic. Look at four or more in a row, and preserve the modality.
- Before → after:
> Before: 이 수정은 재시도를 줄일 수 있다. 부하를 낮출 수 있다. 대기 시간을 단축할 수 있다.
> After: 이 수정으로 재시도가 줄고, 부하와 대기 시간도 함께 줄어들 수 있다.
> Before: 필터는 초안을 숨길 수 있다. 묶을 수 있다. 내보낼 수 있다.
> After: 필터로 초안을 숨기거나 묶고, 내보낼 수도 있다.
- Leave it: In medical, legal, policy and forecast text the strength of possibility is part of the claim. The source now says not to vary this form there.
- Evidence: weak. Even the rhythm edit is restricted because modality changes meaning.

### A-11 | Purpose-clause repetition (`~하기 위하여`)
- What: Each action is introduced by a long purpose clause.
- Why: The wrapper delays the action and can overstate intent.
- Detect: Heuristic. Repetition may justify a shorter purpose ending.
- Before → after:
> Before: 입찰 내용을 비교하기 위하여 회의를 개최하였다.
> After: 입찰 내용을 비교하려고 회의를 열었다.
> Before: 합계를 확인하기 위해서 두 번째 창을 열었다.
> After: 합계를 확인하려고 창을 하나 더 열었다.
- Leave it: The source measured this family as more common in human prose. Ordinary uses stay.
- Evidence: validated. The data argue against treating it as a marker on its own.

### A-12 | Event made into a noun plus generic verb (`~이 이루어지다`)
- What: An event or agreement is described as something that "was made" or "took place".
- Why: The noun-plus-generic-verb shape hides who acted and what changed. Feeds `ko-double-passive` when it doubles.
- Detect: Heuristic. Ask who acted and whether an event verb exists.
- Before → after:
> Before: 화요일에 합의가 이루어졌다.
> After: 두 팀은 화요일에 합의했다.
> Before: 배포 전에 검토가 진행되었다.
> After: 팀은 배포 전에 빌드를 검토했다.
- Leave it: Institutional wording when the actor is unknown or deliberately general.
- Evidence: weak. Editorial examples without counts.

### A-13 | Unmarked noun chain
- What: Several nouns sit side by side with no particle showing how they relate.
- Why: The reader has to work out which noun modifies which.
- Detect: Heuristic. Inspect headline-like strings inside body prose.
- Before → after:
> Before: 지역 용수 수요 예측 갱신 작업 오늘 시작.
> After: 기관은 오늘부터 지역 용수 수요 예측을 새로 고친다.
> Before: 축전 설비 안전 점검 결과 요약 준비 완료.
> After: 축전 설비 안전 점검 결과를 요약해 두었다.
- Leave it: Established compounds, table headings, search labels and slide titles.
- Evidence: weak. No comparison for this cue.

### A-14 | Clause joined by a stock conjunction (`그리고`)
- What: A new clause is attached again and again with the same additive word.
- Why: Actions flatten into a list and their relation disappears.
- Detect: Heuristic. Check whether the clauses are sequential, causal or independent.
- Before → after:
> Before: 그는 서류에 서명했다. 그리고 그는 서류를 발송했다.
> After: 그는 서류에 서명해 발송했다.
> Before: 문이 열렸다. 그리고 버스가 출발했다.
> After: 문이 열리자 버스가 출발했다.
- Leave it: A real addition, or a deliberate spoken rhythm.
- Evidence: weak. An editing cue, not a measured classifier.

### A-15 | Abstract subject with a generic verb (`~은 ~을 보여준다`)
- What: An event, idea or tool is made to "show", "offer" or "bring" a broad result.
- Why: The sentence avoids naming the measurement or the process behind the claim.
- Detect: Heuristic. An abstract subject plus a generic perception or provision verb.
- Before → after:
> Before: 이번 출시는 새 대기열의 가치를 보여준다.
> After: 출시 뒤 평균 대기 시간이 18분에서 6분으로 줄었다.
> Before: 이 정책은 가정에 더 나은 결과를 가져다준다.
> After: 이 정책으로 월 아동 수당이 오른다.
- Leave it: A figurative subject that is precise and familiar in the genre.
- Evidence: weak. Connected to translation theory without a standalone comparison.

### A-16 | Unanchored pronoun (`그것`, `그들`, `이는`)
- What: A pronoun appears where Korean would usually drop it or repeat the noun.
- Why: English pronouns carried over leave the referent unclear.
- Detect: Judgment only. Find the antecedent in the two previous sentences; keep the pronoun if more than one candidate remains.
- Before → after:
> Before: 보고서에는 구매 담당자 두 명이 나온다. 그들은 그것을 승인했다.
> After: 보고서에는 구매 담당자 두 명이 나온다. 이사회가 계획을 승인했다.
> Before: 라우터가 토큰을 저장한다. 그것은 한 시간 뒤 만료된다.
> After: 라우터가 저장한 토큰은 한 시간 뒤 만료된다.
- Leave it: Never delete pronouns to hit a ratio; restore a noun only when the referent is known.
- Evidence: weak. The source calls its window approximation preliminary.

### A-17 | Plural marker on abstract nouns (`~들`)
- What: An abstract or inanimate noun gets a plural marker by habit.
- Why: Korean leaves number unmarked when it is not contrastive.
- Detect: Judgment only. This ID is on hold and is not a rewrite instruction.
- Before → after:
> Before: 설문에서 나온 정보들을 비교한다.
> After: 설문에서 나온 정보를 비교한다.
> Before: 분석 전에 여러 데이터들을 제외했다.
> After: 분석 전에 일부 데이터를 제외했다.
- Leave it: Quoted text, technical usage and counted sets where plurality matters.
- Evidence: hold. Two small review rounds found no positives; the source waits for machine-translation samples.

### A-18 | Deep left-branching modifier
- What: Several clauses pile up before the noun they describe.
- Why: The reader holds the whole chain before learning its subject.
- Detect: Heuristic. Three or more nested modifying clauses; one modifier is fine.
- Before → after:
> Before: 이미지 업로드를 처리하는 서비스가 생성한 파일이 실패했다.
> After: 업로드 서비스가 파일을 만들었는데, 그 파일 처리가 실패했다.
> Before: 6월에 합류한 팀장이 꾸린 팀이 해체되었다.
> After: 팀장은 6월에 합류해 팀을 꾸렸다. 그 팀은 이후 해체되었다.
- Leave it: Legal and technical definitions sometimes need the long modifier. Split only if the referent stays exact.
- Evidence: weak. Cited from translation scholarship without direct measurement.

### A-19 | Stacked case particles (`~에서의`, `~으로의`, `~에게로의`)
- What: Several particles fuse into one heavy noun modifier.
- Why: A clause or simpler relation reads more easily.
- Detect: Regex for the listed compound endings. A plain possessive `의` is out of scope.
- Before → after:
> Before: 위원회로부터의 제안서 검토는 월요일에 시작된다.
> After: 위원회는 월요일부터 제안서를 검토한다.
> Before: 역으로의 진입로가 폐쇄되었다.
> After: 역으로 들어가는 길이 막혔다.
- Leave it: Fixed terms and exact spatial relations.
- Evidence: weak. The source excludes broad single-particle forms because the evidence is unsettled.

### A-20 | Passive-progressive clustering (`~되고 있다`)
- What: Every trend in a paragraph is told in the passive progressive.
- Why: The repetition builds a report-like metronome and can hide a finished change.
- Detect: Heuristic. Three or more in a paragraph.
- Before → after:
> Before: 비용이 증가되고 있다. 지연이 확대되고 있다. 민원이 늘어나고 있다.
> After: 비용과 지연이 늘었고, 민원도 함께 증가했다.
> Before: 대기열이 확장되고 있으며 한도가 강화되고 있다.
> After: 운영팀이 대기열을 늘리면서 한도를 조이고 있다.
- Leave it: A process that really continues, or an actor the source leaves unknown.
- Evidence: validated. Humans use it too; only a dense cluster justifies an edit.

### A-21 | "Beyond a simple X" escalation (`단순한 ~을 넘어`)
- What: A sentence dismisses a small frame and then lifts the subject above it.
- Why: The contrast adds importance without naming a concrete relation. Feeds `ko-negation-contrast`.
- Detect: Regex or heuristic for the "beyond a simple thing" construction.
- Before → after:
> Before: 이번 개편은 단순한 대시보드를 넘어 계획 수립 방식을 혁신한다.
> After: 이번 개편으로 주간 수요를 보여 주는 대시보드가 생겼다.
> Before: 이 모임은 단순한 취미를 넘어 도시를 변화시키는 원동력이다.
> After: 이 모임은 매주 두 번 모이고, 시 대회를 직접 운영한다.
- Leave it: A real comparison where both sides are specified.
- Evidence: validated. No human examples in the tested set; do not generalize beyond that set.

### A-22 | Confidence label on a claim (`~임은 분명하다`)
- What: A sentence calls its conclusion clear or obvious instead of stating it.
- Why: The label stands in for evidence.
- Detect: Heuristic. Separate an evaluative predicate from an adverb that carries the writer's real confidence.
- Before → after:
> Before: 4바에서 밸브가 새는 것은 분명하다.
> After: 밸브는 4바에서 샌다.
> Before: 첫 실행 결과만 보아도 결론은 자명하다.
> After: 첫 실행 결과가 이 결론을 뒷받침한다.
- Leave it: If the writer means emphatic certainty, keep it in a natural form and keep the proposition.
- Evidence: weak. The source warns against changing the strength of a conclusion.

### A-23 | Groundwork metaphor (`초석을 다지다`, `발판을 마련하다`)
- What: A measure is said to lay a foundation or open a road without naming what it enables.
- Why: A construction image replaces the mechanism with a promise.
- Detect: Regex or heuristic for the fixed metaphor family.
- Before → after:
> Before: 새 등록부는 안전한 검토의 초석을 마련한다.
> After: 새 등록부에는 검토마다 승인자가 기록된다.
> Before: 이번 시범 사업은 지역 교통의 새 지평을 연다.
> After: 이번 시범 사업으로 역과 병원 사이에 저녁 버스가 한 대 생긴다.
- Leave it: Literal foundations, roads, doors and physical access.
- Evidence: validated. No direct model or translation cases in the sample, so treat it as a narrow check.

### A-24 | "No longer" negation frame (`더 이상 ~이 아니다`)
- What: A change is told through what something no longer is.
- Why: The new state stays implicit, or the sentence stages a binary reveal. The pledge rules (`ko-negative-pledge`) catch a related shape aimed at the document itself.
- Detect: Heuristic. Two uses in one document, or a climactic redefinition.
- Before → after:
> Before: 이 파일은 더 이상 노트북에 저장되지 않는다.
> After: 이 파일은 이제 공유 드라이브에 저장된다.
> Before: 이 모임은 더 이상 자원봉사 조직이 아니다.
> After: 이 모임은 5월부터 유급 서비스로 운영된다.
- Leave it: Keep the negative when the positive version would invent what replaced the old state.
- Evidence: validated. Low rates in human material, and the phrase is sometimes introduced by editors.

## B. English terms inside Korean

### B-1 | Repeated parenthetical English
- What: Every technical term is followed by its English label or acronym, every time.
- Why: The parentheses break Korean sentence flow.
- Detect: Heuristic. Count repeated glosses after the first definition.
- Before → after:
> Before: 모델(model)은 토큰(token)을 읽고 점수(score)를 반환한다.
> After: 모델은 토큰을 읽고 점수를 돌려준다.
> Before: 모든 화면에 API(Application Programming Interface) 목록이 나온다.
> After: API 목록이 모든 화면에 나온다. (용어 정의는 처음 한 번만 둔다.)
- Leave it: The first necessary gloss, and glosses for a specialist reader who searches by the English term.
- Evidence: weak. No direct comparison.

### B-2 | Decorative English buzzword
- What: English adjectives are dropped in for prestige rather than precision.
- Why: A simple action sounds like marketing copy.
- Detect: Judgment. Ask whether the term names a recognized interface or standard.
- Before → after:
> Before: 이 서비스는 심리스한 온보딩 경험을 제공한다.
> After: 새 회원은 중간에 끊기지 않고 가입 절차를 마칠 수 있다.
> Before: 로버스트한 프레임워크를 레버리지해 인계를 처리한다.
> After: 프레임워크로 요청을 안전하게 넘긴다.
- Leave it: API names, protocol terms and words the readers use themselves.
- Evidence: weak. Editorial examples only.

### B-3 | Long English quotation with a duplicate translation
- What: A full English sentence sits beside a Korean paraphrase of the same point.
- Why: The reader reads the point twice without gaining tone or legal precision.
- Detect: Heuristic. Review only when both versions carry the same content.
- Before → after:
> Before: "The road was closed at noon." 도로는 정오에 폐쇄되었다.
> After: 도로는 정오에 폐쇄되었다. (원문이 필요하면 각주에 둔다.)
> Before: "No further action is required." 추가 조치는 필요하지 않다.
> After: 추가 조치는 필요하지 않다.
- Leave it: Exact quotations, contract language and text under linguistic analysis.
- Evidence: weak.

### B-4 | "Known as" naming wrapper (`~라고 불리는`, `~로 알려진`)
- What: A name is introduced with "called" or "known as" when the name alone works.
- Why: A simple name starts to read like a translation. Feeds `ko-calque`.
- Detect: Regex around naming clauses.
- Before → after:
> Before: 희소 캐싱이라고 불리는 기법은 저장 공간을 줄인다.
> After: 희소 캐싱은 저장 공간을 줄인다.
> Before: 북부 부두팀으로 알려진 모임은 금요일에 모인다.
> After: 북부 부두팀은 금요일에 모인다.
- Leave it: A nickname, a disputed label, or an alternative name that needs attribution.
- Evidence: weak. Rated mild by the source.

## C. Layout and paragraph rhythm

### C-1 | Mechanical numbered trio
- What: Three parts are built whether or not the ideas need three. Feeds `ko-forced-triad`.
- Why: Equal labels and cadence flatten real differences in weight.
- Detect: Judgment. Test each item for a distinct role.
- Before → after:
> Before: 속도, 품질, 확장성을 모두 점검했다.
> After: 시작 시간을 재고 출력 품질을 확인했다. 확장성은 아직 시험하지 않았다.
> Before: 워크숍은 계획, 구축, 검토의 세 단계로 똑같이 나뉜다.
> After: 워크숍은 짧게 계획을 세운 뒤 대부분의 시간을 구축에 쓰고, 마지막에 검토한다.
- Leave it: A real three-part classification. Korean rhetoric uses enumeration naturally.
- Evidence: weak.

### C-2 | Bullets where prose would connect the ideas
- What: A flowing explanation is chopped into full-sentence bullets.
- Why: Each bullet loses its link to cause, result and exception.
- Detect: Heuristic. Compare the list with a paragraph; no percentage target.
- Before → after:
> Before: - 회의실이 폐쇄되었다. - 담당자가 세션을 옮겼다. - 참석자에게 메일을 보냈다.
> After: 회의실이 폐쇄되자 담당자가 세션을 옮기고 참석자에게 메일로 알렸다.
> Before: - 캐시를 추가한다. - DB 호출이 줄어든다. - 한 시간 뒤 만료된다.
> After: 결과를 한 시간 동안 캐시해 DB 호출을 줄인다.
- Leave it: Checklists, scan-first slides and truly independent items.
- Evidence: weak. Genre matters more than bullet count.

### C-3 | Generic section headings (`서론`, `본론`, `결론`)
- What: Every section uses an outline label instead of a subject.
- Why: The headings describe the document's machinery. Related warning: `ko-plain-meta-label-warn`.
- Detect: Judgment. Read what each section actually covers.
- Before → after:
> Before: 개요 / 주요 내용 / 결론
> After: 검사가 실패한 이유 / 빠진 헤더 / 재현 방법
> Before: 배경 / 분석 / 향후 계획 (모든 장애 보고서에 동일)
> After: 장애 이름, 관찰된 영향, 담당자를 각 제목에 넣는다.
- Leave it: Required academic sections and templates readers navigate by.
- Evidence: weak.

### C-4 | Paragraph preview sentence
- What: A paragraph opens with a summary the next sentence repeats.
- Why: The preview delays the supporting fact.
- Detect: Heuristic. Compare the first two sentences for duplicate content.
- Before → after:
> Before: 캐시는 속도를 높였다. 엔드포인트 응답 시간이 900ms에서 240ms로 줄었다.
> After: 캐시를 넣은 뒤 엔드포인트 응답 시간이 900ms에서 240ms로 줄었다.
> Before: 두 팀이 반대했다. API팀과 디자인팀 모두 날짜를 거부했다.
> After: API팀과 디자인팀 모두 그 날짜에 반대했다.
- Leave it: A thesis sentence helps when the supporting paragraph is long.
- Evidence: weak.

### C-5 | Emoji as report structure
- What: Icons stand in for labels or headings.
- Why: They add noise and render differently across export formats.
- Detect: Regex finds emoji; judgment decides whether the medium expects them.
- Before → after:
> Before: 🚀 출시: 3분기에 서비스를 연다.
> After: 서비스는 3분기에 연다.
> Before: ✅ 결과: 점검 14건 모두 통과.
> After: 점검 14건이 모두 통과했다.
- Leave it: Social copy, chat, and slide systems where icons carry a consistent meaning.
- Evidence: weak.

### C-6 | One-line summary box under a heading
- What: A heading is followed by a bold or boxed summary, then the same detail. Related block: `ko-bold-deliverable-label` when the box is a process label.
- Why: The box duplicates the first sentence and creates a second opening.
- Detect: Heuristic. Compare the callout with the section's first paragraph.
- Before → after:
> Before: **성능:** 페이지가 빨라졌다. 첫 페이지 로딩 시간이 400ms로 줄었다.
> After: 첫 페이지 로딩 시간이 400ms로 줄었다.
> Before: **핵심:** 작업자 세 명이 남는다. 세 명이 아직 배정되어 있다.
> After: 작업자 세 명이 아직 배정되어 있다.
- Leave it: A dashboard or executive brief that requires a scan-first takeaway.
- Evidence: weak.

### C-7 | Fixed transition sequence (`먼저`, `반면`, `따라서`)
- What: Neighbouring paragraphs follow the same "first, by contrast, therefore" march.
- Why: The march can force a conclusion the evidence did not reach.
- Detect: Heuristic. The same three transition roles across adjacent paragraphs.
- Before → after:
> Before: 먼저 수요가 늘었다. 반면 공급은 줄었다. 따라서 가격이 변했다.
> After: 수요가 늘고 공급이 줄면서 가격이 8% 올랐다.
> Before: 먼저 시범 사업이 있었다. 반면 본사업은 규모가 컸다. 결국 비용이 늘었다.
> After: 시범 사업은 진료소 두 곳에서 했고, 본사업은 열두 곳으로 늘어 비용이 4천만 원 더 들었다.
- Leave it: Transitions that mark real chronology or contrast.
- Evidence: weak.

### C-8 | Repeated rhetorical binary (`A인가, B인가?`)
- What: Several sections pose a symmetrical either-or question.
- Why: Analysis turns into a series of staged pivots.
- Detect: Judgment. Count the shape at document level.
- Before → after:
> Before: 문제는 용량인가, 수요인가? 위험은 속도인가, 정확도인가?
> After: 수요가 용량을 넘었고, 검토가 느려지면서 정확도 위험이 커졌다.
> Before: 이것은 인력 문제인가, 교육 문제인가?
> After: 신규 인력은 2주 교육을 마쳐야 저녁 근무를 맡을 수 있다.
- Leave it: One real decision question can be the clearest framing.
- Evidence: hold-like. Promoted from repeated examples without a stable cross-model measurement; keep it a manual cue.

### C-9 | Parenthesized numbered sequence (`(1) … (2) …`)
- What: Inline (1), (2), (3) markers inside ordinary prose.
- Why: A simple paragraph starts to read like a legal checklist.
- Detect: Heuristic. Check whether order or cross-reference matters.
- Before → after:
> Before: (1) 로그인, (2) 내보내기, (3) 삭제를 시험한다.
> After: 로그인, 내보내기, 삭제 순으로 시험한다.
> Before: 검토 범위는 (1) 비용과 (2) 인력이다.
> After: 검토 범위는 비용과 인력이다.
- Leave it: Numbered controls readers cite by number.
- Evidence: weak.

### C-10 | Colon subtitle headings
- What: Heading after heading takes the form "topic: dramatic restatement". Related warning: `en-colon-reveal` for English text.
- Why: The heading announces a turn instead of naming the section.
- Detect: Heuristic. A repeated heading pattern; one useful colon is fine.
- Before → after:
> Before: 결과: 우리가 배운 것들
> After: 2차 시험 결과
> Before: 이전: 기존 설정에서 새로운 흐름으로
> After: 새 설정 흐름
- Leave it: References, subtitles and technical specifications.
- Evidence: weak.

### C-11 | Comma after a connective ending (`~하고,` `~하며,`)
- What: Connective endings are followed by commas in an English-like cadence.
- Why: The comma cuts clauses that Korean syntax already carries forward.
- Detect: Regex or morphology-aware heuristic; confirm the ending is grammatical and not a word fragment. `scripts/ko-metrics.mjs` counts it.
- Before → after:
> Before: 창문을 열고, 잠금장치를 확인했다.
> After: 창문을 열고 잠금장치를 확인했다.
> Before: 센서는 예열되었으며, 측정값을 반환했다.
> After: 센서는 예열된 뒤 측정값을 돌려주었다.
- Leave it: A comma that marks a real interruption or prevents a misreading.
- Evidence: validated. The source reports a 4.84× separation in one external study; it is not a universal threshold.

### C-12 | Document-wide comma density
- What: Many sentences carry several commas and long clause chains.
- Why: Several subordinate ideas compete inside one sentence.
- Detect: Metric candidate. The comma-bearing sentence share from `scripts/ko-metrics.mjs`, then read the longest spans.
- Before → after:
> Before: 팀은 문을 열고, 밀봉 상태를 확인하고, 압력을 기록한 뒤, 펌프를 가동했다.
> After: 팀은 밀봉 상태를 확인하고 압력을 기록했다. 그다음 펌프를 가동했다.
> Before: 월요일에 도착한, 통관이 늦어진, 센서는, 교정을 통과했다.
> After: 센서는 통관이 늦어져 월요일에 도착했고, 교정을 통과했다.
- Leave it: Numeric lists and formal prose use commas naturally; edit only when the clause load hurts reading.
- Evidence: validated. The source cites a 2.32× separation with genre limits.

## D. Recurring phrases and endings

### D-1 | Stock conclusion pivots (`결론적으로`, `따라서`, `이를 통해`, `그러므로`)
- What: Paragraph after paragraph closes with the same small group of summary words.
- Why: The pivot supplies formality without a new inference.
- Detect: Lexicon count. The source recommends a document threshold of three; `scripts/ko-metrics.mjs` flags four or more.
- Before → after:
> Before: 결론적으로 시험은 금요일에 끝났다.
> After: 시험은 금요일에 끝났다.
> Before: 따라서 다음 검토는 3월이다.
> After: 다음 검토는 3월에 한다.
- Leave it: A pivot that marks a real inference from the evidence just given.
- Evidence: weak. The lexicon comes from comparative research but should not drive a block rule alone.

### D-2 | Significance inflation (`중요한 의미를 지닌다`, `획기적인 전환점`)
- What: Ordinary facts are called pivotal, historic or deeply consequential.
- Why: Evaluation inflates the detail and hides the detail itself.
- Detect: Lexical review plus an evidence check.
- Before → after:
> Before: 이번 업데이트는 서비스에 있어 중요한 전환점이 된다.
> After: 이번 업데이트로 예약 내보내기 기능이 생겼다. 올해 처음 추가된 기능이다.
> Before: 이 부서는 절차에서 핵심적인 역할을 수행한다.
> After: 이 부서는 착공 전에 허가를 승인한다.
- Leave it: Importance backed by a stated criterion or an attributed assessment.
- Evidence: weak.

### D-3 | List-announcing introduction
- What: A sentence announces a list and then names the same items.
- Why: One layer of ceremony before the content.
- Detect: Heuristic. A short preview followed by the full list.
- Before → after:
> Before: 세 가지 변경 사항이 중요하다. API, 캐시, 재시도 정책이다.
> After: 이번 수정은 API, 캐시, 재시도 정책을 바꾼다.
> Before: 일정에 영향을 준 요인은 두 가지다. 눈과 도로 공사다.
> After: 눈과 도로 공사로 배송이 늦어졌다.
- Leave it: A list lead helps scan a long or complex set.
- Evidence: weak.

### D-4 | Hype adjectives (`혁신적인`, `획기적인`, `전례 없는`)
- What: Strong praise words cluster around a product or plan without a measure. Related warning: `en-lexical-tell` for English text.
- Why: Repeated intensity reads as promotion.
- Detect: Lexical heuristic plus density review in context.
- Before → after:
> Before: 이 시스템은 안전 분야에서 혁신적이고 전례 없는 도약을 이뤘다.
> After: 이 시스템을 도입한 뒤 근무조당 오경보가 12건에서 7건으로 줄었다.
> Before: 시범 사업은 놀랍고 획기적인 개선을 가져왔다.
> After: 시범 사업으로 준비 시간이 18분 줄었다.
- Leave it: An attributed quotation or the exact wording of an award.
- Evidence: validated. Repeated model-specific clusters, with model and genre effects.

### D-5 | Abstract noun as a human actor
- What: An abstraction decides, collides or leads as if it were a person.
- Why: The people or events behind the result disappear.
- Detect: Judgment. Identify the implied actor first.
- Before → after:
> Before: 의견 충돌이 최종 일정을 결정했다.
> After: 관리자들이 의견이 갈린 뒤 일정을 바꿨다.
> Before: 우선순위의 충돌이 허가를 지연시켰다.
> After: 두 팀이 경계선을 두고 다투자 계획 부서가 허가를 미뤘다.
- Leave it: A conventional metaphor that is vivid and accurate in an essay.
- Evidence: weak.

### D-6 | "Now is the time" ending (`지금이야말로 ~할 때다`)
- What: A recommendation ends with a generic call to act at the right moment.
- Why: Urgency without an owner or a date.
- Detect: Heuristic. Look for a concrete action hidden under the ceremonial close.
- Before → after:
> Before: 지금이야말로 접수 절차를 새롭게 바꿀 때다.
> After: 접수팀은 4월에 새 양식을 시험한다.
> Before: 이제는 교육에 투자해야 할 시점이다.
> After: 6월 전환 전에 교육을 두 차례 연다.
- Leave it: A real deadline or decision follows.
- Evidence: weak.

### D-7 | "From X to Y" transformation arc (`~에서 ~으로`)
- What: A small change is framed as a journey between two states.
- Why: The arc suggests a bigger transformation than the facts show.
- Detect: Heuristic. Require a stated before-and-after and check that the range is real.
- Before → after:
> Before: 이번 개편으로 지원 업무가 사후 대응에서 선제 대응으로 바뀐다.
> After: 이번 개편으로 문의가 24시간을 넘기기 전에 알림이 간다.
> Before: 이 사업은 접근성에서 역량 강화로 나아간다.
> After: 이 사업으로 주민 40명이 매주 진료를 예약할 수 있다.
- Leave it: Real migrations and measured changes of state.
- Evidence: weak.

### D-8 | Cleft emphasis frame (`중요한 것은 ~이다`, `필요한 것은 ~이다`)
- What: The sentence delays its subject by announcing what matters.
- Why: Emphasis is manufactured when a direct clause would do. `scripts/ko-metrics.mjs` counts the common shapes.
- Detect: Regex or heuristic for the cleft opener; check whether it contrasts with something.
- Before → after:
> Before: 2차 시험에서 확인된 것은 12%의 손실이다.
> After: 2차 시험에서 12% 손실이 확인되었다.
> Before: 중요한 것은 대기열이 가득 찼다는 점이다.
> After: 대기열이 가득 찼다.
- Leave it: A cleft that contrasts with a specific alternative already under discussion.
- Evidence: validated. Task-matched corpus evidence; the source warns against changing the claim.

### D-9 | "Ultimately leads to" close (`궁극적으로 ~로 이어진다`)
- What: A paragraph ends on a broad causal chain with no intermediate evidence.
- Why: The summary verb implies causation the facts did not establish.
- Detect: Heuristic. Trace each link to a stated observation.
- Before → after:
> Before: 이러한 지연은 궁극적으로 더 강한 팀으로 이어진다.
> After: 지연으로 인계가 이틀 늦어졌다.
> Before: 이번 변화는 결국 협업 향상으로 귀결되었다.
> After: 이번 변화로 승인 요청이 하나의 공유 대기열로 모였다.
- Leave it: A causal conclusion whose mechanism the source establishes.
- Evidence: validated. The formula can also be introduced during editing, so do not add it.

### D-10 | Reverse explanation ending (`~한 이유이다`, `~인 까닭이다`)
- What: A sentence ends by calling an earlier event "the reason why".
- Why: Sequence becomes cause without support.
- Detect: Heuristic. Confirm the causal link first.
- Before → after:
> Before: 재시작이 장애가 끝난 이유다.
> After: 재시작한 뒤 장애가 끝났다.
> Before: 서명이 늦게 도착한 것이 주문이 월요일을 넘긴 까닭이다.
> After: 서명이 늦게 도착해 주문이 월요일을 넘겼다.
- Leave it: Keep the causal claim when the source supports it; keep the correlation when it does not.
- Evidence: validated. Task-matched examples; avoid adding the formula while rewriting.

### D-11 | Vague future horizon (`앞으로도`, `장기적으로`)
- What: A conclusion points to the long term without naming a date or event.
- Why: A time phrase makes a generic hope sound like a plan.
- Detect: Heuristic. Inspect the last paragraph for an unsupported future promise.
- Before → after:
> Before: 이번 변화는 장기적으로 큰 의미를 갖게 될 것이다.
> After: 다음 검토는 9월로 잡혀 있다.
> Before: 앞으로도 팀은 접근성 개선을 위해 지속적으로 노력할 것이다.
> After: 팀은 10월에 주말 이용 시간을 추가한다.
- Leave it: A forecast horizon a cited model or plan specifies. When the draft gives no date, cut the promise; inventing a date is a fidelity defect.
- Evidence: validated.

### D-12 | Empty challenges slot (`과제도 남아 있다`)
- What: A balanced conclusion says challenges remain and names none.
- Why: It performs fairness without informing.
- Detect: Heuristic. Require a named open issue before keeping the slot.
- Before → after:
> Before: 다음 단계에서도 해결해야 할 과제가 남아 있다.
> After: 다음 단계에는 아직 예비 승인자가 없다.
> Before: 위험 요소는 있지만 팀은 낙관하고 있다.
> After: 공급사가 시험 장비 두 대의 납품을 아직 확정하지 않았다.
- Leave it: A required risk section. Fill it with real risks from the draft; adding one the draft lacks is a fidelity defect.
- Evidence: validated. Convergent across independent mining.

### D-13 | Reflective adverb as manufactured insight (`비로소`, `마침내 깨달았다`)
- What: A general reflection arrives behind a slow, profound-sounding adverb.
- Why: The modifier announces feeling the facts do not carry.
- Detect: Judgment. Reflective essays only; reports and testimony are out of scope.
- Before → after:
> Before: 그제야 비로소 우리는 인내의 가치를 깨달았다.
> After: 일정을 두 번 놓친 뒤에야 주간 점검을 넣었다.
> Before: 마침내 우리는 지도에 이름표가 필요하다는 사실을 알게 되었다.
> After: 독자들이 두 경로를 헷갈려서 이름표를 붙였다.
- Leave it: A writer's real memory, uncertainty or cadence.
- Evidence: validated but genre-limited to essays.

### D-14 | Generic metaphor (`다리`, `여정`, `지평`, `토대`)
- What: Images of horizons, journeys, bridges or foundations replace a concrete outcome.
- Why: Unrelated projects start to sound the same.
- Detect: Judgment. Identify the literal event before editing.
- Before → after:
> Before: 이 대시보드는 더 밝은 미래로 가는 다리다.
> After: 이 대시보드에서 진료소마다 처리 중인 의뢰 건수를 볼 수 있다.
> Before: 이 강좌는 학습자에게 새로운 지평을 열어 준다.
> After: 이 강좌에서 학습자는 면접 질문 세 가지를 연습한다.
- Leave it: A specific, author-owned metaphor or quoted language.
- Evidence: validated. Repeated user-observed cases; no universal ban.

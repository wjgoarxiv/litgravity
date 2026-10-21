# Fidelity checklist

Run this list before and after every rewrite. A smoother sentence that changes what the writer meant is a defect, however well it reads. In the Korean deep sequence this file is the brief for the `meaning-preservation-auditor` agent; in a single-pass edit you run it yourself.

## Before editing

- Write down the tone, audience and destination the user asked for. If the destination has its own conventions (README, commit body, slide, form field), note them.
- Mark every unit that must survive byte for byte: numbers, units, dates, names, titles, citations, quoted text, formulas, product labels, policy wording, code identifiers.
- Grade each claim by strength: fact, interpretation, possibility, recommendation, warning, preference, speculation. The grade travels with the claim into the revision.
- Mark the dependencies between sentences: cause, contrast, condition, exception, sequence, comparison.
- Choose the depth of change: rewrite, light correction, or leave nearly untouched.

## Facts

Compare each edited sentence with its original.

- Numbers and units are identical unless the user asked for a conversion or a correction.
- Names and titles keep their spelling, spacing, capitalization and order.
- Dates, deadlines, versions and ranges keep the same scope ("by March" stays "by March", never "in March").
- Citations, footnote markers and source labels stay attached to the claim they support.
- Quoted text is untouched unless the user asked for a paraphrase.
- An example stays an example; it never becomes evidence for a broader claim.

## Claim strength

The force of a sentence is part of its meaning.

| Original | Stays | Never becomes |
|---|---|---|
| may, 수 있다 | may | does, 한다 |
| some, 일부 | some | all, 모든 |
| can help, 도움이 될 수 있다 | can help | solves, 해결한다 |
| observed in this case | observed in this case | generally true |
| recommended, 권장 | recommended | required, 필수 |
| concern, 우려 | concern | confirmed problem |
| not shown, 확인되지 않음 | not shown | false, 사실이 아님 |
| not measured | not measured | zero |
| planned, 예정 | planned | done, 완료 |

## Tone and register

- Keep the requested politeness level and the speech level the draft already uses (합쇼체 stays 합쇼체).
- Keep the stance the writer chose: neutral, warm, firm, cautious, persuasive, apologetic, critical.
- Remove inflated grandness only when it is outside the voice the writer wants.
- A careful warning stays careful; a personal note stays personal.
- Add no praise, blame, urgency or certainty the original lacked.

## Korean naturalness pass

After the meaning pass, read the revision as Korean, sentence by sentence.

- The main predicate arrives before the reader has to hold a long run of modifiers.
- Particles match the relation between the words they join.
- Endings are consistent and chosen for how the sentences relate.
- Every connective names a real logical step.
- Paragraphs move from known context to new information.
- Technical terms stay stable; a repeated term thins out only when the reference stays clear.
- 띄어쓰기 and spelling follow the standard (의존 명사 띄어 쓰기, 보조 용언 규칙, 단위 띄어쓰기의 일관성).

## Low-change decision

Choose a low-change result when any of these holds:

- the original already reads naturally in its context;
- the passage is a quotation, a policy line, a citation, a form field or regulated wording;
- the user asked for proofreading;
- the text is dense with facts, so every style edit adds risk;
- the voice depends on the writer's own phrasing.

Say in one line why little or nothing changed. Leaving good writing alone needs no apology.

## Final gate

Answer each question before returning the text.

1. Did any fact, number, name, citation, quote or claim move or change?
2. Did any hedge, limit, exception or uncertainty marker disappear?
3. Does the tone still match the instruction?
4. Is every added word supported by the source or by an explicit user instruction?
5. Would a reader come away with the same obligations, risks and conclusions?
6. If the safest answer is no edit, does the reply say so plainly?

When one answer shows risk, redo that sentence with a smaller change or ask the user with `ask_question`, giving the safer version as the recommended default. In a headless run where the question cannot be answered, keep the safer version and record the choice as a `decision` line in the ledger.

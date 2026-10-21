# A/B prompt set for lit-humanizer

Ten fixed prompts for comparing a plain run against a run with this skill loaded. Five genres, each in English and Korean. Every prompt carries the facts the answer must keep, so a reviewer can check fidelity and naturalness on the same output. The set defines the comparison; running it is a separate, budgeted task.

## How to run a comparison

1. Fix the conditions and write them down next to the outputs: agy version (`agy --version`), model tier, tool list, plugin scope, and the exact prompt text. Both arms use the same values.
2. Baseline arm: a fresh conversation in a workspace where LitGravity is disabled or absent, so the skill, its references, rules, fixtures and examples are out of reach. Check this before the first prompt: the activation note must be missing and `.litgravity/ledger/` must stay empty. Give the model only the prompt.
3. Skill arm: a separate fresh conversation with LitGravity enabled; start each prompt with `lit humanize` so the route activates and the skill file is read. Keep the baseline output out of this conversation.
4. Headless runs use `agy -p "<prompt>" --output-format json < /dev/null`, one call per prompt per arm, twenty calls in total. Each call costs quota, so stop at the budget the plan sets and record where you stopped.
5. Save both raw outputs as files under `.litgravity/evidence/humanizer-bench/<arm>/<nn>.md` before any edit. Run the same detector version on each (`node <skill-folder>/scripts/detect.mjs --json <file>`) and record block and warn counts per prompt.
6. Fidelity check per pair: every date, count, condition, command and named pending item in the prompt appears in the output with the same value. A missing or altered fact fails that output, whatever its detector score.
7. Blind preference: strip arm names, shuffle each pair, and ask the user which reads more naturally while keeping the facts. Show detector counts only after the pick. A detector difference alone decides nothing; the reader's pick and the fidelity check carry the result.

## Prompts

### 1. English status update

```text
Write a 150–200 word update for the head of facilities. The east wing heating was replaced between October 6 and October 17, 2026. All 22 rooms passed the contractor's pressure test. The building inspector's sign-off is still pending; the inspection is booked for November 3. Keep the completed work and the pending sign-off clearly apart and add no results that are not listed here.
```

### 2. Korean status update

```text
시설팀장에게 보낼 150~200자 진행 보고를 써 주세요. 동관 난방 설비는 2026년 10월 6일부터 17일까지 교체했습니다. 22개 실이 모두 시공사 압력 시험을 통과했습니다. 건축 검사관의 승인은 아직 나지 않았고 검사는 11월 3일로 잡혀 있습니다. 끝난 일과 남은 승인을 나눠 쓰고, 여기 없는 결과는 덧붙이지 마세요.
```

### 3. English slide text

```text
Write text for three slides announcing new library hours. From November 1 the main branch opens 9:00–20:00 on weekdays and 10:00–17:00 on Saturdays. The two neighbourhood branches keep their current hours. Returns can be dropped in the outdoor box at any time; items dropped after closing are checked in the next opening day. Use short slide language and keep every time and condition.
```

### 4. Korean slide text

```text
도서관 운영 시간 변경 안내 슬라이드 세 장의 문안을 써 주세요. 11월 1일부터 본관은 평일 9시~20시, 토요일 10시~17시에 문을 엽니다. 분관 두 곳은 지금 시간을 그대로 유지합니다. 반납은 외부 무인 반납함에 언제든 할 수 있고, 마감 뒤 넣은 자료는 다음 개관일에 반납 처리됩니다. 시간과 조건을 모두 살려 주세요.
```

### 5. English commit message

```text
Write one commit subject line and, if useful, a short body. The change renames the config key `retryLimit` to `maxRetries` in the sample config and in the docs page that describes it. The code already accepted both names. Describe only the change; make no claim about tests having run.
```

### 6. Korean commit message

```text
커밋 제목 한 줄과 필요하면 짧은 본문을 써 주세요. 예시 설정 파일과 설정 문서에서 `retryLimit` 키 이름을 `maxRetries`로 바꿨습니다. 코드는 원래 두 이름을 모두 받았습니다. 변경 내용만 쓰고, 테스트를 돌렸다는 말은 넣지 마세요.
```

### 7. English pull request

```text
Draft a short pull request description. The patch splits the monthly usage export into two columns: active accounts and accounts created this month. Previously one column mixed both. The export file name and the schedule did not change. State the change and what reviewers should look at; add no claims about validation.
```

### 8. Korean pull request

```text
짧은 PR 설명을 써 주세요. 월간 사용량 내보내기에서 한 열에 섞여 있던 값을 '활성 계정'과 '이번 달 신규 계정' 두 열로 나눴습니다. 내보내기 파일 이름과 일정은 그대로입니다. 바뀐 점과 리뷰어가 볼 부분을 쓰고, 검증했다는 주장은 붙이지 마세요.
```

### 9. English README section

```text
Write a short "Getting started" section for a Python command-line tool. It needs Python 3.11 or later. The user runs `python -m venv .venv`, activates it, then `pip install -e .`, then `mytool --help`. These are the documented steps; no test results are given. Use a heading and keep the commands exactly as written.
```

### 10. Korean README section

```text
Python 명령줄 도구의 '시작하기' 절을 짧게 써 주세요. Python 3.11 이상이 필요합니다. 사용자는 `python -m venv .venv`로 가상 환경을 만들고 활성화한 뒤 `pip install -e .`, 이어서 `mytool --help`를 실행합니다. 문서에 적힌 절차이며 테스트 결과는 주어지지 않았습니다. 제목을 달고 명령어는 그대로 두세요.
```

## Reading the result

- Per prompt, record: fidelity pass or fail with the missing fact, block count, warn count, and the blind pick.
- Summarise by genre and language. A skill-arm win needs fidelity in both arms and the reader's preference; a lower detector count with a lost fact counts as a loss.
- Keep raw outputs, the condition record and the pick sheet together in the evidence folder so the comparison can be repeated on a later agy build.

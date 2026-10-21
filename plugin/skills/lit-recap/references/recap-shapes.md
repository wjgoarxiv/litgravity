# lit-recap: report shapes per situation

Every recap has the same frame: three reader lines (result, risk, required action), then the fixed LitFamily headers in their fixed order. What changes with the situation is what goes first inside that frame and how much detail each section carries. The examples below use a neutral project (a reporting CLI with a CSV export flag) and invented paths. Copy the shape and fill it from the sources you actually read; an example path is a pattern to follow, and the facts come from disk.

The section headers are byte-for-byte:

```text
# 작업 리캡 (lit-recap)
## ✅ 완료된 작업
## 🔄 진행 중
## ⛔ 블로커
## 📁 증거 경로
## ➡️ 다음 단계
```

The brief shape uses `## ⚡ 요약` alone.

## 1. Mid-loop: a goal with criteria in progress

The most common case. Lead with the counts; list criteria by status.

```markdown
결과: 목표 `csv-export` 진행 중, 기준 2/4 통과 (lit-loop, 마지막 기록 2026-10-20 10:12)
위험: 없음
필요한 조치: 없음

# 작업 리캡 (lit-recap)

## ✅ 완료된 작업
- [CLI] c1 `report export --csv out.csv` 종료 코드 0, 첫 줄이 헤더 - 근거: .litgravity/evidence/csv-export/c1-surface.log
- [test] c2 쉼표 포함 값 인용 처리 - 근거: .litgravity/evidence/csv-export/c2-green.log

## 🔄 진행 중
- [test] c3 빈 테이블 내보내기 - RED 로그만 있음, 다음 체크포인트: c3-green.log
- [CLI] c4 잘못된 경로 오류 메시지 - 미착수

## ⛔ 블로커
- 없음

## 📁 증거 경로
- .litgravity/evidence/csv-export/c1-surface.log (수정 2026-10-20 09:31)
- .litgravity/evidence/csv-export/c3-red.log (수정 2026-10-20 10:05)

## ➡️ 다음 단계
1. [test] c3 최소 수정 후 `npm test -- export.empty` 로 GREEN 확인
2. [CLI] c4 RED 작성 - `report export --csv /nonexistent/out.csv`
```

## 2. Plan run: `start-work` on an approved plan

Lead with `checked/total` and the first open row, since that is where `lit start` resumes.

```markdown
결과: 계획 `plans/csv-export.md` 4/7행 완료, 5행 "빈 테이블 처리"부터 남음
위험: 없음
필요한 조치: 없음
```

Under 진행 중, the first open row with its number and title; under 다음 단계, `lit start` or a bare `lit` (which resumes a started plan) and the row's own verification command.

## 3. Blocked or paused

Lead with the blocker. Quote the release note verbatim; it is short and it is the user's own record.

```markdown
결과: 목표 `csv-export` 중단됨, 기준 3/4 통과
위험: c4가 막혀 있습니다 - "BLOCKED at row 6: 배포 서버 접근 권한 없음"
필요한 조치: 배포 서버 읽기 권한을 주거나 c4를 범위에서 빼는 결정이 필요합니다
```

The 블로커 section names the cause and the one decision or access that clears it. When several blockers exist, order them by what unblocks the most work.

## 4. Contradiction

Lead with the contradiction, and let the verdict be FAIL.

```markdown
결과: 상태 불일치 2건
위험: 목표 `csv-export`는 done인데 `plans/csv-export.md` 6, 7행이 열려 있습니다
필요한 조치: `lit goal check csv-export` 로 기록을 다시 확인하세요
```

Every contradiction appears in 블로커 with both sides named. Items whose proof is missing move from ✅ to 🔄 with "주장됨, 증거 없음".

## 5. Returning after a handoff

A new conversation, the SessionStart note pointed at `.litgravity/handoff/latest.md`. Lead with what changed since the handoff.

```markdown
결과: 2026-10-19 handoff 이후 커밋 2개, 미커밋 변경 3개 파일
위험: handoff의 "작업 트리 깨끗함"은 더 이상 사실이 아닙니다
필요한 조치: 없음
```

Under 진행 중, a "handoff 이후" sub-list with commits (hash and subject) and changed files. Handoff claims that git or the record confirms move to ✅ with their evidence; the rest keep their `[UNVERIFIED]` tag as `미검증`.

## 6. Team run

Lead with the member count and how many reported.

```markdown
결과: 팀 `docs-sweep` 멤버 3명 중 2명 보고 완료
위험: `lane-api` 보고는 테스트 통과를 주장하지만 증거 파일이 없습니다
필요한 조치: 없음
```

One ✅ or 🔄 line per member, tagged with the lane name; a member's report is quoted as "보고: …" until an evidence file confirms it.

## 7. Nothing on disk, work only in this conversation

```markdown
결과: .litgravity/ 상태가 없어 이번 대화 내용만으로 정리했습니다
위험: 없음
필요한 조치: 이어서 할 작업이면 `lit handoff` 로 파일을 남기세요
```

Cite "이번 대화" as the evidence for each item, with the command or file that showed it.

## 8. Nothing to recap

Verdict BLOCKED. Every section reads `- 없음`.

```markdown
결과: 정리할 작업이 없습니다 (.litgravity/, plans/, 이번 대화 작업 모두 없음)
위험: 없음
필요한 조치: 목표를 정하려면 `lit goal`, 계획부터 세우려면 `lit plan`
```

## 9. Something still running

A long command or a child agent is still at work. Say that first; a running suite is unfinished.

```markdown
결과: 전체 테스트가 아직 실행 중입니다 (시작 10:20, 마지막 출력 "# pass 212")
위험: 실행이 끝나기 전에는 c4를 통과로 볼 수 없습니다
필요한 조치: 없음
```

## English mode

`--en`, `--english` or an English request: the three reader lines start with `Result:`, `Risk:`, `Action needed:` and the prose is English. The six section headers stay in Korean exactly as above. Technical tokens never change.

```markdown
Result: goal `csv-export` in progress, 2/4 criteria pass
Risk: none
Action needed: none

# 작업 리캡 (lit-recap)

## ✅ 완료된 작업
- [CLI] c1 `report export --csv out.csv` exits 0 and writes the header row - evidence: .litgravity/evidence/csv-export/c1-surface.log
```

## Brief mode

Five lines at most; the same truth in fewer words.

```markdown
## ⚡ 요약
- 완료 2건 / 진행 2건 / 블로커 0건 - 위험 없음
- 다음: c3 GREEN (`npm test -- export.empty`)
```

## Length

A full recap fits one screen: about 15 to 35 lines. When the state is larger (many goals, a long team run), keep one line per goal or member and offer `lit handoff` for the full picture. The user should find the next step without scrolling.

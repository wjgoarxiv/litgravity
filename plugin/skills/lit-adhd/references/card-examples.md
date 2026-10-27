# lit-adhd brief examples

The collector draws both briefs from the same records (`rewind.mjs --brief --lang en|ko`); the model prints them as they are. Ids, gauges, titles and names come from the records; only the connecting words change with the language. Here nothing runs on `go`, so the box recommends the session that waits on the user, and the last line says the step does not run on its own. Ended sessions fold into the table; the litgoal source was missing, so the brief names it once at the end.

## English

````markdown
## 🧭 5 sessions · 1 waits on you · 1 active
**Done so far:** 2 commits
**Doing now:** `f06fb727` lit pptx quarterly review deck
**Next:** Answer 655f39d3 in shop: “Should I also cap them at three?”
*last 7d · 2 folders read*

### 🌿 `feat/checkout` · shop

> 🟠 **WAITING ON YOU** · it asked you something · `655f39d3` · 3m ago  
> **lit loop checkout retries**  
> 📊 `[▉▉▉░░] 3/5` → cap retries, write the test  
> ✅ Done: wrote `pay.mjs`, `retry.mjs` · 1 commit: `bdea372` feat(pay): retry a declined card once  
> ▶ Next: answer: “Should I also cap them at three?”

> 🟢 **ACTIVE** · `f06fb727` · 1m ago · **this conversation**  
> **lit pptx quarterly review deck**  
> ⏳ 2h 19m of work · last ask: “lit pptx quarterly review deck”  
> ✅ Done: no writes yet; used `read_file`, `run_command`  
> ▶ Next: now: `run_command`

### ⚪ Ended · 3

| id | where | goal | ago | done |
|---|---|---|---|---|
| `2fad84a7` | shop-docs | lit pid dosing skid | 14h | wrote 2 |
| `0db867f0` | shop | lit plan refund flow | 26h | 1 commit |
| `c6ece9f8` | shop | lit brainstorm loyalty points | 3d | · |

### 🗺️ Roadmap

- ✓ 10-25 10:00 · `feat/checkout` docs(plan): refund flow
- ✓ 10-26 11:30 · `feat/checkout` feat(pay): retry a declined card once
- ▶ now · `shop-docs` `plans/refund.md` `[▉░░░] 1/4` → Refund API route
  - ○ later · Ledger entry
  - ○ later · Email receipt

```
╭─ RECOMMENDED NEXT STEP ─────────────────────────────────────
│ Answer 655f39d3 in shop: “Should I also cap them at three?”
╰─────────────────────────────────────────────────────────────
```

Nothing runs on its own here: open that conversation, or say what to do.

*Not read: litgoal.*
````

## Korean

````markdown
## 🧭 세션 5개 · 나를 기다리는 것 1 · 진행 중 1
**지금까지 한 일:** 커밋 2개
**지금 하는 일:** `f06fb727` lit pptx quarterly review deck
**다음:** shop의 655f39d3에 답하기: “Should I also cap them at three?”
*최근 7d · 폴더 2곳 읽음*

### 🌿 `feat/checkout` · shop

> 🟠 **나를 기다림** · 질문하고 기다림 · `655f39d3` · 3분 전  
> **lit loop checkout retries**  
> 📊 `[▉▉▉░░] 3/5` → cap retries, write the test  
> ✅ 한 일: 씀 `pay.mjs`, `retry.mjs` · 커밋 1개: `bdea372` feat(pay): retry a declined card once  
> ▶ 다음: 답하기: “Should I also cap them at three?”

> 🟢 **진행 중** · `f06fb727` · 1분 전 · **이 대화**  
> **lit pptx quarterly review deck**  
> ⏳ 2시간 19분 작업 · 마지막 요청: “lit pptx quarterly review deck”  
> ✅ 한 일: 아직 쓰기 없음, 쓴 도구 `read_file`, `run_command`  
> ▶ 다음: 지금: `run_command`

### ⚪ 끝난 세션 · 3

| id | 위치 | 목표 | 경과 | 한 일 |
|---|---|---|---|---|
| `2fad84a7` | shop-docs | lit pid dosing skid | 14시간 | 씀 2 |
| `0db867f0` | shop | lit plan refund flow | 26시간 | 커밋 1개 |
| `c6ece9f8` | shop | lit brainstorm loyalty points | 3일 | · |

### 🗺️ 로드맵

- ✓ 10-25 10:00 · `feat/checkout` docs(plan): refund flow
- ✓ 10-26 11:30 · `feat/checkout` feat(pay): retry a declined card once
- ▶ 지금 · `shop-docs` `plans/refund.md` `[▉░░░] 1/4` → Refund API route
  - ○ 나중 · Ledger entry
  - ○ 나중 · Email receipt

```
╭─ 추천 다음 단계 ─────────────────────────────────────────────
│ shop의 655f39d3에 답하기: “Should I also cap them at three?”
╰──────────────────────────────────────────────────────────────
```

저절로 실행되는 단계는 아닙니다. 그 대화를 열거나 할 일을 말해 주세요.

*읽지 못함: litgoal.*
````

## When a step runs on `go`

When `next` holds a step (here, one open plan and no work running), the box names it, the command it runs and the word to type, and the last line reads "Type **`go`** to continue." / "**`go`** 라고 입력하면 이어갑니다."

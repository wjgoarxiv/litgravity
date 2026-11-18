# lit-adhd: the KPI board and the detail view (`lit adhd detail`)

The verdict card is the default answer. This page describes what `--detail` prints instead: the KPI board the card replaced as the default, with the per-session brief under it. Every rule here still holds for that view.

## The board

The collector draws a KPI board in Markdown (`plugin/hooks/lib/rewind/board.mjs`), because agy's chat pane renders headings, bold, tables and lists; the shape is the same every time, so a tired reader finds each part where it was last time and knows in ten seconds what to do now, what is done, what is left and what not to forget. With `--detail`, six sections, in this fixed order (Korean labels with `--lang ko`):

| Section | Korean | What it holds |
| --- | --- | --- |
| `## 🎯 Do this now` | `## 🎯 지금 할 일` | One action in bold, one reason after the dash, then the exact text to type (`👉 Type: \`go\``, `👉 입력: \`lit continue\``), the command to type (`lit start plans/<plan>.md`), or what to wait for (`👉 기다리기: 레인 2개가 끝날 때까지`). |
| `## 📊 At a glance` | `## 📊 한눈에 보기` | Four buckets in one table (✅ done, 🔄 in progress, ⏳ waiting on you, ⬜ left), then `Overall  ██████░░░░  5/8 (63%)`. |
| `## 🏁 Milestones` | `## 🏁 마일스톤` | One row per plan, litgoal goal or start-work run: plain name, bucket, ten-cell bar with `k/n`, how recently it moved. Four rows at most; past that, three and a `…and N more` row. |
| `## ✅ Done lately` | `## ✅ 최근 끝낸 일` | Up to five finished runs and ticked rows, newest plan first, each as `row (milestone)`. |
| `## ⬜ Still to do` | `## ⬜ 남은 일` | Up to seven unticked rows numbered in plan order, the current milestone first, then `…and N more` (`…외 N개`). |
| `## 🔔 Don't forget` | `## 🔔 잊지 말 것` | Up to five reminders shaped `thing → what to do`, most urgent first. |

How the collector fills it (`buildBoard`, kept in the JSON as `board`; the ready text is `boardText`):

- **Buckets.** Every task lands in exactly one: ticked rows and passed criteria are ✅; the next open row of a milestone that has started is 🔄 (⏳ when its start-work run is paused); every other open row is ⬜; each conversation that waits on the user (it asked something, or holds a paused route) is one ⏳ task unless its paused run is already a waiting milestone. The four counts add up to the overall total. A milestone is ✅ when every row is ticked, ⏳ when its run is paused, 🔄 when a run is open or some rows are ticked, else ⬜.
- **Bars.** Ten cells of `█` and `░` plus `k/n`; a partial count never rounds to an empty or full bar, and a percentage never reads 0 % or 100 % before it is true. No bar without a real total: the cell shows `·`.
- **Do this now** keeps the next-step priority below and the `go` record unchanged; only the wording is plain. While other lanes work it says what to wait for, never `go`.
- **Reminders**, in this order and capped at five: conversations waiting on the user (with the question they asked, or the paused route and `lit continue`), uncommitted changes and commits not on the upstream per worktree (read with `git --no-optional-locks`, so nothing is locked or written), lanes still working (do not type `go` until they finish), open plans untouched for seven days or more (resume or drop), and the newest handoff's open `## Next` item when it is not already the step. Nothing else: a reminder the records do not support is never drawn.
- **Plain words only.** The board names conversations by their folder and plans by their `# ` heading (else the file name without date and dashes). It never shows a conversation id, a commit hash, a raw status code such as `waiting-on-user`, a plan path, or a file path, except inside a command the reader types.
- **Empty sections** print one plain line (`Nothing left` / `남은 일이 없어요`); with every list at its cap the board is about forty lines. A source that could not be read, or a read budget that ran out, is named once on one line under the board.

**Detail view (on request).** With `--detail` the per-session brief (`plugin/hooks/lib/rewind/brief.mjs`) is drawn under the board, unchanged. It is not shown by default. Five parts, in this order:

1. **Headline and opener.** One `## 🧭` line: conversations found, how many wait on the user, how many are active (`세션 5개 · 나를 기다리는 것 1 · 진행 중 1` / `5 sessions · 1 waits on you · 1 active`). Three lines follow for a reader who reads nothing else: **Done so far** (finished plans here, sessions done, commits in the window), **Doing now** (up to two active conversations by id and goal) and **Next** (the step in the box). A dim line under them gives the window and how many folders were read.
2. **Live cards, grouped by folder and branch.** Conversations that wait on the user, are active, idle or done get a `### 🌿 branch · folder` heading per group and one quoted card each: a status badge (🟠 waiting on you, 🟢 active, 💤 idle, ✅ done; see `references/status-taxonomy.md`) with why it waits, its `id8`, its route, how long ago it moved and `this conversation` / `이 대화`; the goal in bold; a real gauge with the next items, or the known facts after ⏳ (how long it ran, its last ask); ✅ what was written and committed, or before any write the tools it used most; ▶ what is next for it (answer its question, resume its paused route, its route stage, or its last tool call by base name, never a command line).
3. **Ended conversations, one table row each** (`### ⚪ Ended · N`: id, where, goal, ago, done), at most eight and a count of the rest. Each row fits on one line at 120 columns: the age is its largest unit and done is a commit count or a file count.
4. **Roadmap timeline** (`### 🗺️`, with this folder's gauge): ✓ commits with their dates and branch, ▶ the current item of each open plan changed inside the window, here or in another folder (with its folder name), ○ the items after it, then litgoal objectives. Plans are held to the window here too. Unfilled plan scaffolds and files without task rows are skipped and counted on the last line; another folder's finished plans and objectives are left out.
5. **One recommended next step** in a box (an untagged code fence), then one line. A step that runs on `go` shows its command and the word to type, and the line says "Type `go` to continue." When nothing runs on `go`, the box still recommends a real step from the records, in this order: a conversation waiting on the user, a paused route, an open plan item (a live conversation's folder first), the newest other active conversation, the first open item under `## Next` in this folder's newest `HANDOFF*.md` (items marked ✅, ✓, `[x]`, ~~struck~~, DONE or SHIPPED are skipped), the newest ended one; the line then says nothing runs on its own. When other lanes work, a plan start is held: the box says to answer the lane waiting on you or to wait for the N lanes, and the line says "Do not type `go` until they finish." (Korean: "지금은 `go`는 입력하지 마세요.").

**Progress gauges (D9).** A board bar or a detail gauge appears only when the collector provides both done and total as real integers: `██████░░░░ 5/8` on the board, `[▉▉▉░░] 3/5` in the detail. When the total is unknown, the card shows known facts in words instead (`⏳ 2h 19m of work · last ask: …`). Never show `?/?`, `[???]`, `k/?` or any question-mark placeholder. The gauge is the progress; do not compute progress from prose like "about halfway".


## Status taxonomy (detail cards)

- `waiting-on-user`: the session's last word was the model asking something, or it holds a paused workflow frame.
- `done`: its start-work frame names a plan with every row ticked.
- `active`: its liveness record says `alive`, or, without one, it was written to within the last 15 minutes.
- `idle`: its liveness record says `idle`: the last turn ended and the conversation waits for its next prompt.
- `ended`: quiet past the transcript clock, or a liveness record left alone past its limit (agy fires no session-end event).
- `unknown`: the transcript held no timestamp.

Sessions waiting on the user come first, then active, idle, done and ended ones, newest first.


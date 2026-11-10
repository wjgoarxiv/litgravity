# lit-adhd status taxonomy

The collector assigns every session exactly one status. The brief renders it in the user's language.

| Status | Set when | English | Korean | Board |
| --- | --- | --- | --- | --- |
| `waiting-on-user` | The session's last word is the model asking something, or it holds a paused workflow frame | waiting on you | 나를 기다림 | one ⏳ task and a ⏳ reminder (the question, or `lit continue` for the paused route) |
| `done` | Its start-work frame names a plan with every row ticked | done | 완료 | a ✅ "finished the run" line under Done lately |
| `active` | Its liveness record says `alive`; without one, a transcript write within the last 15 minutes | active | 진행 중 | a lane that holds `go`; a 🏃 reminder while it works |
| `idle` | Its liveness record says `idle`: the turn ended and it waits for the next prompt | idle | 쉬는 중 | not counted |
| `ended` | Quiet for longer than 15 minutes, or a liveness record past its limit (10 minutes alive, 2 hours idle) | ended | 끝남 | not counted |
| `unknown` | The transcript held no timestamp | unknown | 모름 | not counted |

The board never prints these codes. It maps everything into four buckets:

| Bucket | English | Korean | Holds |
| --- | --- | --- | --- |
| ✅ | Done | 끝남 | ticked plan rows, passed litgoal criteria, finished milestones |
| 🔄 | In progress | 진행 중 | the next open row of a milestone that has started (a run is open or some rows are ticked) |
| ⏳ | Waiting on you | 나를 기다림 | the next open row of a milestone whose start-work run is paused, and each conversation waiting on the user |
| ⬜ | Left | 남음 | every other open row or criterion, and a milestone nothing has started |

## Sources

Each `sources` entry is `ok` or `unknown`. An unknown source is named once on the line under the board (and on the detail brief's last line).

| Key | Source |
| --- | --- |
| `transcripts` | `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` for the lit conversations of this workspace (ids from its route-state folder) |
| `plans` | `plans/*.md` checkbox rows |
| `litgoal` | `.litgravity/goals/active.json` |
| `handoffs` | `HANDOFF*.md` headings and the first item under `## Next` |
| `git` | `git log --since` |
| `workflowStack` | Route-state `*.stack.json` files |

## Next-step kinds

| `next.kind` | Say | Meaning |
| --- | --- | --- |
| `resume-frame` | `lit continue` | resume the paused discipline |
| `continue-work` | `go` | keep running the plan |
| `start-plan` | `go` | start the single open plan |
| `none` | -- | no next step on record |

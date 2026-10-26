# lit-adhd status taxonomy

The collector assigns every session exactly one status. The brief renders it in the user's language.

| Status | Set when | English | Korean |
| --- | --- | --- | --- |
| `waiting-on-user` | The session's last word is the model asking something, or it holds a paused workflow frame | waiting on you | 나를 기다림 |
| `active` | A transcript write within the last 15 minutes and not waiting | active | 진행 중 |
| `ended` | Quiet for longer than 15 minutes | ended | 끝남 |
| `unknown` | The transcript held no timestamp | unknown | 모름 |

## Sources

Each `sources` entry is `ok` or `unknown`. An unknown source is named on the brief's last line.

| Key | Source |
| --- | --- |
| `transcripts` | `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` for the lit conversations of this workspace (ids from its route-state folder) |
| `plans` | `plans/*.md` checkbox rows |
| `litgoal` | `.litgravity/goals/active.json` |
| `handoffs` | `HANDOFF*.md` headings |
| `git` | `git log --since` |
| `workflowStack` | Route-state `*.stack.json` files |

## Next-step kinds

| `next.kind` | Say | Meaning |
| --- | --- | --- |
| `resume-frame` | `lit continue` | resume the paused discipline |
| `continue-work` | `go` | keep running the plan |
| `start-plan` | `go` | start the single open plan |
| `none` | -- | no next step on record |

# lit-loop: ledger lines, goal record fields and the resume checklist

This file is the exact vocabulary the loop writes down. Use it when a conversation is long, when you hand work to another agent, or when you pick work up after a restart. Everything here lives under `.litgravity/` in the workspace; nothing in it is route state (the hooks keep that elsewhere and tools cannot write it).

## Ledger lines

The ledger is one JSON object per line in `.litgravity/ledger/<conversation-id>.jsonl`. The hooks append `route` and `tool` lines on their own. The loop adds three kinds by hand with `run_command` (`printf '%s\n' '<json>' >> <file>`) or by rewriting the file through `write_file` when the host will not let a shell append:

```json
{"ts":"2026-10-20T09:14:00Z","kind":"note","text":"gates: npm test; npm run lint; npm run check:version","path":"package.json"}
{"ts":"2026-10-20T09:31:00Z","kind":"evidence","text":"c1 pass (red, green, surface, cleanup)","path":".litgravity/evidence/csv-export-flag/c1-surface.log"}
{"ts":"2026-10-20T09:40:00Z","kind":"decision","text":"c2 text narrowed with the user's agreement: quoting of commas only","path":".litgravity/goals/csv-export-flag.json"}
```

- `note`: facts the next reader needs and nothing else (gate commands, what was stopped, why a hold was released). A note that starts `BLOCKED at row N:`, `PAUSED at row N:` or `CANCELLED:` releases the Stop hook's continuation hold; any later `evidence` or `decision` line re-arms it.
- `evidence`: one line each time a criterion moves to `pass`, and one after every `check` of a goal record (`pass/total`, demotions).
- `decision`: a settled fork, a changed criterion text, a refused steering request, a skipped class with its reason, an answer the user gave.
- `path` is repo-relative. Keep text under about 240 characters; the evidence file holds the detail.

Never put a secret in a ledger line. The hooks redact common key shapes from their own lines, and your lines get no such help.

## Goal record fields the loop touches

`litgoal` owns the schema; the loop reads and updates these fields and nothing else:

| Field | Loop's use |
| --- | --- |
| `slug`, `objective` | read once at bootstrap; never edited by the loop |
| `criteria[].id`, `.text` | the work list; text changes only with the user's agreement and a `decision` line |
| `criteria[].status` | `open` to `pass`, `fail` or `blocked`; leftover live state means `blocked` |
| `criteria[].attempt` | bumped when a failed or blocked criterion goes back to `open`; new artifacts from attempt 2 carry an `-a<attempt>` suffix |
| `criteria[].evidence` | repo-relative paths, never absolute |
| `status` | `active` while work remains; `done` only after the close gate |
| `updated` | refreshed on every write; it is also what the Stop hook reads as progress |

Whole-file writes only, after re-reading the file. A child never writes the record.

## Resume checklist

Use it after a compaction, a restart, or a handoff from another agent. Do not skip a step because the summary you were handed sounds complete.

1. `git status` and the last `git log --oneline` lines: what changed since the record was last updated, and which dirty files are not yours.
2. Read the goal record, then the tail of the ledger (the last 30 lines are enough). Note any `BLOCKED`, `PAUSED` or `CANCELLED` note.
3. For every criterion marked `pass`, open the evidence it names. A path that is missing, or a log that shows a failure, demotes the criterion to `open` with a `note`.
4. List live resources the earlier run may have left: processes, ports, tmux sessions, browser contexts, temp directories. Decide for each whether this run owns it, and clean what is yours.
5. Re-run the failing check of the first non-pass criterion before touching code. A failure that no longer reproduces is a finding, and it goes into the ledger before you continue.
6. Continue with the per-criterion loop. The first reply of the resumed run says which criterion it resumes at.

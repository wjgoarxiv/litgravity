# lit-plan: the Done when check and the goal question

A plan says when it is done in a form a machine can check. lit-plan asks once, at approval, whether to start the work
and arm that check as the goal, and only the user's exact `yes` does both. This page is the whole path, from the block in the plan to the line
that clears the goal.

## The block in the plan

```markdown
## Done when
- check: `npm test`
```

One `check:` line, one command in backticks. The command must exit 0 only when the work is done. It is one of these:

| Allowed | Example |
| --- | --- |
| npm scripts | `npm test`, `npm run check:all` |
| node's test runner or a node script in the project | `node --test test/list.test.js`, `node scripts/<check>.mjs` |
| pnpm / yarn scripts | `pnpm test`, `yarn run verify` |
| pytest | `pytest tests/test_export.py`, `python3 -m pytest` |
| cargo / go tests | `cargo test`, `go test ./...` |
| make targets | `make test`, `make check`, `make verify` |
| a shell script under `scripts/` | `bash scripts/<check>.sh` |

A long plan whose finish line needs several commands points the check at one script under `scripts/` and makes writing
that script a row. A script the plan creates may be missing today; that counts as "false now", not as broken.

## What goal-propose does

`node <skill-root>/scripts/goal-propose.mjs plans/<slug>.md`, run once from the workspace root after the self-check:

1. **Compile.** `Every row in plans/<slug>.md is ticked and \`<cmd>\` exits 0 [lit:<id>]`, where `<id>` is eight hex
   characters over the plan path and the command. Over 500 characters: skipped, with the reason "point the check at one
   script".
2. **Lint.** Judgment words cannot be checked and are refused (works, looks good, properly, as expected, 잘 동작,
   괜찮, 제대로 and the like). A success that is only an outward action (push, publish, tag, release, merge) is refused.
   A command outside the table above is refused.
3. **Falsify.** The command runs once, without a shell, time-boxed at two minutes, with its output discarded. The goal
   must be false today: open rows, or a failing check. Already true, hanging or unrunnable: no goal, with that reason.
4. **Ask.** On success it writes `.litgravity/goal/consent.json` (condition, its hash, plan, command, time) and prints
   `Approve plan, start work and set goal: /goal <cond>? (yes / edit / no)`. When steps 1-3 refuse the goal, it writes
   a goal-less consent record and prints `No goal for this plan: <reason>.` and `Approve plan and start work? (yes / no)`.
   An unreadable plan prints `Goal skipped: <reason>.` and writes nothing.

Under the question it prints a blank line and an answer guide, a Markdown quote built from the same answers as the
question: a `▶ Answer` heading, the goal as `/goal <cond>` (none on a start-only question), a `Type | What happens`
table with one row per answer (`yes`, `edit`, `no`, or `yes` and `no`) and the closing line `Type the word alone.`

End the reply that asks for approval with both: the question line unchanged, then the answer guide right under it.
Do not reword the question line, and do not answer it yourself. Render the guide's heading, effects and closing line in
the user's language; the answer words stay the exact English `yes`, `edit` and `no`, since only those are answers.

## The answer

The PreInvocation hook reads the user's next prompt:

| Typed (whole prompt) | Effect |
| --- | --- |
| `yes` | The hook starts start-work on the plan (the same writes `lit start plans/<slug>.md` makes: route, boundary snapshot, stack frame) and arms the goal: `.litgravity/goal/owner.json` records that LitGravity owns this condition. The reply says, verbatim: `Goal armed by LitGravity: <cond>. agy's own goal is not confirmed (a hook cannot type it). Paste: /goal <cond>`. A goal-less question says `Plan approved: start-work runs <plan> now. No goal is set.` |
| `yes`, start refused | The plan is gone, has no open row, or this conversation already runs start-work: nothing starts and no goal is armed: `Plan not started and no goal set: <reason>.` |
| `edit` | Nothing starts and nothing is armed; the question comes back with a note to edit first |
| `no` | `Nothing started and no goal set: you answered no.` |
| anything else, or silence | Not an answer; nothing starts, and after 30 minutes the question expires |

Only an exact `yes` to a live question (its hash still matching the asked condition) starts and arms. agy's own `/goal` lives in
its interactive prompt, and a hook can inject text or decide a tool call but cannot type a slash command, so the user
pastes that one line if they also want agy's goal. LitGravity's own check runs either way.

## While it is armed

At every normal turn end the Stop hook checks the owned goal as an advisory: when every row of the plan is ticked it
runs the command (at most 7 seconds, the hook's own limit). Exit 0 clears `owner.json` and holds the turn once so the
reply carries `Goal met and cleared: <cond>. If you pasted it into agy and it still shows, type /goal clear.` A slower
check is reported as unfinished and the goal stays.

`lit cancel` clears an owned goal (`Goal cleared by lit cancel: <cond>. …`). A goal the user set by hand in agy is out
of reach and is never touched. A new conversation's SessionStart drops a record older than seven days or whose plan is
gone, and says so once. A second plan's `yes` while another owned goal is active leaves the first in place and says
`A goal is already active (<cond>); LitGravity left it as it is.`

Only lit-plan's question can start a run this way or arm a goal. Read-only skills (lit-adhd, review-work, litresearch, the brainstorms,
lit-crucible, deep-interview and the others in `GOAL_NEVER` in `plugin/hooks/lib/routes.mjs`) never do.

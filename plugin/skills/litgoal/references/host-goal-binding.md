# litgoal: agy's own /goal and the record

The record in `.litgravity/goals/<slug>.json` decides what is true. agy 1.5.10 also has a goal of its own: the `/goal`
command in its interactive prompt, which keeps a conversation working until a condition holds. It is the user's
command. A LitGravity hook can inject text or decide a tool call and cannot type a slash command, and the model is
given no goal tool to call, so this skill never sets, reads or clears agy's goal.

What has been observed, and what has not:

- Observed: the record, the ledger and the Stop-hook hold work on every agy build the product was probed on (1.4.3 to
  1.5.10). `/goal` exists in the interactive prompt (agy's changelog: no run limit, cancelled at a fork point) and is
  absent from print mode's command list.
- Not observed: whether a met agy goal clears itself, and what the transcript records for one. Nothing here depends on
  either.

## How the two meet

| Situation | What happens | `host_goal.state` |
| --- | --- | --- |
| A plan's `## Done when` check was armed with the user's `yes` | lit-plan's goal question (`../lit-plan/references/goal-condition.md`) gave the user one line to paste, `/goal <cond>`; LitGravity's Stop hook checks the same condition at every turn end | `paste` once the user says they pasted it, else `unavailable` |
| The user set an agy goal by hand | It is theirs. Mention it once if its objective differs from the record's, and change nothing | `unavailable` |
| No agy goal | The record stands alone; say nothing about agy's goal | `unavailable` |

## Rules that do not bend

- The record decides. An agy goal, met or not, is never evidence for a criterion.
- Never tell the user to clear or replace an agy goal they set themselves. When LitGravity's own advisory check clears
  an armed plan goal, its fixed line already tells the user that `/goal clear` is theirs to type.
- Never from a planning turn: `lit-plan` arms nothing itself; the user's `yes` does.

## What to tell the user, and when

- When a plan's goal is armed, the reply already carries the fixed line with `Paste: /goal <cond>`. Repeat it only if
  the user asks how to set agy's goal too.
- When the user says they pasted it, set `host_goal.state` to `paste` and `synced` to now with one record write, and
  append a `note` ledger line. Nothing else changes: the criteria still decide.
- When a criterion turns `pass` or the verdict is written, say nothing about agy's goal unless the user asks. A met
  plan goal is announced by the Stop hook's own fixed line, which also tells the user that `/goal clear` is theirs.
- When the user asks whether agy's goal is met, answer from the record and the plan's check, and say that agy's own
  indicator is not read by LitGravity.

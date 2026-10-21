# litgoal: binding the host's goal tool

The record in `.litgravity/goals/<slug>.json` decides what is true. agy may also expose a goal tool of its own (the binary names `update_goal`, and a status or percentage the interface can show). That tool is a convenience for the person watching the session: it never outranks the criteria, and the skill works the same with no goal tool at all.

What has been observed, and what has not:

- Observed: the record, the ledger and the Stop-hook hold work on every agy build the product was probed on (1.4.3).
- Not observed: the argument shapes of the host goal tool. The product ships no schema for it. When a call is rejected with a schema error, report that error verbatim, set `host_goal.state` to `unavailable`, and continue with the record alone. Guessing around the error hides the real contract.

## Binding table

Before anything else, find out what the host already holds. When the host exposes a way to read its current goal, read it once. Then:

| What the host shows | Action | `host_goal.state` |
| --- | --- | --- |
| no active goal | set one whose objective is the record's objective sentence | `created` |
| an active goal with the same objective | adopt it, create nothing | `adopted` |
| an active goal with a different objective | adopt nothing and overwrite nothing: report the conflict, keep the record, replace the host objective only on the user's explicit word | `conflict` |
| no goal tool offered, a read-only session, or a refused call | keep the record alone and say so once | `unavailable` |

## When the host goal is touched

- Once at set, as the table says.
- On each criterion change, to refresh the status word (active, blocked, complete) and the percentage (criteria passed over total), when the tool takes them.
- Once more at the verdict: complete and 100 for `met`; blocked and the real percentage for `not met`; then set `host_goal.state` to `closed`. A `conflict` or `unavailable` binding skips the call.
- Never from a planning turn. `lit-plan` creates no runtime state, so setting a goal from a planning turn waits for the next route.

## Rules that do not bend

- The record decides. `host_goal.state` never overrides what the criteria say, and a green host indicator is not evidence.
- One host goal per conversation is the assumption; a second objective for the same work layers criteria onto the existing record through steering and does not open a second host goal.
- A call that fails does not fail the goal. Write one `note` ledger line with the error text and carry on.

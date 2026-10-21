# Delegation, failure handling and interruptions

## Delegating a row to lit-executor

When agents are installed, hand rows to `lit-executor`, one row per child, through `invoke_subagent` with `TypeName` set to `lit-executor`. A child started without `TypeName` is general-purpose with every tool and no role limits, so the type is always named. The `Role` is `implementer`.

```text
TASK: Execute plan row 3 of plans/<slug>.md test first.
<row text verbatim>
DELIVERABLE: changed files; task-3-pin, task-3-red and task-3-green logs; task-3-accept artifact; DoneClaim JSON; all under .litgravity/evidence/<slug>/.
SCOPE: edit only <Files line>. Must NOT have: <list>. Other workers share this tree, so every other change stays as it is.
VERIFY: <test command> fails first, then passes; <QA scenario>.
STOP WHEN: the DoneClaim is written, or send BLOCKED: <reason>.
```

The brief is an executable assignment and holds only what the child needs. A child that inherits the whole history continues the parent's old task.

### Rules that keep delegation sound

- Parallel children need disjoint Files lines and their own worktrees (`git worktree add`). Two writers on one file is a stop-and-serialize condition.
- agy has no wait tool. Each child sends a message when it finishes, so the parent keeps doing independent root work and reads messages as they arrive. Ask long-running children to send `WORKING: <task> - <phase>` before long passes and `BLOCKED: <reason>` when progress stops.
- A quiet child is alive until the host says otherwise. After two quiet stretches, send `TASK STILL ACTIVE: return <deliverable> or BLOCKED: <reason>` with `send_message`. After four silent or acknowledgement-only replies, stop the lane by message, mark it inconclusive (never a pass) and start a smaller assignment carrying only the missing deliverable.
- Silence is no reason to start a second writer on the same files.
- A row stays unticked while a child still owns its evidence. The final report waits until every lane is closed.
- Verify the child's claim yourself: open each evidence file, rerun the decisive command and compare `git diff --name-only` with the Files line. A child's self-report is a lead.
- `qa-runner` runs long surface probes. `quality-reviewer` and `lit-verifier` review.
- With no agents installed, execute in this conversation with the same gates and write `subagent_unavailable_direct_execution` once in the ledger. Missing agents are never a reason to stop.

## Failure handling

- A failing subtask is retried with the exact error, a diagnosis and a fix instruction. After two identical failures at one gate, hand the diagnosis to `debugging` (reproduce, hypothesize, confirm the root cause, add the failing test) instead of repeating the command. After three bounded attempts, stop with `BLOCKED at row N: <reason>` and the artifacts attached.
- Compare failure signatures, not attempt counts. A materially different diagnosis or probe is a new approach. Rerunning the same command is the same attempt.
- A gate turns green by fixing the code or by stopping. Tests stay enabled, assertions stay as written, and lint or type findings get fixed at the cause.
- After compaction, a restart or repeated interruption, reread the plan, the ledger tail, the evidence folder and `git status --short` before acting. Earlier green output is stale unless its artifact still exists and names the command and an exit line.
- A dirty-tree conflict (someone else's edit overlaps a Files line) means adapt the row or stop. Leave that edit alone and show the preservation with the pre-status and post-status of those paths.

## New input mid-run

| Kind | Example | Action |
| --- | --- | --- |
| additive | "also add a help line" | queue it as an amendment; the current row finishes first |
| corrective | "use the other flag name" | stop obsolete work, keep useful artifacts, rebind the affected rows |
| replacement | "forget this, do X instead" | stop lanes, clean up, supersede the plan with `lit-plan` |
| status question | "where are we?" | answer from verified state (`next-row.mjs`, ledger) and continue |

## Scope changes and amendments

A row can turn out wrong: a missing file, a test that cannot fail, a dependency the plan missed, a Files line that is too narrow.

1. Stop at that row and leave it open.
2. State the mismatch and propose the smallest amendment: edit row N in place, add a row, or drop row N.
3. Ask with `ask_question`. A headless run describes the amendment in the reply and stops with `BLOCKED at row N`.
4. After approval apply the amendment, add an entry under `## Amendments` at the end of the plan (date, row, change, reason) and write a `decision` ledger line. Existing rows keep their numbers. An added row takes the next free number after the last implementation row, since the checker wants consecutive numbers and the Depends on line sets the order. A dropped row stays in the plan, ticked, with `(dropped by amendment)` after its title. Added rows sit at column zero with every label so the checker and the resume logic see them.

A new requirement found mid-row is recorded as a follow-up note and stays out of the row.

## Parallel waves

Rows in the same wave of the dependency matrix may run side by side when their Files lines are disjoint. Each child gets its own worktree named for the row, based on the recorded revision. The parent merges one worktree at a time into the main checkout, reruns the plan's gates after each merge and removes the worktree with a receipt. A merge conflict means the Files lines were not disjoint; stop, serialize the two rows and record a `decision` line.

## Quota discipline

Real `agy -p` calls draw on the account's quota. A row whose surface proof calls the model names the number of calls in its QA scenario, and the run stops at the plan's budget with `PAUSED at row N: model-call budget reached`.

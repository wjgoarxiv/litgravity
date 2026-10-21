# lit-plan to start-work: the handoff contract

This contract says when a plan becomes executable work and which receipts travel in each direction. Planning language grants no authority by itself, and implementation evidence has to survive a change of conversation.

## What the plan file promises

`plans/<slug>.md` follows `templates/plan.md`. `start-work` relies on these parts:

- a `Status:` header line: `approved`, `awaiting approval` or `assumptions unconfirmed`;
- task rows at column zero as `- [ ] N. <title>`, each with an indented block holding `What to do`, `Files`, `References`, `Tests`, `Acceptance`, `QA scenario`, `Depends on` and `Commit`;
- final-verifier rows `- [ ] F1.` to `- [ ] F4.` after the last implementation row;
- a Verification strategy with gate commands (and their working directory), one real-surface probe and the Goal block;
- a Bootstrap section that lists the dirty paths to leave alone and the approvals withheld;
- a DoneClaim.

`start-work` ticks a row by changing `- [ ] N.` to `- [x] N.` on that one line. The rest of the plan stays byte-for-byte as written, which keeps the resume logic (it finds the first open row) and the checker working. The Stop hook holds a `start-work` turn only for a plan whose Status is `approved`.

## Handoff decision table

| Plan state or execution condition | start-work action | Required receipt | Result |
| --- | --- | --- | --- |
| `Status: awaiting approval` or `assumptions unconfirmed` | read-only work only | plan revision and the missing approval | back to the user for the okay |
| `Status: approved`, scope clear | run the structure check, then baseline checks | plan receipt | execution opens |
| Approved, but paths drifted since planning | reconcile read-only | plan plus drift receipt | continue only if the method is unchanged |
| New work exceeds the recorded scope | stop that branch | scope-delta receipt | ask for authority |
| A dirty file overlaps a planned edit | preserve it and inspect | baseline diff receipt | adapt the row or stop |
| Focused RED reproduces the target behavior | implement the minimum change | baseline receipt | move to GREEN |
| Focused test fails for an unrelated reason | diagnose before editing | failure and clean-baseline evidence | classify the blocker |
| Row passes focused verification | tick it, record the result | implementation receipt | the next dependency opens |
| Full suite fails after focused GREEN | compare causal evidence | verification receipt | fix or classify |
| The real-surface probe cannot run | withhold the completion claim | blocked-probe receipt | report incomplete evidence |
| The user changes the objective mid-run | supersede the current plan | the new request and the affected rows | replan the changed portion |
| All required evidence is green | close execution | all four receipts | return the completed result |

## Receipts

**Plan receipt.** The plan path, revision, objective, included and excluded scope, constraints, ordered rows, verification map, approval status and the approving user turn. A conditional approval is quoted in operational terms.

**Baseline receipt.** Working directory, repository identity, branch, dirty paths, the target behavior before edits, the focused RED command with its exit status, and any failures that already exist. Unrelated state stays as found. When a failure may be pre-existing, compare with an isolated clean baseline before classifying it.

**Implementation receipt.** Per completed row: changed paths, the smallest implemented behavior, focused verification, cleanup performed and departures from the planned method. A departure is acceptable when it preserves objective, scope, constraints and risk; otherwise it goes back to approval.

**Verification receipt.** Each final command with its working directory, exit status and pass or fail counts, plus pack, install, rendered or runtime evidence when those surfaces changed. Automated green and human acceptance are reported separately, and blocked checks stay visible as blockers.

## Delegation packet

When a child owns an isolated row, the brief reads:

```text
TASK: <one plan row>
DELIVERABLE: <files or evidence>
SCOPE: <owned paths and explicit exclusions>
CONSTRAINTS: <safety and host boundaries>
VERIFY: <focused commands and the real-surface probe>
RETURN: <receipt fields>
```

The parent keeps integration, full verification and scope. Parallel lanes receive disjoint write ownership. Start implementation rows with `invoke_subagent` and `TypeName` set to `lit-executor`; a child started without a type is general-purpose with every tool.

## Conversation continuity

Before a conversation ends or compacts, persist the plan revision, the last completed row, the receipts, the dirty paths, the open blocker and the exact next command into `.litgravity/ledger/<conversation-id>.jsonl` and `.litgravity/handoff/`. On resume, validate the repository and the plan state before executing, because earlier green output goes stale after later edits.

## Completion rule

`start-work` may report completion when every approved row has an implementation receipt, every required gate has a verification receipt, the real surface was exercised where it applies, and no scope delta is unreported. The plan file by itself proves none of those outcomes.

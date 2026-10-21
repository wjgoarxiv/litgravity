# lit-plan: the plan contract

Read this before the first plan of a conversation. It is the full statement of what a plan file promises, in the order a plan is built. `start-work`, the Stop hook, the resume logic and `scripts/check-plan.mjs` all read the same grammar, so the shapes below are a contract and never a style.

## What every plan carries

- one bounded objective, with explicit non-goals;
- a minimum-first guard: skip work that is unnecessary, reuse existing code, prefer the standard library, platform features and installed dependencies, and prefer one clear line to custom machinery;
- a Bootstrap section that PINs mutable facts, dirty-worktree boundaries, commit and publish approvals, stale-state checks and resume points;
- current evidence from files, documents or source links, cited as `path:line`;
- ordered tasks as top-level checkboxes, each with files, tests and acceptance;
- test commands with the failing and the passing observable spelled out;
- one Manual-QA channel for every user-facing criterion;
- a cleanup receipt requirement for every resource a row starts;
- reviewer-gate criteria for risky, shared, security-sensitive or release-facing rows;
- commit, push and publish guardrails;
- handoff expectations when the plan is long-running.

## Objective-achievable default

The default plan is a proportionate, execution-ready checklist bounded to one outcome that a single `start-work` run can reasonably finish. Before finalizing, turn every material unknown into one of two states: resolved by read-only exploration and cited as current evidence, or gated by a named decision, input, capability or experiment with an explicit stop or branch condition. A finished plan holds resolved or gated unknowns only. Design work left implicit for the executor is a defect, and an unknown tucked inside an implementation checkbox counts as implicit.

Order work by real dependency and say where independent items may run together. For each task state the concrete action, the expected output and a binary verification. Add a failure or decision branch wherever a failed verification changes the next valid action, because many plans have more than one path.

## Full scope is the default

Plan every part of what the user asked for. An MVP, a "v1" or a "phase 1" comes from the user: cutting items and calling the rest a first phase is a scope decision that belongs to them. Sequencing work behind an approval gate or a feasibility gate keeps the whole request in the plan; dropping items shrinks it. When the request cannot be delivered whole, say so and name what would have to give.

Minimum-first and full scope constrain different axes. Minimum-first limits how much code each item costs; full scope fixes how much of the request the plan covers. Solve each item the smallest correct way, and solve all of them. A brief that bundles discovery, architecture qualification, migration and rollout stays in one plan, ordered behind the gate that makes the next step safe, and later rows are marked blocked while an upstream gate is unresolved.

## Adaptive checklist depth

Depth follows uncertainty, blast radius, irreversibility and the cost of evidence, whatever the number of boxes.

| Shape | Appropriate checklist |
| --- | --- |
| Simple, reversible, one-surface change | one or a few atomic rows; a targeted test and the directly affected surface |
| Standard multi-file change | ordered dependencies, per-deliverable acceptance, relevant regression and cleanup checks |
| Risky, scientific, security-sensitive, migration or release work | staged gates, provenance, negative controls, a decision table, rollback and stop branches, machine-readable evidence, a staged DoneClaim |

Detail earns its place when it removes executor judgment, protects a boundary or proves an outcome. Padding looks like the same acceptance statement repeated across sections, or a release gate that has nothing to do with the change. The opposite failure is a risky plan compressed until its failure modes, provenance and decision branches vanish.

## Plan structure

1. TL;DR for humans (written last) and a one-line machine summary: effort, risk, deliverables.
2. Scope: must have, must not have.
3. Bootstrap: facts to re-read, dirty-worktree constraints, stale-state risks, the resume ledger path, bounded cleanup rules, and which approvals are withheld (commit, push, publish, version bump).
4. Context and current evidence, and Decisions.
5. Verification strategy and the Goal block.
6. Execution strategy: waves and a dependency matrix, only where several rows can run independently or have non-obvious prerequisites.
7. Todos, each with the labeled block below.
8. The final verification wave.
9. Commit strategy, success criteria, DoneClaim, risks and open questions.

A task that builds or changes a user-facing web interface names `frontend-ui-ux` in its verification (the interface probe across the responsive matrix, no HIGH finding left) and hands the acceptance verdict to `visual-qa`. A CLI, library or backend-only task names neither.

## Plan-row grammar (machine-checkable)

Both row forms start at column zero:

```text
- [ ] N. <title>          implementation row        (N = 1, 2, 3, ...)
- [ ] F<number>. <title>  final-verifier row        (F1, F2, F3, F4)
```

A real skeleton looks like `- [ ] 1. Port the parser guard` and `- [ ] F1. Plan compliance audit`. An indented row, a numbered list without the checkbox, `1)` numbering or a table row is invisible to the readers named above: the plan then looks complete while `start-work` sees fewer tasks. Numbers are unique and consecutive. Each implementation row carries an indented block of labeled lines:

- `What to do`: the concrete mutation or investigation, with `file:line` references where an existing pattern governs it, plus what the row leaves alone;
- `Files`: the small named set the row may touch;
- `References`: everything the executor needs, since it has no interview context;
- `Tests`: the test name or file and the failing assertion it adds (a row holds its implementation and its test together);
- `Acceptance`: an agent-executable command or assertion that resolves pass or fail;
- `QA scenario`: `tool=<shell|http|browser|agy|...> steps=<...> expected=<binary> evidence=<path>`, or `none: <reason>` for data-only work;
- `Depends on`: the row numbers, or `-`; a row without a dependency belongs to wave 1;
- `Commit`: yes or no, plus a suggested Conventional Commit line when approved; the default is no.

## Success criteria

Declare the criteria needed to prove the bounded objective: one for a simple plan, several for a risky one. Keep the machine-readable shape so an executor can parse each line:

```text
- [ ] C001 | channel: shell | test: <path::test_id> | scenario: <user-visible outcome>
```

Each criterion names the strongest applicable evidence. Behavior changes pair an automated test written before the implementation with a Manual-QA scenario. Documentation-only or data-only work may use a structural guard and a scanner in place of an invented UI scenario. A green suite alone is a floor, and evidence that cannot be falsified is no criterion. Scale happy-path, edge, negative-control and adjacent-regression coverage to the real risk of the task. Prefer measurable statements ("`npm test` exits 0 and the suite lists the new `csv-quoting` cases") to broad phrases ("tests are richer").

## Per-task loop

Write the loop into the plan so the executor follows it verbatim: `PIN -> RED -> GREEN -> VERIFY -> SURFACE -> REVIEW -> CLEAN -> RECORD`. PIN restates the criterion and the stale facts to re-read; RED is the failing test; GREEN the smallest change; VERIFY the targeted and full gates; SURFACE the real-path probe; REVIEW the reviewer gate when the row is risky; CLEAN tears down what the row started; RECORD writes the ledger line.

## QA scenario requirements

Each scenario names the exact tool (a shell command, `curl`, a browser action, `agy -p`), the exact command or steps, a binary PASS or FAIL observable, the artifact path under `.litgravity/evidence/<slug>/`, the cleanup command and receipt, and a bounded timeout or kill strategy for long-running sessions, servers, ports, browser contexts, temp directories and child processes. A `--dry-run` helps for package or install smoke when paired with real output; final user-facing proof comes from the real run.

## Final verification wave

End with a verification wave, folded into fewer rows for a simple plan when separate boxes would be padding. Keep these four concerns:

- F1 - Plan compliance audit: every row and acceptance criterion met.
- F2 - Code quality and diagnostics clean, idioms match, no dead code.
- F3 - Real Manual-QA: each criterion's scenario run fresh, evidence captured, cleanup receipt recorded.
- F4 - Scope fidelity: nothing extra, nothing from Must NOT have introduced.

## Delegation inside a plan

When a plan calls for child agents, write each assignment as an executable work order that opens with `TASK:` and names `DELIVERABLE`, `SCOPE`, `VERIFY`, the exact files, the test, the QA channel, the artifact path and the cleanup receipt. Plan independent lanes so they run in parallel, and document where serialization is required. A lane reports by message when it finishes; silence means no news yet, and a lane that sends nothing, only an acknowledgement, or `BLOCKED:` gets one targeted follow-up through `send_message` and then a smaller fallback assignment. Reviewer fallbacks stay reviewer roles.

Name `lit-executor` for implementation lanes, `lit-verifier` and `quality-reviewer` for review lanes and `qa-runner` for scenario runs, always as the `TypeName` of `invoke_subagent`: a child started without a type is general-purpose with every tool, so the plan uses one only where authority is not at stake. Parallel lanes get disjoint write ownership, and isolated worktrees are used when their isolation and integration are part of the approved method. If the approved slice limits mutations to one directory, the plan keeps every lane inside it, so the executor is never forced to choose between the plan and the user's file boundary.

## DoneClaim

End the plan with a `DoneClaim` that defines exactly what `start-work` returns before completion can be asserted: the bounded objective achieved, expected outputs present, verification commands and real-surface checks passed, a decision branch or final verdict recorded, scope and non-goals preserved, temporary resources cleaned, and release or remote mutations either explicitly approved and receipted or left undone. A list of completed actions that lacks these outcomes is no DoneClaim.

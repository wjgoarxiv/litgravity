# {{slug}} - Work Plan

Status: <fill: approved | awaiting approval | assumptions unconfirmed>
Structure check: `node "<skill-folder>/scripts/check-plan.mjs" --check plans/{{slug}}.md` prints PLAN_STRUCTURE_PASS before execution.

## TL;DR (for humans)
<!-- Fill this LAST, after the detailed plan exists, so it summarizes the real plan. Plain language: no file paths, no row numbers, no agent names. -->

**What you will get:** <fill last: deliverables in human terms, 1-2 sentences>

**Why this approach:** <fill last: the one or two load-bearing decisions and the reason for each>

**What it leaves alone:** <fill last: 1-3 plain lines that mirror Must NOT have>

**Effort:** <Quick | Short | Medium | Large | XL>
**Risk:** <Low | Medium | High> - <one-line driver>
**Decisions worth a glance:** <fill last: the few choices a human should sanity-check>

Your next move: <fill: approve, steer, or ask for a high-accuracy review>.

---

> TL;DR (machine): <effort, risk, deliverables in one line>

## Scope

### Must have
- <non-negotiable property, each one checkable>

### Must NOT have (guardrails, scope boundaries)
- <forbidden change, dependency or behavior; include: no version bump, publish, tag, push or commit unless approved>

## Bootstrap
- PIN: <mutable facts to re-read before acting: branch, versions, manifests, gate commands>
- Dirty worktree (leave alone): <paths or none>
- Approvals withheld: commit, push, publish, version bump (list any the user granted)
- Active host goal at planning time: <what the goal tool reported, or "none / tool not offered">
- Resume ledger: `.litgravity/ledger/<conversation-id>.jsonl`; evidence under `.litgravity/evidence/{{slug}}/`
- Cleanup rules: <bounded to artifacts this plan creates>

## Context and current evidence
<What exists today, with `path:line` references. What triggered the work. Source links with versions.>

## Decisions
- <decision> - <reason> (alternatives considered: <...>)

## Verification strategy
> Every verification step is agent-executed.
- Test decision: <TDD | tests after | none> + framework
- Gates: `<test command>`, `<typecheck>`, `<lint>`, `<build>` (working directory: <dir>)
- Real surface: <command, request or screen that proves the outcome>
- Manual-QA channel per criterion: <shell | http | browser | agy -p>
- Evidence: `.litgravity/evidence/{{slug}}/task-<N>.<ext>`

### Goal (set by litgoal when execution starts)
- Objective: <one outcome sentence, true for a user when done>
- Criteria:
  - c1: <command or surface that proves it>
  - c2: <...>

## Execution strategy

### Waves
> Rows without a dependency form wave 1. Aim for 5-8 rows per wave on large work; a short plan has fewer.

### Dependency matrix
| Row | Depends on | Blocks | Can run with |
| --- | --- | --- | --- |
| 1 | - | <rows> | <rows> |

## Todos
> A row holds its implementation and its test together. Rows start at column zero as `- [ ] N. <title>`; start-work cannot see an indented row.
- [ ] 1. <fill: imperative title>
  - What to do: <fill: action, with `file:line` references; what the row leaves alone>
  - Files: `<fill: paths>`
  - References: <fill: everything the executor needs, since it has no interview context>
  - Tests: <fill: test name or file, and the failing assertion it adds>
  - Acceptance: <fill: agent-executable command or assertion>
  - QA scenario: <fill: tool=<...> steps=<...> expected=<binary> evidence=.litgravity/evidence/{{slug}}/task-1.<ext>, or none: <reason>>
  - Depends on: -
  - Commit: no

## Final verification wave
> Runs after every row above. All four must approve.
- [ ] F1. Plan compliance audit: every row and acceptance criterion met
- [ ] F2. Code quality and diagnostics clean, idioms match, no dead code
- [ ] F3. Real Manual-QA: each criterion's scenario run fresh, evidence captured, cleanup receipt recorded
- [ ] F4. Scope fidelity: nothing extra, nothing from Must NOT have introduced

## Commit strategy
<fill: no commit unless the user approved; when approved, one Conventional Commit line per row group>

## Success criteria
- [ ] C001 | channel: <shell|http|browser|agy -p> | test: <path::test_id> | scenario: <user-visible outcome>

## DoneClaim
<fill: the outputs, gates, real-surface checks, cleanup receipts and approvals that must exist before completion may be claimed>

## Risks and open questions
- <risk> - <mitigation or the row that addresses it>
- Assumptions taken by default: <list, each with the confirmation point>
